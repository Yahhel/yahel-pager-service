import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User, UserDocument, UserModel } from '@shared/schemas';
import { VerifyEmailDto } from '@shared/dtos/verify-email.dto';
import { SendEmailVerificationTokenDto } from '@shared/dtos/send-email-verification-token.dto';
import { JwtService } from '@nestjs/jwt';
import {
  ApiReq,
  EmailFrom,
  PasswordChangeReason,
  PasswordResetStatus,
  RoleType,
  USER_BASIC_FIELDS,
  UserStatus,
} from '@shared/interfaces';
import {
  ConfirmPasswordDto,
  Disable2FADto,
  Enable2FADto,
  GenerateBackupCodesDto,
  LoginDto,
  Verify2FALoginDto,
} from '../dtos/login.dto';
import { LoginResponseDto } from '../dtos/login-response.dto';
import { BcryptUtil } from '@shared/utils/bcrypt.util';
import {
  accessLogout,
  accessLogoutAll,
  convertToKey,
  getPlatformIssuer,
  getRequestTokenKeys,
  getRequestTokenType,
  getTokenExpirationSeconds,
  getTokenKeys,
  getUserTokenKeys,
  isRedisConnected,
  redisDelMany,
  redisExpire,
  redisGet,
  redisIncrBy,
  redisSAdd,
  redisSet,
  redisDel,
  redisSRem,
  runNextTick,
} from '@shared/utils';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';
import { UserTokenData } from '@shared/interfaces/user.token';
import { Types } from 'mongoose';
import { randomBytes, randomUUID } from 'crypto';
import { getMailTemplate, sendMail } from '@shared/utils/mailtrap.util';
import { ForgotPasswordDTO, ResetPasswordDTO } from '@shared/dtos';
import { configs } from '@shared/configs';
import { PasswordChangeDTO } from '@shared/dtos/password-change.dto';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

const REFRESH_TOKEN_EXPIRE_SECONDS = 24 * 3600 * 10; // 10 days
const MAX_2FA_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private dummyPasswordHash: Promise<string>;

  constructor(
    @Inject(User.name)
    private readonly userModel: UserModel,
    private readonly jwtService: JwtService,
  ) {}

  private getIssuerPlatform(req: any, userId: string) {
    const tokenType = getRequestTokenType(req);
    const {
      issuer,
      issuerEmail,
      issuerSub,
      issuerOriginator,
      issuerIdPrefix,
      issuerHashPrefix,
    } = getPlatformIssuer();
    const platformClaim = {
      iss: issuer, // Issuer
      sub: issuerSub, // Subject
      nbf: Math.floor(Date.now() / 1000), // Not Before time (now)
      jti: randomUUID(), // JWT ID
      plid: issuerIdPrefix + randomUUID(), // platform ID
      plem: issuerEmail, //platform Email
      pltt: tokenType, // platform token type
      plcd: userId, // platform client Id
      plto: issuerOriginator, // Platform token originator
      plhh: convertToKey(issuer + issuerEmail + userId, issuerHashPrefix),
    };
    return { tokenType, platformClaim };
  }

  private async storeTokenData(data: UserTokenData, expireSeconds: number) {
    const [key, refreshKey, revokeKey] = getTokenKeys(data);
    const userTokenKeys = getUserTokenKeys(data.user._id);

    // Awaited so the token is valid as soon as the client receives it
    await Promise.all([
      redisSet(key, data, { EX: expireSeconds }),
      redisSet(refreshKey, data, { EX: REFRESH_TOKEN_EXPIRE_SECONDS }),
      redisSet(revokeKey, data, { EX: REFRESH_TOKEN_EXPIRE_SECONDS }),
      redisSAdd(userTokenKeys, [key, refreshKey, revokeKey]),
      redisExpire(userTokenKeys, REFRESH_TOKEN_EXPIRE_SECONDS),
    ] as any);
  }

  private async getSignInDetails(
    req: ApiReq,
    user: any,
  ): Promise<LoginResponseDto> {
    if (!isRedisConnected)
      throw new ServiceUnavailableException(
        'Authentication service is temporarily unavailable',
      );

    const userId = user?._id?.toString();
    const { tokenType, platformClaim } = this.getIssuerPlatform(req, userId);

    // Keep the token small: roles and status are re-read from the DB on every request
    const tokenUser = {
      _id: userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    };

    const expireDurationSeconds = getTokenExpirationSeconds();
    const accessToken = this.jwtService.sign(
      { ...platformClaim, ...tokenUser },
      {
        expiresIn: expireDurationSeconds,
        secret: process.env.JWT_SECRET,
      },
    );
    const refreshToken = randomUUID();
    const revokeToken = randomUUID();
    const data: UserTokenData = {
      refreshToken,
      accessToken,
      user: tokenUser,
      revokeToken,
      tokenType,
    };

    await this.storeTokenData(data, expireDurationSeconds);

    runNextTick(async () => {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { lastLoginDate: new Date() } },
      );
    });

    return {
      accessToken,
      expireDurationSeconds,
      refreshToken,
      roles: user.roles,
      passwordResetStatus: user.passwordResetStatus,
      twoFactorEnabled: !!user.twoFactorEnabled,
    };
  }

  private async validateUser(payload: LoginDto): Promise<UserDocument | any> {
    const { email, password: pass } = payload;
    const user = await this.findByEmail(email);

    // Compare against a dummy hash for unknown emails so response time doesn't reveal registered accounts
    this.dummyPasswordHash ??= BcryptUtil.generateHash(randomUUID());
    const isPasswordMatch = await BcryptUtil.verify(
      pass,
      (user?.password as string) ?? (await this.dummyPasswordHash),
    );
    return user && isPasswordMatch ? user : null;
  }

  async findByEmail(email: string) {
    return await this.userModel.findByEmail(email);
  }

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.userModel.createUser({
      ...createUserDto,
      roles: [RoleType.BUYER],
    });
    await this.userModel.sendEmailVerificationToken(user.email);

    return this.userModel.findById(user._id, USER_BASIC_FIELDS).lean();
  }

  async verifyEmail(payload: VerifyEmailDto) {
    const { email, token } = payload;
    return this.userModel.verifyEmail(email, token);
  }

  async confirmUserPassword(
    req: ApiReq,
    payload: ConfirmPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userModel.findById(req.user._id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordMatch = await BcryptUtil.verify(
      payload.password,
      user.password as string,
    );

    if (!isPasswordMatch) {
      throw new UnauthorizedException('Invalid password');
    }

    return { success: true, message: 'Password confirmed successfully' };
  }

  async sendEmailVerificationToken(args: SendEmailVerificationTokenDto) {
    const { email } = args;
    return await this.userModel.sendEmailVerificationToken(email);
  }

  async login(
    req: ApiReq,
    payload: LoginDto,
  ): Promise<
    LoginResponseDto | { requiresTwoFactor: boolean; tempToken: string }
  > {
    const { twoFactorToken } = payload;

    const user = await this.validateUser(payload);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'Your account is currently disabled. Please contact support.',
      );
    }

    // Check if 2FA is required
    if (user.twoFactorEnabled && !twoFactorToken) {
      // Generate temporary token for 2FA verification
      const tempToken = this.jwtService.sign(
        { userId: user._id, stage: '2fa_pending', jti: randomUUID() },
        { expiresIn: '5m', secret: process.env.JWT_SECRET },
      );

      return {
        requiresTwoFactor: true,
        tempToken,
      };
    }

    // Verify 2FA token if provided
    if (user.twoFactorEnabled && twoFactorToken) {
      const is2FAValid = await this.verify2FAToken(user, twoFactorToken);
      if (!is2FAValid) {
        throw new UnauthorizedException('Invalid 2FA token');
      }
    }

    if (!user.emailVerification) {
      runNextTick(() => this.userModel.sendEmailVerificationToken(user.email));
    }

    return this.getSignInDetails(req, user);
  }

  async refreshToken(
    req: ApiReq,
    refreshTokenDto: RefreshTokenDto,
  ): Promise<LoginResponseDto> {
    const { refreshToken } = refreshTokenDto;
    const tokenType = getRequestTokenType(req);
    const oldRefreshKey = `Refresh_token:${tokenType}:${refreshToken}`;
    const tokenData: UserTokenData = await redisGet(oldRefreshKey);

    if (!tokenData) {
      throw new BadRequestException('Invalid refresh token supplied.');
    }
    const dUser = this.jwtService.decode(tokenData.accessToken) as User & any;

    if (dUser?._id?.toString() !== tokenData.user._id.toString()) {
      throw new BadRequestException(
        'Invalid user with refresh token supplied.',
      );
    }
    const expireDurationSeconds = getTokenExpirationSeconds();

    const { platformClaim } = this.getIssuerPlatform(
      req,
      tokenData.user._id.toString(),
    );

    const accessToken = this.jwtService.sign(
      { ...platformClaim, ...tokenData.user },
      {
        expiresIn: expireDurationSeconds,
        secret: process.env.JWT_SECRET,
      },
    );
    const newRefreshToken = randomUUID();
    const data: UserTokenData = {
      refreshToken: newRefreshToken,
      revokeToken: tokenData.revokeToken,
      accessToken,
      user: tokenData.user,
      tokenType,
    };

    const [oldKey] = getTokenKeys(tokenData);
    await Promise.all([
      redisDelMany([oldKey, oldRefreshKey]),
      redisSRem(getUserTokenKeys(tokenData.user._id), [oldKey, oldRefreshKey]),
      this.storeTokenData(data, expireDurationSeconds),
    ] as any);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expireDurationSeconds,
      roles: tokenData.user.roles,
    };
  }

  async logout(req: ApiReq) {
    await accessLogout(req, req.user._id);
    return { message: 'Logged out successfully' };
  }

  async findMe(req: ApiReq) {
    if (!req.user?._id) {
      throw new UnauthorizedException('User not authenticated!');
    }

    const user = await this.userModel
      .findOne(
        { _id: new Types.ObjectId(req.user._id.toString()) },
        USER_BASIC_FIELDS,
      )
      .lean();

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return { user };
  }

  async changePassword(
    req: ApiReq,
    dto: PasswordChangeDTO,
  ): Promise<{ message: string }> {
    const { type, oldPassword, newPassword } = dto;

    const user = await this.userModel.findById(req.user._id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      type === PasswordChangeReason.FIRST_TIME_LOGIN &&
      user.passwordResetStatus !== PasswordResetStatus.REQUIRED
    ) {
      throw new BadRequestException(
        'Password has already been changed or not required',
      );
    }

    if (type === PasswordChangeReason.USER_INITIATED) {
      const isMatch = await BcryptUtil.verify(
        oldPassword.trim(),
        user.password,
      );
      if (!isMatch) {
        throw new BadRequestException('Old password is incorrect');
      }
    }

    const isPasswordMatch = await BcryptUtil.verify(
      newPassword.trim(),
      user.password as string,
    );

    if (isPasswordMatch) {
      throw new BadRequestException('New password cannot be the same as old');
    }

    const hashedPassword = await BcryptUtil.generateHash(newPassword.trim());

    await this.userModel.updateOne(
      { _id: user._id },
      {
        password: hashedPassword,
        passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
        isDefaultPasswordChanged: true,
      },
    );

    // Keep the current session, log out every other device
    await accessLogoutAll(user._id.toString(), await getRequestTokenKeys(req));

    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Your password was changed successfully',
      template: getMailTemplate().generalPasswordChangeSuccess,
      templateVariables: {
        firstName: user.firstName,
      },
    });

    return {
      message: 'Your password has been successfully updated.',
    };
  }

  forgotPassword({ email }: ForgotPasswordDTO): { message: string } {
    // Off the response path so the reply is the same whether or not the email exists
    runNextTick(async () => {
      const user = await this.userModel.findOne(
        { email, status: UserStatus.ACTIVE },
        { firstName: 1, email: 1, _id: 1 },
      );
      if (!user) return;

      const token = await this.userModel.generateAuthCode(
        'forgot_password',
        user._id.toString(),
        5 * 60,
      );

      sendMail({
        to: user.email,
        from: EmailFrom.HELLO,
        subject: 'Important - Forgot password verification Code',
        template: getMailTemplate().generalPasswordChange,
        templateVariables: {
          token,
          firstName: user.firstName,
          userId: user._id.toString(),
        },
      });
    });

    return {
      message:
        'If an account exists for this email, a verification code has been sent.',
    };
  }

  async resetPassword({
    email,
    token,
    newPassword,
  }: ResetPasswordDTO): Promise<{ message: string }> {
    const user = await this.userModel.findOne(
      { email, status: UserStatus.ACTIVE },
      { firstName: 1, email: 1, _id: 1, password: 1 },
    );

    const isValid =
      !!user &&
      (await this.userModel.validateAuthCode(
        'forgot_password',
        user._id.toString(),
        token,
      ));

    if (!isValid) {
      throw new BadRequestException('Invalid or expired token');
    }

    const isPasswordMatch = await BcryptUtil.verify(
      newPassword.trim(),
      user.password as string,
    );

    if (isPasswordMatch) {
      throw new BadRequestException('New password cannot be the same as old');
    }

    const hashedPassword = await BcryptUtil.generateHash(newPassword.trim());

    // Receiving the code proves inbox ownership, so the email is verified too
    await this.userModel.updateOne(
      { _id: user._id },
      {
        password: hashedPassword,
        passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
        isDefaultPasswordChanged: true,
        emailVerification: true,
      },
    );

    await accessLogoutAll(user._id.toString());

    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Your password was changed successfully',
      template: getMailTemplate().generalPasswordChangeSuccess,
      templateVariables: {
        firstName: user.firstName,
      },
    });

    return {
      message:
        'Your password has been successfully updated. You can now log in.',
    };
  }

  async setup2FA(req: ApiReq): Promise<{
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  }> {
    const user = await this.userModel.findById(req.user._id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }
    const appName = configs().app.appName;
    const secret = speakeasy.generateSecret({
      name: `${user.email} ${appName}`,
      issuer: appName,
      length: 32,
    });

    const tempKey = `2fa_setup:${user._id}`;
    await redisSet(tempKey, { secret: secret.base32 }, { EX: 10 * 60 }); // 10 minutes

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeUrl,
      manualEntryKey: secret.base32,
    };
  }

  async enable2FA(
    req: ApiReq,
    payload: Enable2FADto,
  ): Promise<{
    message: string;
    backupCodes: string[];
  }> {
    const { token } = payload;
    const user = await this.userModel.findById(req.user._id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const tempKey = `2fa_setup:${user._id}`;
    const tempData = await redisGet(tempKey);
    if (!tempData || !tempData.secret) {
      throw new BadRequestException(
        'No 2FA setup in progress. Please start setup again.',
      );
    }

    const verified = speakeasy.totp.verify({
      secret: tempData.secret,
      encoding: 'base32',
      token,
      window: 2, // Allow some time drift
    });

    if (!verified) {
      throw new BadRequestException('Invalid 2FA token');
    }

    const { backupCodes, hashedBackupCodes } = await this.createBackupCodes();

    await this.userModel.updateOne(
      { _id: user._id },
      {
        twoFactorSecret: tempData.secret,
        twoFactorEnabled: true,
        backupCodes: hashedBackupCodes,
      },
    );

    await redisDel(tempKey);

    return {
      message: '2FA has been successfully enabled',
      backupCodes,
    };
  }

  async disable2FA(
    req: ApiReq,
    payload: Disable2FADto,
  ): Promise<{ message: string }> {
    const { password } = payload;
    const user = await this.userModel.findById(req.user._id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.roles?.includes(RoleType.ADMIN)) {
      throw new ForbiddenException('2FA is required for admin accounts');
    }

    const isMatch = await BcryptUtil.verify(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid password');
    }

    await this.userModel.updateOne(
      { _id: user._id },
      {
        $unset: {
          twoFactorSecret: 1,
          backupCodes: 1,
        },
        twoFactorEnabled: false,
      },
    );

    return { message: '2FA has been disabled' };
  }

  async verify2FALogin(
    req: ApiReq,
    payload: Verify2FALoginDto,
  ): Promise<LoginResponseDto> {
    const { tempToken, twoFactorToken } = payload;

    let decoded;
    try {
      decoded = this.jwtService.verify(tempToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (decoded.stage !== '2fa_pending') {
      throw new UnauthorizedException('Invalid token stage');
    }

    const attemptsKey = `2fa_login:attempts:${decoded.jti}`;
    if (+(await redisGet(attemptsKey)) >= MAX_2FA_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many failed attempts. Please log in again.',
      );
    }

    const user = await this.userModel.findById(decoded.userId).lean();
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    const is2FAValid = await this.verify2FAToken(user, twoFactorToken);
    if (!is2FAValid) {
      await redisIncrBy(attemptsKey, 1);
      await redisExpire(attemptsKey, 5 * 60);
      throw new UnauthorizedException('Invalid 2FA token');
    }

    return this.getSignInDetails(req, user);
  }

  async generateBackupCodes(
    req: ApiReq,
    payload: GenerateBackupCodesDto,
  ): Promise<{ backupCodes: string[] }> {
    const { password } = payload;
    const user = await this.userModel.findById(req.user._id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isMatch = await BcryptUtil.verify(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('Invalid password');
    }

    const { backupCodes, hashedBackupCodes } = await this.createBackupCodes();

    await this.userModel.updateOne(
      { _id: user._id },
      { backupCodes: hashedBackupCodes },
    );

    return { backupCodes };
  }

  async get2FAStatus(req: ApiReq): Promise<{
    twoFactorEnabled: boolean;
    backupCodesRemaining: number;
  }> {
    const user = await this.userModel
      .findById(req.user._id)
      .select('twoFactorEnabled backupCodes');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      twoFactorEnabled: user.twoFactorEnabled || false,
      backupCodesRemaining: user.backupCodes?.length || 0,
    };
  }

  private async createBackupCodes() {
    const backupCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString('hex').toUpperCase(),
    );

    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => BcryptUtil.generateHash(code)),
    );
    return { backupCodes, hashedBackupCodes };
  }

  private async verify2FAToken(user: any, token: string): Promise<boolean> {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }

    if (token.length === 8 && user.backupCodes?.length) {
      const matches = await Promise.all(
        user.backupCodes.map((code: string) =>
          BcryptUtil.verify(token.toUpperCase(), code),
        ),
      );
      const matchedCode = user.backupCodes[matches.indexOf(true)];
      if (!matchedCode) return false;

      // Filtering on the code makes a concurrent reuse of the same code fail
      const result = await this.userModel.updateOne(
        { _id: user._id, backupCodes: matchedCode },
        { $pull: { backupCodes: matchedCode } },
      );
      return result.modifiedCount === 1;
    }

    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
  }
}

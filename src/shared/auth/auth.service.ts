import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { configs } from '../configs';
import {
  AccessTokenPayload,
  ApiReq,
  AuthCodePurpose,
  AuthUser,
  EmailFrom,
  LoginResponse,
  PublicUser,
  ReqType,
  SessionRestriction,
  TwoFactorChallengePayload,
  TwoFactorChallengeResponse,
  USER_PUBLIC_FIELDS,
  UserRole,
  UserStatus,
} from '../interfaces';
import { User, UserDocument, UserModel } from '../schemas';
import {
  BcryptUtil,
  generateOtpCode,
  getMailTemplate,
  isDuplicateKeyError,
  isMobile,
  randomToken,
  runNextTick,
  safeEqual,
  sendMail,
  sha256,
} from '../utils';
import { AuthStoreService } from './auth-store.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  SignupDto,
  VerifyEmailDto,
  VerifyTwoFactorLoginDto,
} from './dto';
import { TwoFactorService } from './two-factor.service';

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_CODE = 'Invalid or expired code';

type SessionUser = Pick<
  User,
  'roles' | 'twoFactorEnabled' | 'passwordResetRequired'
> & { _id: any };

@Injectable()
export class AuthService {
  private dummyHash: Promise<string>;

  constructor(
    @Inject(User.name)
    private readonly userModel: UserModel,
    private readonly authStore: AuthStoreService,
    private readonly twoFactorService: TwoFactorService,
    private readonly jwtService: JwtService,
  ) {}

  async signup(req: ApiReq, dto: SignupDto) {
    this.authStore.assertAvailable();
    let user: UserDocument;
    try {
      user = await this.userModel.create({
        ...dto,
        password: await BcryptUtil.generateHash(dto.password),
        roles: [UserRole.BUYER],
      });
    } catch (e) {
      if (isDuplicateKeyError(e))
        throw new ConflictException(
          'An account with this email already exists',
        );
      throw e;
    }

    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Welcome to Yahhel',
      template: getMailTemplate().welcome,
      templateVariables: { firstName: user.firstName },
    });
    await this.sendVerificationCode(user);

    return this.issueSession(req, user);
  }

  async login(
    req: ApiReq,
    { email, password }: LoginDto,
  ): Promise<LoginResponse | TwoFactorChallengeResponse> {
    const user = await this.userModel
      .findOne({ email })
      .select('+password')
      .lean();

    // Compare against a dummy hash when the user is missing so response time doesn't reveal registered emails
    const passwordValid = await BcryptUtil.verify(
      password,
      user?.password ?? (await this.getDummyHash()),
    );
    if (!user || !passwordValid)
      throw new UnauthorizedException(INVALID_CREDENTIALS);

    this.assertActive(user.status);

    if (user.twoFactorEnabled) return this.createTwoFactorChallenge(user._id);

    return this.issueSession(req, user);
  }

  async verifyTwoFactorLogin(
    req: ApiReq,
    { tempToken, token }: VerifyTwoFactorLoginDto,
  ): Promise<LoginResponse> {
    let challenge: TwoFactorChallengePayload;
    try {
      challenge = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired login session');
    }
    if (challenge.stage !== '2fa_pending')
      throw new UnauthorizedException('Invalid or expired login session');

    const { maxCodeAttempts, twoFactorChallengeTtlSeconds } = configs().auth;
    const attempts = await this.authStore.getFailedAttempts(
      AuthCodePurpose.TWO_FACTOR_LOGIN,
      challenge.jti,
    );
    if (attempts >= maxCodeAttempts)
      throw new UnauthorizedException(
        'Too many failed attempts. Please log in again.',
      );

    const user = await this.userModel
      .findById(challenge.sub)
      .select('+twoFactorSecret +backupCodes')
      .lean();
    if (!user)
      throw new UnauthorizedException('Invalid or expired login session');
    this.assertActive(user.status);

    if (!(await this.twoFactorService.verifyToken(user, token))) {
      await this.authStore.recordFailedAttempt(
        AuthCodePurpose.TWO_FACTOR_LOGIN,
        challenge.jti,
        twoFactorChallengeTtlSeconds,
      );
      throw new UnauthorizedException('Invalid 2FA code');
    }

    return this.issueSession(req, user);
  }

  async refreshToken(
    req: ApiReq,
    { refreshToken }: RefreshTokenDto,
  ): Promise<LoginResponse> {
    const [sid, secret] = refreshToken.split('.');
    const session = sid ? await this.authStore.getSession(sid) : null;
    if (!session) throw new UnauthorizedException('Invalid refresh token');

    if (!safeEqual(session.refreshTokenHash, sha256(secret ?? ''))) {
      // A rotated-out token being replayed suggests theft, so end the session
      await this.authStore.revokeSession(session.userId, sid);
      throw new UnauthorizedException('Invalid refresh token');
    }

    const jti = randomUUID();
    const newSecret = randomToken();
    await this.authStore.rotateSession(sid, session.userId, {
      jti,
      refreshTokenHash: sha256(newSecret),
    });

    return this.buildLoginResponse(
      { sub: session.userId, sid, jti },
      `${sid}.${newSecret}`,
      session.roles,
      session.restrictions,
    );
  }

  async logout(authUser: AuthUser) {
    await this.authStore.revokeSession(authUser._id, authUser.sid);
    return { message: 'Logged out successfully' };
  }

  async me(
    authUser: AuthUser,
  ): Promise<PublicUser & Pick<AuthUser, 'restrictions'>> {
    const user = await this.userModel
      .findById(authUser._id, USER_PUBLIC_FIELDS)
      .lean<PublicUser>();
    if (!user) throw new NotFoundException('User not found');
    return { ...user, restrictions: authUser.restrictions };
  }

  async changePassword(
    authUser: AuthUser,
    { oldPassword, newPassword }: ChangePasswordDto,
  ) {
    const user = await this.userModel
      .findById(authUser._id, { email: 1, firstName: 1, password: 1 })
      .select('+password')
      .lean();
    if (!user) throw new NotFoundException('User not found');

    if (!(await BcryptUtil.verify(oldPassword, user.password)))
      throw new BadRequestException('Current password is incorrect');
    if (oldPassword === newPassword)
      throw new BadRequestException(
        'New password must be different from the current password',
      );

    await this.userModel.updateOne(
      { _id: user._id },
      {
        password: await BcryptUtil.generateHash(newPassword),
        passwordResetRequired: false,
      },
    );

    await Promise.all([
      this.authStore.revokeUserSessions(authUser._id, authUser.sid),
      this.authStore.updateSession(authUser.sid, {
        restrictions: authUser.restrictions.filter(
          (r) => r !== SessionRestriction.PASSWORD_CHANGE,
        ),
      }),
    ]);
    this.sendPasswordChangedMail(user);

    return {
      message:
        'Your password has been updated. Other devices have been logged out.',
    };
  }

  async sendEmailVerification(authUser: AuthUser) {
    const user = await this.userModel
      .findById(authUser._id, { email: 1, firstName: 1, emailVerified: 1 })
      .lean();
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified)
      throw new BadRequestException('Email is already verified');

    await this.sendVerificationCode(user);
    return { message: 'A verification code has been sent to your email' };
  }

  async verifyEmail(authUser: AuthUser, { code }: VerifyEmailDto) {
    const valid = await this.authStore.verifyCode(
      AuthCodePurpose.EMAIL_VERIFICATION,
      authUser._id,
      code,
    );
    if (!valid) throw new BadRequestException(INVALID_CODE);

    await this.userModel.updateOne(
      { _id: authUser._id },
      { emailVerified: true },
    );
    return { message: 'Email verified successfully' };
  }

  forgotPassword({ email }: ForgotPasswordDto) {
    // Runs off the response path so the reply is identical whether or not the email exists
    runNextTick(async () => {
      const user = await this.userModel
        .findOne(
          { email, status: UserStatus.ACTIVE },
          { email: 1, firstName: 1 },
        )
        .lean();
      if (!user) return;

      const code = generateOtpCode();
      await this.authStore.setCode(
        AuthCodePurpose.PASSWORD_RESET,
        user._id.toString(),
        code,
        configs().auth.passwordResetTtlSeconds,
      );
      sendMail({
        to: user.email,
        from: EmailFrom.HELLO,
        subject: 'Reset your password',
        template: getMailTemplate().passwordReset,
        templateVariables: { firstName: user.firstName, code },
      });
    });

    return {
      message:
        'If an account exists for this email, a reset code has been sent.',
    };
  }

  async resetPassword({ email, code, newPassword }: ResetPasswordDto) {
    const user = await this.userModel
      .findOne({ email }, { email: 1, firstName: 1, status: 1 })
      .lean();
    if (!user || user.status !== UserStatus.ACTIVE)
      throw new BadRequestException(INVALID_CODE);

    const userId = user._id.toString();
    const valid = await this.authStore.verifyCode(
      AuthCodePurpose.PASSWORD_RESET,
      userId,
      code,
    );
    if (!valid) throw new BadRequestException(INVALID_CODE);

    // Receiving the code proves inbox ownership, so the email is verified too
    await this.userModel.updateOne(
      { _id: user._id },
      {
        password: await BcryptUtil.generateHash(newPassword),
        passwordResetRequired: false,
        emailVerified: true,
      },
    );
    await this.authStore.revokeUserSessions(userId);
    this.sendPasswordChangedMail(user);

    return {
      message: 'Your password has been reset. You can now log in.',
    };
  }

  private async issueSession(
    req: ApiReq,
    user: SessionUser,
  ): Promise<LoginResponse> {
    const userId = user._id.toString();
    const restrictions: SessionRestriction[] = [];
    if (user.passwordResetRequired)
      restrictions.push(SessionRestriction.PASSWORD_CHANGE);
    if (user.roles.includes(UserRole.ADMIN) && !user.twoFactorEnabled)
      restrictions.push(SessionRestriction.TWO_FACTOR_SETUP);

    const sid = randomUUID();
    const jti = randomUUID();
    const secret = randomToken();
    await this.authStore.createSession(sid, {
      userId,
      roles: user.roles,
      restrictions,
      jti,
      refreshTokenHash: sha256(secret),
      tokenType: isMobile(req) ? ReqType.MOBILE : ReqType.WEB,
    });

    runNextTick(() =>
      this.userModel.updateOne({ _id: userId }, { lastLoginAt: new Date() }),
    );

    return this.buildLoginResponse(
      { sub: userId, sid, jti },
      `${sid}.${secret}`,
      user.roles,
      restrictions,
    );
  }

  private buildLoginResponse(
    payload: AccessTokenPayload,
    refreshToken: string,
    roles: UserRole[],
    restrictions: SessionRestriction[],
  ): LoginResponse {
    const expireDurationSeconds = configs().auth.accessTokenTtlSeconds;
    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: expireDurationSeconds,
      }),
      refreshToken,
      expireDurationSeconds,
      roles,
      restrictions,
    };
  }

  private createTwoFactorChallenge(userId: any): TwoFactorChallengeResponse {
    const payload: TwoFactorChallengePayload = {
      sub: userId.toString(),
      jti: randomUUID(),
      stage: '2fa_pending',
    };
    return {
      requiresTwoFactor: true,
      tempToken: this.jwtService.sign(payload, {
        expiresIn: configs().auth.twoFactorChallengeTtlSeconds,
      }),
    };
  }

  private async sendVerificationCode(user: {
    _id: any;
    email: string;
    firstName: string;
  }) {
    const code = generateOtpCode();
    await this.authStore.setCode(
      AuthCodePurpose.EMAIL_VERIFICATION,
      user._id.toString(),
      code,
      configs().auth.emailVerificationTtlSeconds,
    );
    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Verify your email',
      template: getMailTemplate().emailVerification,
      templateVariables: { firstName: user.firstName, code },
    });
  }

  private sendPasswordChangedMail(user: { email: string; firstName: string }) {
    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Your password was changed',
      template: getMailTemplate().passwordChanged,
      templateVariables: { firstName: user.firstName },
    });
  }

  private assertActive(status: UserStatus) {
    if (status !== UserStatus.ACTIVE)
      throw new ForbiddenException(
        'Your account has been disabled. Please contact support.',
      );
  }

  private getDummyHash() {
    this.dummyHash ??= BcryptUtil.generateHash(randomToken());
    return this.dummyHash;
  }
}

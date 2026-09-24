import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { configs } from '../configs';
import { AuthUser, SessionRestriction, UserRole } from '../interfaces';
import { User, UserModel } from '../schemas';
import { BcryptUtil, randomToken } from '../utils';
import { AuthStoreService } from './auth-store.service';
import { ConfirmTwoFactorDto, EnableTwoFactorDto } from './dto';

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;

type TwoFactorUser = {
  _id: any;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  backupCodes?: string[];
};

@Injectable()
export class TwoFactorService {
  constructor(
    @Inject(User.name)
    private readonly userModel: UserModel,
    private readonly authStore: AuthStoreService,
  ) {}

  async setup(authUser: AuthUser) {
    const user = await this.userModel
      .findById(authUser._id, { email: 1, twoFactorEnabled: 1 })
      .lean();
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled)
      throw new BadRequestException('2FA is already enabled');

    const { appName } = configs().auth;
    const secret = speakeasy.generateSecret({
      name: `${appName} (${user.email})`,
      issuer: appName,
      length: 32,
    });
    await this.authStore.setTwoFactorSetup(authUser._id, secret.base32);

    return {
      qrCodeUrl: await QRCode.toDataURL(secret.otpauth_url),
      manualEntryKey: secret.base32,
    };
  }

  async enable(authUser: AuthUser, { token }: EnableTwoFactorDto) {
    const secret = await this.authStore.getTwoFactorSetup(authUser._id);
    if (!secret)
      throw new BadRequestException(
        'No 2FA setup in progress. Please start setup again.',
      );
    if (!this.verifyTotp(secret, token))
      throw new BadRequestException('Invalid 2FA code');

    const { codes, hashes } = await this.generateBackupCodes();
    const user = await this.userModel.findOneAndUpdate(
      { _id: authUser._id, twoFactorEnabled: false },
      {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: hashes,
      },
      { new: true, lean: true, projection: { _id: 1 } },
    );
    if (!user) throw new BadRequestException('2FA is already enabled');

    await Promise.all([
      this.authStore.clearTwoFactorSetup(authUser._id),
      this.authStore.updateSession(authUser.sid, {
        restrictions: authUser.restrictions.filter(
          (r) => r !== SessionRestriction.TWO_FACTOR_SETUP,
        ),
      }),
    ]);

    return { message: '2FA has been enabled', backupCodes: codes };
  }

  async disable(authUser: AuthUser, dto: ConfirmTwoFactorDto) {
    if (authUser.roles.includes(UserRole.ADMIN))
      throw new ForbiddenException('2FA is required for admin accounts');

    const user = await this.findWithSecrets(authUser._id);
    await this.assertPasswordAndToken(user, dto);

    await this.userModel.updateOne(
      { _id: user._id },
      {
        twoFactorEnabled: false,
        $unset: { twoFactorSecret: 1, backupCodes: 1 },
      },
    );
    return { message: '2FA has been disabled' };
  }

  async regenerateBackupCodes(authUser: AuthUser, dto: ConfirmTwoFactorDto) {
    const user = await this.findWithSecrets(authUser._id);
    await this.assertPasswordAndToken(user, dto);

    const { codes, hashes } = await this.generateBackupCodes();
    await this.userModel.updateOne({ _id: user._id }, { backupCodes: hashes });
    return { backupCodes: codes };
  }

  async status(authUser: AuthUser) {
    const user = await this.userModel
      .findById(authUser._id, { twoFactorEnabled: 1, backupCodes: 1 })
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return {
      twoFactorEnabled: !!user.twoFactorEnabled,
      backupCodesRemaining: user.backupCodes?.length ?? 0,
    };
  }

  /** Accepts a TOTP code, or consumes a matching one-time backup code. */
  async verifyToken(user: TwoFactorUser, token: string): Promise<boolean> {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) return false;

    if (token.length === BACKUP_CODE_LENGTH && user.backupCodes?.length) {
      const normalized = token.toUpperCase();
      const matches = await Promise.all(
        user.backupCodes.map((hash) => BcryptUtil.verify(normalized, hash)),
      );
      const matchedHash = user.backupCodes[matches.indexOf(true)];
      if (!matchedHash) return false;

      // Filtering on the hash makes a concurrent reuse of the same code fail
      const result = await this.userModel.updateOne(
        { _id: user._id, backupCodes: matchedHash },
        { $pull: { backupCodes: matchedHash } },
      );
      return result.modifiedCount === 1;
    }

    return this.verifyTotp(user.twoFactorSecret, token);
  }

  private verifyTotp(secret: string, token: string) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }

  private async findWithSecrets(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('+password +twoFactorSecret +backupCodes')
      .lean();
    if (!user) throw new NotFoundException('User not found');
    if (!user.twoFactorEnabled)
      throw new BadRequestException('2FA is not enabled');
    return user;
  }

  private async assertPasswordAndToken(
    user: TwoFactorUser & { password: string },
    { password, token }: ConfirmTwoFactorDto,
  ) {
    // Sequential so a wrong password never consumes a backup code
    const valid =
      (await BcryptUtil.verify(password, user.password)) &&
      (await this.verifyToken(user, token));
    if (!valid) throw new BadRequestException('Invalid password or 2FA code');
  }

  private async generateBackupCodes() {
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomToken(BACKUP_CODE_LENGTH / 2).toUpperCase(),
    );
    const hashes = await Promise.all(
      codes.map((code) => BcryptUtil.generateHash(code)),
    );
    return { codes, hashes };
  }
}

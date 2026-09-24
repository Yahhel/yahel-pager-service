import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as speakeasy from 'speakeasy';
import {
  PasswordChangeReason,
  PasswordResetStatus,
  RoleType,
  UserStatus,
} from '../interfaces';
import { BcryptUtil } from '../utils/bcrypt.util';
import { convertToKey, getPlatformIssuer } from '../utils/helper.util';
import { validateAccess } from '../utils/access-token-validator.util';
import { redisUtilMock } from '../testkits/redis.mock';
import { AuthService } from './auth.service';

jest.mock(
  '../utils/redis.util',
  () => jest.requireActual('../testkits/redis.mock').redisUtilMock,
);
jest.mock('../utils/mailtrap.util', () => ({
  sendMail: jest.fn(),
  getMailTemplate: () => ({}),
}));

const flushNextTick = () => new Promise((resolve) => setImmediate(resolve));

describe('AuthService', () => {
  process.env.JWT_SECRET = 'test-secret';
  const jwtService = new JwtService({ secret: 'test-secret' });
  global.jwtService = jwtService;
  const req: any = { headers: { 'user-agent': 'jest' } };
  let userModel: any;
  let service: AuthService;
  let passwordHash: string;

  const buildUser = (overrides = {}) => ({
    _id: '64b000000000000000000001',
    email: 'ada@test.com',
    firstName: 'Ada',
    lastName: 'Buyer',
    password: passwordHash,
    roles: [RoleType.BUYER],
    status: UserStatus.ACTIVE,
    emailVerification: true,
    passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
    twoFactorEnabled: false,
    ...overrides,
  });

  const authedReq = async (loginResponse: any) => {
    const decoded: any = jwtService.decode(loginResponse.accessToken);
    return {
      headers: {
        'user-agent': 'jest',
        authorization: `Bearer ${loginResponse.accessToken}`,
      },
      url: '/api/v1/auth/me',
      user: decoded,
    };
  };

  beforeAll(async () => {
    passwordHash = await BcryptUtil.generateHash('Secret#123');
  });

  beforeEach(() => {
    redisUtilMock.store.clear();
    userModel = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      sendEmailVerificationToken: jest.fn(),
      generateAuthCode: jest.fn().mockResolvedValue('123456'),
      validateAuthCode: jest.fn(),
    };
    service = new AuthService(userModel, jwtService);
  });

  describe('login', () => {
    it('returns the same error for an unknown email and a wrong password', async () => {
      userModel.findByEmail.mockResolvedValueOnce(null);
      await expect(
        service.login(req, {
          email: 'nobody@test.com',
          password: 'Secret#123',
        }),
      ).rejects.toThrow('Invalid email or password');

      userModel.findByEmail.mockResolvedValueOnce(buildUser());
      await expect(
        service.login(req, { email: 'ada@test.com', password: 'Wrong#123' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('only reveals a disabled account after the correct password', async () => {
      userModel.findByEmail.mockResolvedValue(
        buildUser({ status: UserStatus.DISABLE }),
      );
      await expect(
        service.login(req, { email: 'ada@test.com', password: 'Wrong#123' }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.login(req, { email: 'ada@test.com', password: 'Secret#123' }),
      ).rejects.toThrow('disabled');
    });

    it('returns a 2FA challenge instead of tokens when 2FA is enabled', async () => {
      userModel.findByEmail.mockResolvedValue(
        buildUser({ twoFactorEnabled: true }),
      );
      const result: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.accessToken).toBeUndefined();
      expect(jwtService.decode(result.tempToken)).toMatchObject({
        stage: '2fa_pending',
      });
    });

    it('signs platform claims with a minimal user and registers the token in redis', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const result: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      const payload: any = jwtService.decode(result.accessToken);
      const { issuer, issuerSub, issuerHashPrefix, issuerEmail } =
        getPlatformIssuer();
      expect(payload).toMatchObject({
        iss: issuer,
        sub: issuerSub,
        plcd: '64b000000000000000000001',
        plhh: convertToKey(
          issuer + issuerEmail + '64b000000000000000000001',
          issuerHashPrefix,
        ),
        _id: '64b000000000000000000001',
        roles: [RoleType.BUYER],
      });
      expect(payload.password).toBeUndefined();
      expect(payload.twoFactorSecret).toBeUndefined();

      // Stored before returning, so the token is valid immediately
      await expect(
        validateAccess((await authedReq(result)) as any),
      ).resolves.toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('rotates tokens and invalidates the old access and refresh tokens', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const login: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      const refreshed = await service.refreshToken(req, {
        refreshToken: login.refreshToken,
      });

      expect(refreshed.refreshToken).not.toBe(login.refreshToken);
      await expect(
        validateAccess((await authedReq(refreshed)) as any),
      ).resolves.toBe(true);
      await expect(
        validateAccess((await authedReq(login)) as any),
      ).resolves.toBe(false);
      await expect(
        service.refreshToken(req, { refreshToken: login.refreshToken }),
      ).rejects.toThrow('Invalid refresh token supplied.');
    });
  });

  describe('sessions', () => {
    it('logout invalidates only the current session', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const first: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      const second: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      await service.logout((await authedReq(first)) as any);

      await expect(
        validateAccess((await authedReq(first)) as any),
      ).resolves.toBe(false);
      await expect(
        validateAccess((await authedReq(second)) as any),
      ).resolves.toBe(true);
    });

    it('reset password logs out every session and verifies the email', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const login: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      userModel.findOne.mockResolvedValue(buildUser());
      userModel.validateAuthCode.mockResolvedValue(true);

      await service.resetPassword({
        email: 'ada@test.com',
        token: '123456',
        newPassword: 'NewSecret#123',
      });

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: '64b000000000000000000001' },
        expect.objectContaining({
          emailVerification: true,
          passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
        }),
      );
      await expect(
        validateAccess((await authedReq(login)) as any),
      ).resolves.toBe(false);
    });

    it('change password keeps the current session and logs out the others', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const current: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      const other: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      userModel.findById.mockResolvedValue(buildUser());

      await service.changePassword((await authedReq(current)) as any, {
        type: PasswordChangeReason.USER_INITIATED,
        oldPassword: 'Secret#123',
        newPassword: 'NewSecret#123',
      });

      await expect(
        validateAccess((await authedReq(current)) as any),
      ).resolves.toBe(true);
      await expect(
        validateAccess((await authedReq(other)) as any),
      ).resolves.toBe(false);
    });
  });

  describe('password flows', () => {
    it('first-time password change is allowed only while a reset is required', async () => {
      const authed: any = { headers: {}, user: { _id: 'u1' } };
      userModel.findById.mockResolvedValueOnce(
        buildUser({ passwordResetStatus: PasswordResetStatus.REQUIRED }),
      );
      await expect(
        service.changePassword(authed, {
          type: PasswordChangeReason.FIRST_TIME_LOGIN,
          newPassword: 'NewSecret#123',
        }),
      ).resolves.toMatchObject({ message: expect.any(String) });

      userModel.findById.mockResolvedValueOnce(buildUser());
      await expect(
        service.changePassword(authed, {
          type: PasswordChangeReason.FIRST_TIME_LOGIN,
          newPassword: 'NewSecret#123',
        }),
      ).rejects.toThrow('Password has already been changed or not required');
    });

    it('forgot password replies the same way and does the work off the response path', async () => {
      userModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildUser());
      const unknown = service.forgotPassword({ email: 'nobody@test.com' });
      const known = service.forgotPassword({ email: 'ada@test.com' });

      expect(unknown).toEqual(known);
      await flushNextTick();
      await flushNextTick();
      expect(userModel.generateAuthCode).toHaveBeenCalledTimes(1);
      expect(userModel.generateAuthCode).toHaveBeenCalledWith(
        'forgot_password',
        '64b000000000000000000001',
        300,
      );
    });

    it('reset password gives the same error for an unknown email and a wrong code', async () => {
      userModel.findOne.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword({
          email: 'nobody@test.com',
          token: '123456',
          newPassword: 'NewSecret#123',
        }),
      ).rejects.toThrow('Invalid or expired token');

      userModel.findOne.mockResolvedValueOnce(buildUser());
      userModel.validateAuthCode.mockResolvedValueOnce(false);
      await expect(
        service.resetPassword({
          email: 'ada@test.com',
          token: '000000',
          newPassword: 'NewSecret#123',
        }),
      ).rejects.toThrow('Invalid or expired token');
    });
  });

  describe('2FA', () => {
    const secret = speakeasy.generateSecret({ length: 20 }).base32;

    it('admins cannot disable 2FA', async () => {
      userModel.findById.mockResolvedValue(
        buildUser({ roles: [RoleType.ADMIN], twoFactorEnabled: true }),
      );
      await expect(
        service.disable2FA({ user: { _id: 'u1' } } as any, {
          password: 'Secret#123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('a backup code works once', async () => {
      const code = 'ABCD1234';
      const user: any = buildUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: [await BcryptUtil.generateHash(code)],
      });
      userModel.findById.mockReturnValue({ lean: () => Promise.resolve(user) });
      // Apply $pull to the in-memory user so reuse behaves like the real DB
      userModel.updateOne.mockImplementation(async (filter, update) => {
        const pulled = update?.$pull?.backupCodes;
        if (!pulled) return { modifiedCount: 1 };
        if (!user.backupCodes.includes(filter.backupCodes))
          return { modifiedCount: 0 };
        user.backupCodes = user.backupCodes.filter((c) => c !== pulled);
        return { modifiedCount: 1 };
      });
      const challenge = () =>
        jwtService.sign({ userId: user._id, stage: '2fa_pending', jti: 'j1' });

      await expect(
        service.verify2FALogin(req, {
          tempToken: challenge(),
          twoFactorToken: code.toLowerCase(),
        }),
      ).resolves.toHaveProperty('accessToken');

      await expect(
        service.verify2FALogin(req, {
          tempToken: challenge(),
          twoFactorToken: code,
        }),
      ).rejects.toThrow('Invalid 2FA token');
    });

    it('locks the 2FA challenge after 5 wrong codes', async () => {
      const user = buildUser({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      });
      userModel.findById.mockReturnValue({ lean: () => Promise.resolve(user) });
      const tempToken = jwtService.sign({
        userId: user._id,
        stage: '2fa_pending',
        jti: 'lock-test',
      });

      for (let i = 0; i < 5; i++) {
        await expect(
          service.verify2FALogin(req, { tempToken, twoFactorToken: '000000' }),
        ).rejects.toThrow('Invalid 2FA token');
      }
      await expect(
        service.verify2FALogin(req, {
          tempToken,
          twoFactorToken: speakeasy.totp({ secret, encoding: 'base32' }),
        }),
      ).rejects.toThrow('Too many failed attempts');
    });

    it('rejects an access token used as a 2FA challenge', async () => {
      userModel.findByEmail.mockResolvedValue(buildUser());
      const login: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      await expect(
        service.verify2FALogin(req, {
          tempToken: login.accessToken,
          twoFactorToken: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('enable requires a valid code from the pending setup', async () => {
      userModel.findById.mockResolvedValue(buildUser());
      await service.setup2FA({ user: { _id: 'u1' } } as any);
      const [setupKey] = [...redisUtilMock.store.keys()].filter((k) =>
        k.startsWith('2fa_setup:'),
      );
      const setupSecret = redisUtilMock.store.get(setupKey).secret;

      await expect(
        service.enable2FA({ user: { _id: 'u1' } } as any, { token: '000000' }),
      ).rejects.toThrow(BadRequestException);

      const result = await service.enable2FA({ user: { _id: 'u1' } } as any, {
        token: speakeasy.totp({ secret: setupSecret, encoding: 'base32' }),
      });
      expect(result.backupCodes).toHaveLength(8);
    });
  });
});

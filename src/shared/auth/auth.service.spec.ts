import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AuthCodePurpose,
  SessionRestriction,
  UserRole,
  UserStatus,
} from '../interfaces';
import { BcryptUtil, sha256 } from '../utils';
import { AuthService } from './auth.service';

jest.mock('../utils/mailtrap.util', () => ({
  sendMail: jest.fn(),
  getMailTemplate: () => ({}),
}));

const flushNextTick = () => new Promise((resolve) => setImmediate(resolve));

const leanQuery = (value: any) => {
  const query: any = {
    select: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return query;
};

describe('AuthService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  let userModel: any;
  let authStore: any;
  let twoFactorService: any;
  let service: AuthService;
  let passwordHash: string;

  const req: any = { headers: { 'user-agent': 'jest' } };
  const buildUser = (overrides = {}) => ({
    _id: 'user-1',
    email: 'ada@test.com',
    firstName: 'Ada',
    password: passwordHash,
    roles: [UserRole.BUYER],
    status: UserStatus.ACTIVE,
    twoFactorEnabled: false,
    passwordResetRequired: false,
    ...overrides,
  });

  beforeAll(async () => {
    passwordHash = await BcryptUtil.generateHash('Secret#123');
  });

  beforeEach(() => {
    userModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({}),
    };
    authStore = {
      createSession: jest.fn(),
      getSession: jest.fn(),
      rotateSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeUserSessions: jest.fn(),
      updateSession: jest.fn(),
      setCode: jest.fn(),
      verifyCode: jest.fn(),
      getFailedAttempts: jest.fn().mockResolvedValue(0),
      recordFailedAttempt: jest.fn(),
    };
    twoFactorService = { verifyToken: jest.fn() };
    service = new AuthService(
      userModel,
      authStore,
      twoFactorService,
      jwtService,
    );
  });

  describe('login', () => {
    it('returns the same error for an unknown email and a wrong password', async () => {
      userModel.findOne.mockReturnValueOnce(leanQuery(null));
      const unknown = service.login(req, {
        email: 'nobody@test.com',
        password: 'Secret#123',
      });
      await expect(unknown).rejects.toThrow(UnauthorizedException);

      userModel.findOne.mockReturnValueOnce(leanQuery(buildUser()));
      const wrong = service.login(req, {
        email: 'ada@test.com',
        password: 'Wrong#123',
      });
      await expect(wrong).rejects.toThrow('Invalid email or password');
    });

    it('rejects disabled accounts after a correct password', async () => {
      userModel.findOne.mockReturnValue(
        leanQuery(buildUser({ status: UserStatus.DISABLED })),
      );
      await expect(
        service.login(req, { email: 'ada@test.com', password: 'Secret#123' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns a 2FA challenge instead of tokens when 2FA is enabled', async () => {
      userModel.findOne.mockReturnValue(
        leanQuery(buildUser({ twoFactorEnabled: true })),
      );
      const result: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.accessToken).toBeUndefined();
      expect(jwtService.decode(result.tempToken)).toMatchObject({
        sub: 'user-1',
        stage: '2fa_pending',
      });
      expect(authStore.createSession).not.toHaveBeenCalled();
    });

    it('issues a session with a minimal token payload', async () => {
      userModel.findOne.mockReturnValue(leanQuery(buildUser()));
      const result: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });

      const payload: any = jwtService.decode(result.accessToken);
      expect(Object.keys(payload).sort()).toEqual(
        ['exp', 'iat', 'jti', 'sid', 'sub'].sort(),
      );
      const [sid, secret] = result.refreshToken.split('.');
      expect(sid).toBe(payload.sid);
      expect(authStore.createSession).toHaveBeenCalledWith(
        sid,
        expect.objectContaining({
          userId: 'user-1',
          jti: payload.jti,
          refreshTokenHash: sha256(secret),
          restrictions: [],
        }),
      );
    });

    it('restricts admins without 2FA and users that must change their password', async () => {
      userModel.findOne.mockReturnValue(
        leanQuery(
          buildUser({ roles: [UserRole.ADMIN], passwordResetRequired: true }),
        ),
      );
      const result: any = await service.login(req, {
        email: 'ada@test.com',
        password: 'Secret#123',
      });
      expect(result.restrictions).toEqual([
        SessionRestriction.PASSWORD_CHANGE,
        SessionRestriction.TWO_FACTOR_SETUP,
      ]);
    });
  });

  describe('verifyTwoFactorLogin', () => {
    const challengeFor = (userId: string) =>
      jwtService.sign({
        sub: userId,
        jti: 'challenge-1',
        stage: '2fa_pending',
      });

    it('rejects access tokens used as challenge tokens', async () => {
      const accessToken = jwtService.sign({
        sub: 'user-1',
        sid: 's',
        jti: 'j',
      });
      await expect(
        service.verifyTwoFactorLogin(req, {
          tempToken: accessToken,
          token: '123456',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('locks the challenge after too many failed attempts', async () => {
      authStore.getFailedAttempts.mockResolvedValue(5);
      await expect(
        service.verifyTwoFactorLogin(req, {
          tempToken: challengeFor('user-1'),
          token: '123456',
        }),
      ).rejects.toThrow('Too many failed attempts');
      expect(userModel.findById).not.toHaveBeenCalled();
    });

    it('records a failed attempt on a wrong code', async () => {
      userModel.findById.mockReturnValue(
        leanQuery(buildUser({ twoFactorEnabled: true })),
      );
      twoFactorService.verifyToken.mockResolvedValue(false);
      await expect(
        service.verifyTwoFactorLogin(req, {
          tempToken: challengeFor('user-1'),
          token: '000000',
        }),
      ).rejects.toThrow('Invalid 2FA code');
      expect(authStore.recordFailedAttempt).toHaveBeenCalledWith(
        AuthCodePurpose.TWO_FACTOR_LOGIN,
        'challenge-1',
        expect.any(Number),
      );
    });
  });

  describe('refreshToken', () => {
    it('rotates the refresh token and access token id', async () => {
      authStore.getSession.mockResolvedValue({
        userId: 'user-1',
        roles: [UserRole.BUYER],
        restrictions: [],
        refreshTokenHash: sha256('old-secret'),
      });

      const result = await service.refreshToken(req, {
        refreshToken: 'sid-1.old-secret',
      });

      const [sid, newSecret] = result.refreshToken.split('.');
      expect(sid).toBe('sid-1');
      expect(newSecret).not.toBe('old-secret');
      expect(authStore.rotateSession).toHaveBeenCalledWith('sid-1', 'user-1', {
        jti: (jwtService.decode(result.accessToken) as any).jti,
        refreshTokenHash: sha256(newSecret),
      });
    });

    it('revokes the session when a rotated-out token is replayed', async () => {
      authStore.getSession.mockResolvedValue({
        userId: 'user-1',
        refreshTokenHash: sha256('current-secret'),
      });

      await expect(
        service.refreshToken(req, { refreshToken: 'sid-1.stale-secret' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authStore.revokeSession).toHaveBeenCalledWith('user-1', 'sid-1');
    });
  });

  describe('password flows', () => {
    it('forgot-password replies identically and does the work off the response path', async () => {
      // Lookups run on the next tick, in call order
      userModel.findOne
        .mockReturnValueOnce(leanQuery(null))
        .mockReturnValueOnce(leanQuery(buildUser()));
      const unknown = service.forgotPassword({ email: 'nobody@test.com' });
      const known = service.forgotPassword({ email: 'ada@test.com' });

      expect(unknown).toEqual(known);
      await flushNextTick();
      await flushNextTick();
      expect(authStore.setCode).toHaveBeenCalledTimes(1);
      expect(authStore.setCode).toHaveBeenCalledWith(
        AuthCodePurpose.PASSWORD_RESET,
        'user-1',
        expect.any(String),
        expect.any(Number),
      );
    });

    it('reset-password revokes every session and marks the email verified', async () => {
      userModel.findOne.mockReturnValue(leanQuery(buildUser()));
      authStore.verifyCode.mockResolvedValue(true);

      await service.resetPassword({
        email: 'ada@test.com',
        code: '123456',
        newPassword: 'NewSecret#123',
      });

      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: 'user-1' },
        expect.objectContaining({
          emailVerified: true,
          passwordResetRequired: false,
        }),
      );
      expect(authStore.revokeUserSessions).toHaveBeenCalledWith('user-1');
    });

    it('reset-password gives the same error for an unknown email and a wrong code', async () => {
      userModel.findOne.mockReturnValueOnce(leanQuery(null));
      await expect(
        service.resetPassword({
          email: 'nobody@test.com',
          code: '123456',
          newPassword: 'NewSecret#123',
        }),
      ).rejects.toThrow('Invalid or expired code');

      userModel.findOne.mockReturnValueOnce(leanQuery(buildUser()));
      authStore.verifyCode.mockResolvedValue(false);
      await expect(
        service.resetPassword({
          email: 'ada@test.com',
          code: '000000',
          newPassword: 'NewSecret#123',
        }),
      ).rejects.toThrow('Invalid or expired code');
    });

    it('change-password keeps the current session and lifts its restriction', async () => {
      userModel.findById.mockReturnValue(leanQuery(buildUser()));
      const authUser = {
        _id: 'user-1',
        sid: 'sid-1',
        roles: [UserRole.ADMIN],
        restrictions: [
          SessionRestriction.PASSWORD_CHANGE,
          SessionRestriction.TWO_FACTOR_SETUP,
        ],
      };

      await service.changePassword(authUser, {
        oldPassword: 'Secret#123',
        newPassword: 'NewSecret#123',
      });

      expect(authStore.revokeUserSessions).toHaveBeenCalledWith(
        'user-1',
        'sid-1',
      );
      expect(authStore.updateSession).toHaveBeenCalledWith('sid-1', {
        restrictions: [SessionRestriction.TWO_FACTOR_SETUP],
      });
    });
  });
});

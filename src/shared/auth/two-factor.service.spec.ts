import { BadRequestException, ForbiddenException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import { SessionRestriction, UserRole } from '../interfaces';
import { BcryptUtil } from '../utils';
import { TwoFactorService } from './two-factor.service';

const leanQuery = (value: any) => {
  const query: any = {
    select: jest.fn(() => query),
    lean: jest.fn(() => Promise.resolve(value)),
  };
  return query;
};

describe('TwoFactorService', () => {
  const secret = speakeasy.generateSecret({ length: 20 }).base32;
  const currentCode = () => speakeasy.totp({ secret, encoding: 'base32' });
  let userModel: any;
  let authStore: any;
  let service: TwoFactorService;

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
      findOneAndUpdate: jest.fn().mockResolvedValue({ _id: 'user-1' }),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };
    authStore = {
      getTwoFactorSetup: jest.fn(),
      clearTwoFactorSetup: jest.fn(),
      updateSession: jest.fn(),
    };
    service = new TwoFactorService(userModel, authStore);
  });

  describe('verifyToken', () => {
    it('accepts a valid TOTP code', async () => {
      const user = {
        _id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      };
      await expect(service.verifyToken(user, currentCode())).resolves.toBe(
        true,
      );
    });

    it('consumes a matching backup code exactly once', async () => {
      const hash = await BcryptUtil.generateHash('ABCD1234');
      const user = {
        _id: 'user-1',
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: [hash],
      };

      await expect(service.verifyToken(user, 'abcd1234')).resolves.toBe(true);
      expect(userModel.updateOne).toHaveBeenCalledWith(
        { _id: 'user-1', backupCodes: hash },
        { $pull: { backupCodes: hash } },
      );

      userModel.updateOne.mockResolvedValue({ modifiedCount: 0 });
      await expect(service.verifyToken(user, 'ABCD1234')).resolves.toBe(false);
    });

    it('rejects users without 2FA enabled', async () => {
      await expect(
        service.verifyToken(
          { _id: 'user-1', twoFactorEnabled: false },
          '123456',
        ),
      ).resolves.toBe(false);
    });
  });

  it('enable stores the secret, returns backup codes and lifts the setup restriction', async () => {
    authStore.getTwoFactorSetup.mockResolvedValue(secret);
    const authUser = {
      _id: 'user-1',
      sid: 'sid-1',
      roles: [UserRole.ADMIN],
      restrictions: [SessionRestriction.TWO_FACTOR_SETUP],
    };

    const result = await service.enable(authUser, { token: currentCode() });

    expect(result.backupCodes).toHaveLength(8);
    expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-1', twoFactorEnabled: false },
      expect.objectContaining({
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      }),
      expect.anything(),
    );
    expect(authStore.updateSession).toHaveBeenCalledWith('sid-1', {
      restrictions: [],
    });
  });

  it('enable rejects a wrong code', async () => {
    authStore.getTwoFactorSetup.mockResolvedValue(secret);
    await expect(
      service.enable(
        { _id: 'user-1', sid: 'sid-1', roles: [], restrictions: [] },
        { token: '000000' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('admins cannot disable 2FA', async () => {
    await expect(
      service.disable(
        {
          _id: 'user-1',
          sid: 'sid-1',
          roles: [UserRole.ADMIN],
          restrictions: [],
        },
        { password: 'x', token: '123456' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userModel.findById).not.toHaveBeenCalled();
  });

  it('a wrong password never consumes a backup code', async () => {
    const hash = await BcryptUtil.generateHash('ABCD1234');
    userModel.findById.mockReturnValue(
      leanQuery({
        _id: 'user-1',
        password: await BcryptUtil.generateHash('Secret#123'),
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        backupCodes: [hash],
      }),
    );

    await expect(
      service.disable(
        {
          _id: 'user-1',
          sid: 'sid-1',
          roles: [UserRole.SELLER],
          restrictions: [],
        },
        { password: 'Wrong#123', token: 'ABCD1234' },
      ),
    ).rejects.toThrow('Invalid password or 2FA code');
    expect(userModel.updateOne).not.toHaveBeenCalled();
  });
});

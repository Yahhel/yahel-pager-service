import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../decorators';
import { PasswordResetStatus, RoleType, UserStatus } from '../../interfaces';
import { JwtUserStrategy } from '../strategies/jwt.user.strategy';
import { JwtAdminStrategy } from '../strategies/jwt.admin.strategy';
import { JwtAdminsGuard } from './jwt.admins.guard';
import { RoleGuard } from './role.guard';

jest.mock('@shared/utils/access-token-validator.util', () => ({
  validateAccessTokenAfterRefreshOrRevoke: jest.fn().mockResolvedValue(true),
}));

const contextFor = (user: any, metadata: Record<string, any> = {}) => {
  const handler = () => null;
  Object.entries(metadata).forEach(([key, value]) =>
    Reflect.defineMetadata(key, value, handler),
  );
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: () => ({ user, url: '/api/v1/users/profile' }),
    }),
  } as any;
};

describe('RoleGuard', () => {
  const guard = new RoleGuard(new Reflector());

  it('allows routes without @Roles', async () => {
    await expect(
      guard.canActivate(contextFor({ roles: [RoleType.BUYER] })),
    ).resolves.toBe(true);
  });

  it('allows a user holding any required role', async () => {
    const context = contextFor(
      { roles: [RoleType.BUYER, RoleType.SELLER] },
      { [ROLES_KEY]: [RoleType.SELLER] },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a user without the required role', async () => {
    const context = contextFor(
      { roles: [RoleType.BUYER] },
      { [ROLES_KEY]: [RoleType.SELLER] },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('JwtAdminsGuard', () => {
  const guard = new JwtAdminsGuard();

  beforeEach(() => {
    jest
      .spyOn(Object.getPrototypeOf(JwtAdminsGuard.prototype), 'canActivate')
      .mockResolvedValue(true);
  });

  it('blocks admins who still have to change their default password', async () => {
    const context = contextFor({
      passwordResetStatus: PasswordResetStatus.REQUIRED,
      twoFactorEnabled: true,
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Change your default password',
    );
  });

  it('blocks admins without 2FA', async () => {
    const context = contextFor({
      passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
      twoFactorEnabled: false,
    });
    await expect(guard.canActivate(context)).rejects.toThrow('Enable 2FA');
  });

  it('allows admins who completed both steps', async () => {
    const context = contextFor({
      passwordResetStatus: PasswordResetStatus.NOT_REQUIRED,
      twoFactorEnabled: true,
    });
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});

describe('JWT strategies', () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  const authService: any = { findByEmail: jest.fn() };
  const payload: any = { email: 'ada@test.com', roles: [RoleType.BUYER] };

  it('user strategy returns current roles from the database', async () => {
    authService.findByEmail.mockResolvedValue({
      status: UserStatus.ACTIVE,
      roles: [RoleType.BUYER, RoleType.SELLER],
    });
    await expect(
      new JwtUserStrategy(authService).validate(payload),
    ).resolves.toMatchObject({ roles: [RoleType.BUYER, RoleType.SELLER] });
  });

  it('user strategy rejects disabled accounts immediately', async () => {
    authService.findByEmail.mockResolvedValue({
      status: UserStatus.DISABLE,
      roles: [RoleType.BUYER],
    });
    await expect(
      new JwtUserStrategy(authService).validate(payload),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('admin strategy rejects non-admins', async () => {
    authService.findByEmail.mockResolvedValue({
      status: UserStatus.ACTIVE,
      roles: [RoleType.BUYER, RoleType.SELLER],
    });
    await expect(
      new JwtAdminStrategy(authService).validate(payload),
    ).rejects.toThrow(UnauthorizedException);
  });
});

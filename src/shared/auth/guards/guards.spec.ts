import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_RESTRICTED_KEY, ROLES_KEY } from '../../decorators';
import { SessionRestriction, UserRole } from '../../interfaces';
import { JwtStrategy } from '../strategies/jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const contextFor = (user: any, metadata: Record<string, any> = {}) => {
  const handler = () => null;
  Object.entries(metadata).forEach(([key, value]) =>
    Reflect.defineMetadata(key, value, handler),
  );
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
};

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('allows routes without @Roles', () => {
    expect(guard.canActivate(contextFor({ roles: [UserRole.BUYER] }))).toBe(
      true,
    );
  });

  it('allows a user holding any required role', () => {
    const context = contextFor(
      { roles: [UserRole.BUYER, UserRole.SELLER] },
      { [ROLES_KEY]: [UserRole.SELLER] },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a user without the required role', () => {
    const context = contextFor(
      { roles: [UserRole.BUYER, UserRole.SELLER] },
      { [ROLES_KEY]: [UserRole.ADMIN] },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

describe('JwtAuthGuard restrictions', () => {
  const guard = new JwtAuthGuard(new Reflector());

  beforeEach(() => {
    jest
      .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
      .mockResolvedValue(true);
  });

  it('blocks restricted sessions from normal routes', async () => {
    const context = contextFor({
      restrictions: [SessionRestriction.TWO_FACTOR_SETUP],
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets restricted sessions reach @AllowRestricted routes', async () => {
    const context = contextFor(
      { restrictions: [SessionRestriction.PASSWORD_CHANGE] },
      { [ALLOW_RESTRICTED_KEY]: true },
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('allows unrestricted sessions everywhere', async () => {
    await expect(
      guard.canActivate(contextFor({ restrictions: [] })),
    ).resolves.toBe(true);
  });
});

describe('JwtStrategy', () => {
  const session = {
    userId: 'user-1',
    jti: 'jti-1',
    roles: [UserRole.BUYER],
    restrictions: [],
  };
  const authStore: any = { getSession: jest.fn() };
  let strategy: JwtStrategy;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    strategy = new JwtStrategy(authStore);
  });

  it('returns the session identity for a live session', async () => {
    authStore.getSession.mockResolvedValue(session);
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'sid-1', jti: 'jti-1' }),
    ).resolves.toEqual({
      _id: 'user-1',
      sid: 'sid-1',
      roles: [UserRole.BUYER],
      restrictions: [],
    });
  });

  it('rejects tokens from a revoked session', async () => {
    authStore.getSession.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'sid-1', jti: 'jti-1' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects access tokens superseded by a refresh', async () => {
    authStore.getSession.mockResolvedValue(session);
    await expect(
      strategy.validate({ sub: 'user-1', sid: 'sid-1', jti: 'old-jti' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens without a session id, such as 2FA challenge tokens', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', jti: 'jti-1' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });
});

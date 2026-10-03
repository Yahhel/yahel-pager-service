import { GoneException, UnauthorizedException } from '@nestjs/common';
import { redisUtilMock } from '../testkits/redis.mock';
import {
  buildFileToken,
  destroyFileToken,
  injectFilePublicUrl,
  validateAndConsumeFileToken,
} from './token.util';
import { getBaseUrl } from './helper.util';

jest.mock(
  './redis.util',
  () => jest.requireActual('../testkits/redis.mock').redisUtilMock,
);

const FILE_ID = '64b000000000000000000001';

describe('file token util', () => {
  const originalSecret = process.env.ENCRYPTION_SECRET;

  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret';
    redisUtilMock.store.clear();
  });

  afterAll(() => (process.env.ENCRYPTION_SECRET = originalSecret));

  it('builds a signed stream URL from the request host', () => {
    const req: any = {
      protocol: 'http',
      get: (h: string) =>
        ({ 'x-forwarded-proto': 'https', host: 'api.pager.com' })[h],
    };
    const { public_url } = injectFilePublicUrl(FILE_ID, req);
    expect(public_url).toMatch(
      /^https:\/\/api\.pager\.com\/api\/v1\/files\/stream\/64b000000000000000000001\?fk=/,
    );
  });

  it('getBaseUrl prefers forwarded headers and never doubles the scheme', () => {
    const get = (headers: Record<string, string>) => (h: string) => headers[h];
    expect(
      getBaseUrl({ protocol: 'https', get: get({ host: 'a.com' }) } as any),
    ).toBe('https://a.com');
    expect(
      getBaseUrl({
        protocol: 'http',
        get: get({
          'x-forwarded-proto': 'https,http',
          'x-forwarded-host': 'b.com',
          host: 'internal:10000',
        }),
      } as any),
    ).toBe('https://b.com');
  });

  it('a one-time token works once', async () => {
    const token = buildFileToken(FILE_ID);
    await expect(
      validateAndConsumeFileToken(token, FILE_ID),
    ).resolves.toMatchObject({ ott: true });
    await expect(validateAndConsumeFileToken(token, FILE_ID)).rejects.toThrow(
      GoneException,
    );
  });

  it('only one of two simultaneous requests can claim a one-time token', async () => {
    const token = buildFileToken(FILE_ID);
    const results = await Promise.allSettled([
      validateAndConsumeFileToken(token, FILE_ID),
      validateAndConsumeFileToken(token, FILE_ID),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('a reusable media token works for many range requests until destroyed', async () => {
    const token = buildFileToken(FILE_ID, 300, false);
    for (let i = 0; i < 3; i++) {
      await expect(
        validateAndConsumeFileToken(token, FILE_ID),
      ).resolves.toMatchObject({ ott: false });
    }
    const { fingerprint, exp } = await validateAndConsumeFileToken(
      token,
      FILE_ID,
    );
    await destroyFileToken(fingerprint, exp);
    await expect(validateAndConsumeFileToken(token, FILE_ID)).rejects.toThrow(
      GoneException,
    );
  });

  it('rejects tampered tokens and tokens for another file', async () => {
    const token = buildFileToken(FILE_ID);
    // Flip one hex character of the ciphertext so it always differs
    const index = token.length - 2;
    const tampered =
      token.slice(0, index) +
      (token[index] === 'a' ? 'b' : 'a') +
      token.slice(index + 1);
    await expect(
      validateAndConsumeFileToken(tampered, FILE_ID),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      validateAndConsumeFileToken(
        buildFileToken(FILE_ID),
        '64b000000000000000000002',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', async () => {
    const token = buildFileToken(FILE_ID, -1);
    await expect(validateAndConsumeFileToken(token, FILE_ID)).rejects.toThrow(
      'Token expired',
    );
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = buildFileToken(FILE_ID);
    process.env.ENCRYPTION_SECRET = 'another-secret';
    await expect(validateAndConsumeFileToken(token, FILE_ID)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('refuses to sign without a secret instead of using a default', () => {
    const jwtSecret = process.env.JWT_SECRET;
    delete process.env.ENCRYPTION_SECRET;
    delete process.env.JWT_SECRET;
    expect(() => buildFileToken(FILE_ID)).toThrow(
      'ENCRYPTION_SECRET is not set',
    );
    process.env.JWT_SECRET = jwtSecret;
  });
});

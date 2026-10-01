import { redactRecord, redactUrl } from './redact.util';

describe('redactRecord', () => {
  it('redacts sensitive keys at any depth', () => {
    const result = redactRecord({
      email: 'ada@test.com',
      password: 'Secret#123',
      session: { refreshToken: 'abc', nested: [{ token: '123456' }] },
    });
    expect(result).toEqual({
      email: 'ada@test.com',
      password: '__REDACTED__',
      session: {
        refreshToken: '__REDACTED__',
        nested: [{ token: '__REDACTED__' }],
      },
    });
  });

  it('handles null values without leaking the unredacted record', () => {
    expect(redactRecord({ password: 'x', phone: null, meta: null })).toEqual({
      password: '__REDACTED__',
      phone: '__REDACTED__',
      meta: null,
    });
  });

  it('does not mutate the input', () => {
    const input = { password: 'x' };
    redactRecord(input);
    expect(input.password).toBe('x');
  });
});

describe('redactUrl', () => {
  it('strips signed file tokens from URLs', () => {
    expect(
      redactUrl(
        'https://api.pager.com/api/v1/files/stream/abc?fk=a1b2%3Ac3&x=1',
      ),
    ).toBe('https://api.pager.com/api/v1/files/stream/abc?fk=__REDACTED__&x=1');
    expect(redactUrl('/api/v1/files/stream/abc?x=1&fk=secret')).toBe(
      '/api/v1/files/stream/abc?x=1&fk=__REDACTED__',
    );
  });

  it('redacts signed links in response bodies', () => {
    expect(redactRecord({ public_url: 'https://x/stream/1?fk=t' })).toEqual({
      public_url: '__REDACTED__',
    });
  });
});

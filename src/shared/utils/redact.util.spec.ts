import { redactRecord } from './redact.util';

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

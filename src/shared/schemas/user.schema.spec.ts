import { redisUtilMock } from '../testkits/redis.mock';
import { UserSchema } from './user.schema';

jest.mock(
  '../utils/redis.util',
  () => jest.requireActual('../testkits/redis.mock').redisUtilMock,
);
jest.mock('../utils/mailtrap.util', () => ({
  sendMail: jest.fn(),
  getMailTemplate: () => ({}),
}));

describe('User auth code statics', () => {
  const model: any = {};
  model.generateAuthCode = UserSchema.statics.generateAuthCode.bind(model);
  model.validateAuthCode = UserSchema.statics.validateAuthCode.bind(model);

  beforeEach(() => redisUtilMock.store.clear());

  it('accepts the code as a string and only once', async () => {
    const token = await model.generateAuthCode('forgot_password', 'u1', 300);

    await expect(
      model.validateAuthCode('forgot_password', 'u1', String(token)),
    ).resolves.toBe(true);
    await expect(
      model.validateAuthCode('forgot_password', 'u1', String(token)),
    ).resolves.toBe(false);
  });

  it('burns the code after 5 wrong attempts', async () => {
    const token = await model.generateAuthCode('forgot_password', 'u1', 300);

    for (let i = 0; i < 5; i++) {
      await model.validateAuthCode('forgot_password', 'u1', 'wrong');
    }
    await expect(
      model.validateAuthCode('forgot_password', 'u1', token),
    ).resolves.toBe(false);
  });

  it('a new code resets the attempt counter', async () => {
    await model.generateAuthCode('forgot_password', 'u1', 300);
    for (let i = 0; i < 5; i++) {
      await model.validateAuthCode('forgot_password', 'u1', 'wrong');
    }

    const token = await model.generateAuthCode('forgot_password', 'u1', 300);
    await expect(
      model.validateAuthCode('forgot_password', 'u1', token),
    ).resolves.toBe(true);
  });
});

describe('User.verifyEmail', () => {
  it('rejects an unknown email with the same message as a wrong code', async () => {
    const model: any = {
      findOne: jest.fn().mockResolvedValue(null),
      validateAuthCode: jest.fn(),
    };
    await expect(
      UserSchema.statics.verifyEmail.call(model, 'nobody@test.com', '123456'),
    ).rejects.toThrow('Invalid/Expired verification code');
    expect(model.validateAuthCode).not.toHaveBeenCalled();
  });
});

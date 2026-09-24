import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { randomInt } from 'crypto';
import {
  EmailFrom,
  PasswordResetStatus,
  RoleType,
  UserStatus,
} from '../interfaces';
import { CreateUserDto } from '@shared/dtos/create-user.dto';
import {
  firstCapitalize,
  isTestEnv,
  redisDel,
  redisExpire,
  redisGet,
  redisIncrBy,
  redisSet,
} from '@shared/utils';
import { BadRequestException } from '@nestjs/common';
import { BcryptUtil } from '@shared/utils/bcrypt.util';
import { getMailTemplate, sendMail } from '@shared/utils/mailtrap.util';
import { configs } from '@shared/configs';

export type UserDocument = HydratedDocument<User>;

export interface UserModel extends Model<UserDocument> {
  createUser(
    payload: CreateUserDto & { roles?: RoleType[] },
  ): Promise<UserDocument>;
  sendEmailVerificationToken(email: string): Promise<{ message: string }>;
  verifyEmail(email: string, token: string): Promise<{ message: string }>;
  findByEmail(email: string): Promise<UserDocument | null>;
  generateAuthCode(
    keyPrefix: string,
    userId: string,
    expireSeconds: number,
  ): Promise<string>;
  validateAuthCode(
    keyPrefix: string,
    userId: string,
    token: string,
  ): Promise<boolean>;
}

const MAX_AUTH_CODE_ATTEMPTS = 5;

@Schema({ timestamps: true })
export class User {
  @Prop({ index: true, required: true })
  firstName: string;

  @Prop({ index: true, required: true })
  lastName: string;

  @Prop({ index: true, required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ index: true })
  phone: string;

  @Prop({
    index: true,
    type: [String],
    enum: RoleType,
    default: [RoleType.BUYER],
  })
  roles: RoleType[];

  @Prop({
    index: true,
    enum: UserStatus,
    default: UserStatus.ACTIVE,
  })
  status?: string;

  @Prop({ index: true, type: Boolean, default: false })
  emailVerification?: boolean;

  @Prop({ default: null })
  lastLoginDate: Date;

  @Prop({
    type: String,
    index: true,
    enum: PasswordResetStatus,
    default: PasswordResetStatus.NOT_REQUIRED,
  })
  passwordResetStatus: PasswordResetStatus;

  @Prop({ type: Boolean, default: false })
  isDefaultPasswordChanged: boolean;

  @Prop({ type: Date, default: null })
  deletedAt?: Date;

  @Prop({ type: Boolean, default: false })
  deleted?: boolean;

  @Prop({ type: Boolean, default: false })
  twoFactorEnabled: boolean;

  @Prop()
  twoFactorSecret: string;

  @Prop()
  backupCodes: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.statics.createUser = async function createUser(
  payload: CreateUserDto & { roles?: RoleType[] },
) {
  const { email, password, lastName, firstName } = payload;

  const existingUser = await this.findOne(
    { email: email.trim().toLowerCase() },
    { _id: 1 },
  );

  if (existingUser)
    throw new BadRequestException(
      'User already exists. Sign into your account',
    );

  const userData: any = {
    ...payload,
    firstName: firstCapitalize(firstName.trim()),
    lastName: firstCapitalize(lastName.trim()),
  };
  userData.email = email.trim().toLowerCase();
  userData.password = await BcryptUtil.generateHash(password.trim());

  const user = await this.create(userData);
  user.password = undefined;

  sendMail({
    to: user.email,
    from: EmailFrom.HELLO,
    subject: 'Welcome to Yahhel',
    template: getMailTemplate().generalWelcome,
    templateVariables: {
      firstName: user.firstName,
    },
  });
  return user;
};

UserSchema.statics.generateAuthCode = async function generateAuthCode(
  keyPrefix: string,
  userId: string,
  expireSeconds: number,
) {
  const token = isTestEnv()
    ? configs().app.testToken
    : randomInt(100_000, 1_000_000).toString();

  await Promise.all([
    redisSet(
      `${keyPrefix}:${userId}`,
      { userId, token },
      { EX: expireSeconds },
    ),
    redisDel(`${keyPrefix}:attempts:${userId}`),
  ]);
  return token;
};

UserSchema.statics.validateAuthCode = async function validateAuthCode(
  keyPrefix: string,
  userId: string,
  token: string,
) {
  const key = `${keyPrefix}:${userId}`;
  const data = await redisGet(key);
  if (!data || data.userId !== userId) return false;

  if (String(data.token) === String(token)) {
    await Promise.all([
      redisDel(key),
      redisDel(`${keyPrefix}:attempts:${userId}`),
    ]);
    return true;
  }

  // Burn the code after too many wrong guesses
  const attemptsKey = `${keyPrefix}:attempts:${userId}`;
  const attempts = await redisIncrBy(attemptsKey, 1);
  await redisExpire(attemptsKey, 15 * 60);
  if (attempts >= MAX_AUTH_CODE_ATTEMPTS) await redisDel(key);
  return false;
};

UserSchema.statics.sendEmailVerificationToken =
  async function sendEmailVerificationToken(email: string) {
    const response = {
      message:
        'If the account exists and is unverified, a verification code has been sent.',
    };
    const user = await this.findOne(
      { email: email.trim().toLowerCase() },
      { _id: 1, email: 1, firstName: 1, emailVerification: 1 },
    );

    if (!user || user.emailVerification) return response;

    const token = await (this as UserModel).generateAuthCode(
      'auth:users:email:verification',
      user._id.toString(),
      60 * 10,
    );

    sendMail({
      to: user.email,
      from: EmailFrom.HELLO,
      subject: 'Important - Email Confirmation Code',
      template: getMailTemplate().generalEmailVerification,
      templateVariables: {
        firstName: user.firstName,
        emailVerificationCode: token,
      },
    });

    return response;
  };

UserSchema.statics.verifyEmail = async function verifyEmail(
  email: string,
  token: string,
) {
  const user = (await this.findOne(
    { email: email.trim().toLowerCase() },
    { _id: 1, email: 1, emailVerification: 1 },
  )) as UserDocument;

  const isValid =
    !!user &&
    !user.emailVerification &&
    (await (this as UserModel).validateAuthCode(
      'auth:users:email:verification',
      user._id.toString(),
      token,
    ));

  if (!isValid)
    throw new BadRequestException(
      'Invalid/Expired verification code. kindly request a new verification code.',
    );

  await this.updateOne({ _id: user._id }, { emailVerification: true });
  return { message: 'email verification was successful' };
};

UserSchema.statics.findByEmail = async function findByEmail(email: string) {
  // Status is checked by callers after the password, so a disabled account isn't revealed early
  return this.findOne({ email: email?.trim().toLowerCase() }).lean();
};

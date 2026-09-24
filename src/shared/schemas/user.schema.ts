import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Model } from 'mongoose';
import { UserRole, UserStatus } from '../interfaces';

export type UserDocument = HydratedDocument<User>;

export type UserModel = Model<UserDocument>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: [String],
    enum: UserRole,
    default: [UserRole.BUYER],
    index: true,
  })
  roles: UserRole[];

  @Prop({
    type: String,
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    index: true,
  })
  status: UserStatus;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  passwordResetRequired: boolean;

  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ select: false })
  twoFactorSecret?: string;

  @Prop({ type: [String], select: false })
  backupCodes?: string[];

  @Prop({ type: Date })
  lastLoginAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ createdAt: -1 });

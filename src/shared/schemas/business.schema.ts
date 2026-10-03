import { Prop, Schema, SchemaFactory, raw } from '@nestjs/mongoose';
import { HydratedDocument, Model, Types } from 'mongoose';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CreateBusinessPayload,
  ModelEntity,
  PayoutAccount,
  PayoutAccountRaw,
  RoleType,
  SocialLinks,
  SocialLinksRaw,
  StageTracker,
  StageTrackerSchemaRaw,
  BusinessStatus,
} from '../interfaces';
import { generateCode, regexEscape } from '@shared/utils';
import { UserDocument, UserModel } from './user.schema';
import { FileDocument, FileModel } from './file.schema';

export type BusinessDocument = HydratedDocument<Business>;

export interface BusinessModel extends Model<BusinessDocument> {
  createBusiness(
    payload: CreateBusinessPayload & { user: UserDocument | any },
    userModel: UserModel,
    fileModel: FileModel,
  ): Promise<BusinessDocument>;
  generateBusinessCode(displayName: string): Promise<string>;
  validateProfilePhoto(
    fileModel: FileModel,
    profilePhoto: string | undefined,
    userId: string,
  ): Promise<void>;
}

@Schema({ timestamps: true })
export class Business {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  user: UserDocument | Types.ObjectId;

  @Prop({ index: true, required: true, trim: true })
  displayName: string;

  @Prop({ index: true, required: true, unique: true, lowercase: true })
  code: string;

  @Prop({ trim: true })
  bio: string;

  @Prop({ type: Types.ObjectId, ref: 'File', default: null })
  profilePhoto: FileDocument | Types.ObjectId;

  @Prop(raw(SocialLinksRaw))
  socialLinks: SocialLinks;

  @Prop({
    index: true,
    type: String,
    enum: BusinessStatus,
    default: BusinessStatus.ACTIVE,
  })
  status: BusinessStatus;

  @Prop(raw({ type: Map, of: StageTrackerSchemaRaw, default: {} }))
  stageTracker: Record<string, StageTracker>;

  // Only the last 4 digits are kept; payouts go through the Paystack recipient code
  @Prop(raw({ type: PayoutAccountRaw, default: null }))
  payoutAccount: PayoutAccount;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ type: Boolean, default: false })
  deleted: boolean;

  declare createdAt: Date;
  declare updatedAt: Date;
}

export const BusinessSchema = SchemaFactory.createForClass(Business);
BusinessSchema.index({ createdAt: -1 });

BusinessSchema.statics.generateBusinessCode =
  async function generateBusinessCode(displayName: string) {
    const baseCode =
      generateCode(displayName.trim())
        .replace(/[^a-z0-9_-]/g, '')
        .replace(/_+/g, '_')
        .replace(/^[_-]+|[_-]+$/g, '')
        .substring(0, 30) || 'business';

    // One query for every taken variant, so the next free suffix needs no loop of lookups
    const takenCodes: string[] = await this.distinct('code', {
      code: { $regex: `^${regexEscape(baseCode).source}(-\\d+)?$` },
    });
    if (!takenCodes.includes(baseCode)) return baseCode;

    let suffix = 2;
    while (takenCodes.includes(`${baseCode}-${suffix}`)) suffix++;
    return `${baseCode}-${suffix}`;
  };

BusinessSchema.statics.validateProfilePhoto =
  async function validateProfilePhoto(
    fileModel: FileModel,
    profilePhoto: string | undefined,
    userId: string,
  ) {
    if (!profilePhoto) return;

    // Storefronts are public, so the photo must be the creator's own public file
    const exists = await fileModel.exists({
      _id: new Types.ObjectId(profilePhoto),
      user: new Types.ObjectId(userId),
      isDeleted: false,
      private: false,
    });
    if (!exists)
      throw new BadRequestException(
        'Profile photo must be one of your files uploaded with private=false',
      );
  };

BusinessSchema.statics.createBusiness = async function createBusiness(
  payload: CreateBusinessPayload & { user: UserDocument | any },
  userModel: UserModel,
  fileModel: FileModel,
) {
  const { user, displayName, bio, profilePhoto, socialLinks } = payload;
  const userId = user._id.toString();

  const existingBusiness = await this.exists({ user: user._id });
  if (existingBusiness) {
    throw new ConflictException('You already have a business');
  }

  await (this as BusinessModel).validateProfilePhoto(
    fileModel,
    profilePhoto,
    userId,
  );

  const business = await this.create({
    user: user._id,
    displayName: displayName.trim(),
    code: await (this as BusinessModel).generateBusinessCode(displayName),
    bio,
    socialLinks,
    ...(profilePhoto && { profilePhoto: new Types.ObjectId(profilePhoto) }),
  });

  await Promise.all([
    userModel.updateOne(
      { _id: user._id },
      {
        $addToSet: { roles: RoleType.SELLER },
        $set: { business: business._id },
      },
    ),
    fileModel.validateAndLinkFiles(
      payload,
      ['profilePhoto'],
      ModelEntity.BUSINESS,
      business._id,
      userId,
    ),
  ]);

  return business;
};

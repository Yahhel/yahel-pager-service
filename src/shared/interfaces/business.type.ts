export enum BusinessStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export const BusinessStatuses = [...new Set(Object.values(BusinessStatus))];

export type SocialLinks = {
  website?: string;
  instagram?: string;
  x?: string;
  tiktok?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
};

export const SocialLinksRaw = {
  website: { type: String },
  instagram: { type: String },
  x: { type: String },
  tiktok: { type: String },
  youtube: { type: String },
  facebook: { type: String },
  linkedin: { type: String },
  _id: false,
};

export const BUSINESS_PUBLIC_FIELDS =
  'displayName code bio profilePhoto socialLinks createdAt';

export type PayoutAccount = {
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  currency: string;
  recipientCode: string;
  verifiedAt: Date;
};

export const PayoutAccountRaw = {
  bankCode: { type: String },
  bankName: { type: String },
  accountName: { type: String },
  accountNumberLast4: { type: String },
  currency: { type: String, default: 'NGN' },
  recipientCode: { type: String },
  verifiedAt: { type: Date },
  _id: false,
};

export type CreateBusinessPayload = {
  displayName: string;
  bio?: string;
  profilePhoto?: string;
  socialLinks?: SocialLinks;
};

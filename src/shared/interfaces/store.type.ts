export enum StoreStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export const StoreStatuses = [...new Set(Object.values(StoreStatus))];

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

export const STORE_PUBLIC_FIELDS =
  'displayName code bio profilePhoto socialLinks createdAt';

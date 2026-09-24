export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum UserRole {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export const Genders = [...new Set(Object.values(Gender))];
export const UserRoles = [...new Set(Object.values(UserRole))];
export const UserStatuses = [...new Set(Object.values(UserStatus))];

export const USER_PUBLIC_FIELDS =
  'firstName lastName email phone roles status emailVerified passwordResetRequired twoFactorEnabled lastLoginAt createdAt updatedAt';

export type PublicUser = {
  _id: any;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roles: UserRole[];
  status: UserStatus;
  emailVerified: boolean;
  passwordResetRequired: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

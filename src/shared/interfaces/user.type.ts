export enum RoleType {
  SELLER = 'SELLER',
  BUYER = 'BUYER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  DELETE = 'DELETE',
  DISABLE = 'DISABLE',
  DEACTIVATE = 'DEACTIVATE',
}

export enum PasswordResetStatus {
  REQUIRED = 'REQUIRED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

export enum PasswordChangeReason {
  FIRST_TIME_LOGIN = 'FIRST_TIME_LOGIN', // When user is invited or seeded and logs in for the first time
  USER_INITIATED = 'USER_INITIATED', // When user changes password from their settings
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export const RoleTypes = [...new Set(Object.values(RoleType))];
export const Genders = [...new Set(Object.values(Gender))];
export const UserStatuses = [...new Set(Object.values(UserStatus))];
export const PasswordChangeReasons = [
  ...new Set(Object.values(PasswordChangeReason)),
];

export const USER_BASIC_FIELDS =
  'firstName lastName email phone roles status emailVerification passwordResetStatus twoFactorEnabled lastLoginDate createdAt updatedAt';

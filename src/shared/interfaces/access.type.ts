export enum AccessType {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export const userTypes = [...new Set(Object.values(AccessType))];

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export const Genders = [...new Set(Object.values(Gender))];

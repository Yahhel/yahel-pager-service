export enum EntityModule {
  PRODUCTS = 'products',
}

export const CategoryEntityModules = [...new Set(Object.values(EntityModule))];

export const CATEGORY_PUBLIC_FIELDS =
  'name code description module parentCategory';

export type CategorySeed = {
  name: string;
  description: string;
  subcategories: string[];
};

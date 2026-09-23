export enum ProductTypeEnum {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

export enum ProductStatusEnum {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVERSED = 'REVERSED',
}

export enum ProductCategoryEnum {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
  CHARGE = 'CHARGE',
  TOP_UP = 'TOP_UP',
  WITHDRAW = 'WITHDRAW',
  TRANSFER = 'TRANSFER',
  BILLS = 'BILLS',
  FUNDING = 'DEPOSIT',
  SALES = 'SALES',
}

export type MetaDetails = {
  destinationAccount: string;
};

export const MetaDetailsRaw = {
  destinationAccount: { type: String },
};

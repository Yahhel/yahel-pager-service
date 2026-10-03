export type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
  meta?: Record<string, any>;
};

export type PaystackBank = {
  id: number;
  name: string;
  slug: string;
  code: string;
  longcode?: string;
  country: string;
  currency: string;
  type: string;
  active: boolean;
};

export type PaystackResolvedAccount = {
  account_number: string;
  account_name: string;
  bank_id: number;
};

export type PaystackTransferRecipient = {
  active: boolean;
  recipient_code: string;
  name: string;
  type: string;
  currency: string;
  details: {
    account_number: string;
    account_name: string;
    bank_code: string;
    bank_name: string;
  };
};

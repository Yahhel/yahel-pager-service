export enum AuditType {
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

export type CreateAuditPayload = {
  actionBy?: string;
  action?: string;
  actionType?: string;
  serviceName?: string;
  requestUrl?: string;
  requestMethod?: string;
  requestActionBy?: string;
  requestModelType?: string;
  requestProductType?: string;
  requestId?: string;
  actionSuccessful?: boolean;
  requestData?: any;
  responseData?: any;
  requestReference?: any;
  previousData?: any;
  currentData?: any;
};

export enum ActionType {
  QUANTITY = 'QUANTITY',
  PRICING = 'PRICING',
  SHIPPING = 'SHIPPING',
  PAYMENT_TERMS = 'PAYMENT_TERMS',
  TERMS_AND_CONDITIONS = 'TERMS_AND_CONDITIONS',
  ACCEPTANCE = 'ACCEPTANCE',
}

export enum ModelEntityType {
  USER = 'USER',
  TRADE = 'TRADE',
  PRODUCT = 'PRODUCT',
}

export const ModelEntityTypes = Object.values(ModelEntityType);
export const ActionTypes = Object.values(ActionType);

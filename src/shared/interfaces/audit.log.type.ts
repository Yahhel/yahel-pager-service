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

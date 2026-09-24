export enum AuditType {
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
  USER = 'USER',
}

export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface AuditMetaData {
  action: string;
  description?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

export type CreateAuditPayload = {
  actionBy?: string;
  action?: string;
  actionType?: string;
  serviceName?: string;
  description?: string;
  severity?: string;
  requestUrl?: string;
  requestMethod?: string;
  requestActionBy?: string;
  requestModelType?: string;
  requestReference?: string;
  ipAddress?: string;
  actionSuccessful?: boolean;
  responseStatus?: number;
  latencyMs?: number;
  requestData?: any;
  responseData?: any;
};

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

export type AuditMetaData = {
  action?: AuditType;
  description?: string;
  severity?: AuditSeverity;
};

export const AuditTypes = [...new Set(Object.values(AuditType))];
export const AuditSeverities = [...new Set(Object.values(AuditSeverity))];

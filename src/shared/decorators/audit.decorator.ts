import { SetMetadata } from '@nestjs/common';
import { AuditMetaData } from '../interfaces';

export const AUDIT_META_KEY = 'auditMeta';

export const AuditLogMeta = (meta: AuditMetaData) =>
  SetMetadata(AUDIT_META_KEY, meta);

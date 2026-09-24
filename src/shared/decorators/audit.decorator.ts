import { SetMetadata } from '@nestjs/common';
import { AuditMetaData } from '@shared/interfaces';

export const AUDIT_META_KEY = 'AUDIT_META';

export const AuditLogMeta = (meta: AuditMetaData) =>
  SetMetadata(AUDIT_META_KEY, meta);

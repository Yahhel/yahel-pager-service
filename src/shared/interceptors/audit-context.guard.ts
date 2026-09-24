import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import {
  AUDIT_FINISHER_KEY,
  AuditLogRecorder,
  isAuditLogEnabled,
} from './audit-log.recorder';

/** Registered as the first global guard so requests rejected by later guards are still audited. */
@Injectable()
export class AuditContextGuard implements CanActivate {
  constructor(private readonly recorder: AuditLogRecorder) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() === 'http' && isAuditLogEnabled()) {
      const req = context.switchToHttp().getRequest();
      req[AUDIT_FINISHER_KEY] ??= this.recorder.begin(context);
    }
    return true;
  }
}

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_FINISHER_KEY, AuditFinisher } from './audit-log.recorder';

/** Records successful responses; failures are recorded by AllExceptionsFilter. */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const finish: AuditFinisher = http.getRequest()[AUDIT_FINISHER_KEY];
    if (!finish) return next.handle();

    return next
      .handle()
      .pipe(tap((res) => finish(true, http.getResponse().statusCode, res)));
  }
}

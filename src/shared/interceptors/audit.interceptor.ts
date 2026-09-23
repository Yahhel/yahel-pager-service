import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import {
  AuditType,
  ReqType,
  LogLevel,
  CreateAuditPayload,
} from '../interfaces';
import { isMobile, redactRecord } from '../utils';

export const createAuditLogInterceptor = (
  actionType: AuditType,
  action?: string,
): Type<NestInterceptor> => {
  @Injectable()
  class AuditLogInterceptor implements NestInterceptor {
    intercept(
      context: ExecutionContext,
      call$: CallHandler<any>,
    ): Observable<any> | Promise<Observable<any>> {
      const ctx = context.switchToHttp();
      const req = ctx.getRequest();
      const methodName = context.getHandler().name;

      const requestData = {
        body: JSON.stringify(redactRecord(req?.body ?? {})),
        protocol: req.protocol,
        method: req.method,
        traceId: req.traceId ?? 'UNKNOWN',
        ipAddress: req.userIpAddress ?? 'UNKNOWN',
        loggedInUser: req?.headers?.userId || 'UNKNOWN',
        userAgent: req.headers?.['user-agent'] || 'UNKNOWN',
        source: isMobile(req) ? ReqType.MOBILE : ReqType.WEB,
      };

      const newAuditLog = {
        actionBy: req?.headers?.userId ?? req.body?.actionBy ?? actionType,
        actionType,
        action: action ?? `Method '${methodName}' called`,
        requestUrl: `${req.protocol}://${req.headers.host}${req.originalUrl}`,
        requestData: redactRecord(requestData),
        actionSuccessful: false,
        serviceName: process.env.PLATFORM_STARTER_NAME,
        responseData: {},
      };

      return call$.handle().pipe(
        tap((res) => {
          newAuditLog['actionSuccessful'] = true;
          newAuditLog['responseData'] = redactRecord(res ?? {});
          this.saveAuditLog(newAuditLog);
        }),
        catchError((err) => {
          newAuditLog['actionSuccessful'] = false;
          newAuditLog['responseData'] = redactRecord(err.response ?? {});
          this.saveAuditLog(newAuditLog);

          return throwError(() => err);
        }),
      );
    }

    private async saveAuditLog(auditLogData: CreateAuditPayload) {
      try {
        // await createAuditLogs(auditLogData);
      } catch (err) {
        global.dataLogsService.log(
          'SaveAuditLog',
          {
            source: 'SaveAuditLog',
            message: err.message,
            env: process.env.NODE_ENV,
            auditLogData,
            stackTrace: err.stack,
          },
          LogLevel.ERROR,
        );
      }
    }
  }

  return AuditLogInterceptor;
};

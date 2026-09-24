import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Inject,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { randomUUID } from 'crypto';

import { AuditLog } from '../schemas';
import {
  AuditType,
  ReqType,
  LogLevel,
  AuditMetaData,
  AuditSeverity,
} from '../interfaces';
import { isMobile, redactRecord } from '../utils';
import { AuditLogModel } from '@shared/schemas/audit.log.schema';
import { AUDIT_META_KEY } from '@shared/decorators';
import { Reflector } from '@nestjs/core';

export const isAuditLogEnabled = () =>
  process.env.ENABLE_AUDIT_LOG === 'true' ||
  process.env.ENABLE_AUDIT_LOG === '1';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    @Inject(AuditLog.name)
    private readonly auditLogModel: AuditLogModel,
  ) {}

  async intercept(
    context: ExecutionContext,
    call$: CallHandler<any>,
  ): Promise<Observable<any>> {
    const auditMeta = this.reflector.get<AuditMetaData>(
      AUDIT_META_KEY,
      context.getHandler(),
    );
    const start = Date.now();
    const controllerClass = context.getClass();

    const controllerPaths: string[] =
      this.reflector.get<string[]>('path', controllerClass) || [];

    const fullPath = Array.isArray(controllerPaths)
      ? controllerPaths[0]
      : controllerPaths;

    const requestModelType =
      fullPath?.match(/^(?:v\d+\/)?(?:admins\/)?([^/:]+)/)?.[1] || 'unknown';

    const ctx = context.switchToHttp();
    const req = ctx.getRequest();
    const methodName = context.getHandler().name;

    const isLog = isAuditLogEnabled();

    const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;
    const requestReference = randomUUID();
    req.headers.requestReference = requestReference;

    const actionType = auditMeta?.action ?? AuditType.USER;
    const description = auditMeta?.description ?? `${methodName} called`;
    const severity = auditMeta?.severity ?? AuditSeverity.INFO;

    const requestData = {
      body: redactRecord(req?.body ?? {}),
      protocol: req.protocol,
      method: req.method,
      traceId: req.traceId ?? 'UNKNOWN',
      ipAddress: req.userIpAddress ?? 'UNKNOWN',
      loggedInUser: redactRecord(req?.user ?? {}),
      userAgent: req.headers?.['user-agent'] || 'UNKNOWN',
      source: isMobile(req) ? ReqType.MOBILE : ReqType.WEB,
    };

    const newAuditLog = {
      actionBy: req?.user?._id ?? req.body?.actionBy ?? 'UNKNOWN',
      requestActionBy: req?.user?._id ?? req.body?.actionBy ?? 'UNKNOWN',
      requestModelType,
      actionType,
      requestReference,
      description,
      severity,
      action: url,
      requestUrl: url,
      ipAddress: req.userIpAddress,
      requestMethod: req.method,
      requestData: JSON.stringify(redactRecord(requestData)),
      actionSuccessful: false,
      responseData: JSON.stringify({}),
    } as AuditLog;

    return call$.handle().pipe(
      tap((res) => {
        this.finalizeAuditLog(newAuditLog, {
          success: true,
          responseData: res,
          statusCode: ctx.getResponse()?.statusCode ?? 200,
          latencyMs: Date.now() - start,
        });

        if (isLog) this.saveAuditLog(newAuditLog);
      }),
      catchError((err) => {
        const statusCode = err?.status || err?.response?.statusCode || 500;
        const errorSeverity =
          statusCode >= 500
            ? ((auditMeta?.severity as AuditSeverity) ?? AuditSeverity.CRITICAL)
            : undefined;

        // NestJS HttpExceptions carry a safe plain-object `.response` payload,
        // but errors from outbound HTTP clients (axios, etc.) also have a
        // `.response`, and theirs contains the raw Node ClientRequest/
        // IncomingMessage (circular) — only the safe, serializable bits of
        // that get logged, never the raw response object itself.
        const responseData =
          err?.response && typeof err.response === 'object'
            ? (err.response.data ?? err.response.message ?? err.message)
            : err?.message;

        try {
          this.finalizeAuditLog(newAuditLog, {
            success: false,
            responseData,
            statusCode,
            latencyMs: Date.now() - start,
            severity: errorSeverity,
          });
        } catch (auditError) {
          global.dataLogsService?.log(
            'AuditLogInterceptor',
            {
              source: 'AuditLogInterceptor',
              message: 'Failed to finalize audit log for error response',
              error: auditError.message,
            },
            LogLevel.ERROR,
          );
        }

        if (isLog) this.saveAuditLog(newAuditLog);

        return throwError(() => err);
      }),
    );
  }

  private finalizeAuditLog(
    auditLog: AuditLog,
    options: {
      success: boolean;
      responseData: any;
      statusCode: number;
      latencyMs: number;
      severity?: AuditSeverity;
    },
  ): void {
    auditLog.actionSuccessful = options.success;
    auditLog.responseData = JSON.stringify(
      redactRecord(options.responseData ?? {}),
    );
    auditLog.responseStatus = options.statusCode;
    auditLog.latencyMs = options.latencyMs;

    if (options.severity) {
      auditLog.severity = options.severity;
    }
  }

  private async saveAuditLog(auditLogData: AuditLog) {
    try {
      await this.auditLogModel.create(auditLogData);
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

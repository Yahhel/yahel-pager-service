import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AUDIT_META_KEY } from '../decorators';
import {
  ApiReq,
  AuditMetaData,
  AuditSeverity,
  AuditType,
  ReqType,
} from '../interfaces';
import { AuditLog, AuditLogModel } from '../schemas';
import { isMobile, redactRecord, runNextTick } from '../utils';

const MAX_PAYLOAD_LENGTH = 10_000;
const SECURITY_STATUSES = [401, 403, 429];
const SEVERITY_RANK = Object.values(AuditSeverity);

export type AuditFinisher = (
  success: boolean,
  status: number,
  responseData: any,
) => void;

export const AUDIT_FINISHER_KEY = 'auditFinisher';

export const isAuditLogEnabled = () =>
  ['true', '1'].includes(process.env.ENABLE_AUDIT_LOG);

const serializePayload = (data: any) => {
  const json = JSON.stringify(redactRecord(data ?? {}));
  return json.length > MAX_PAYLOAD_LENGTH
    ? `${json.slice(0, MAX_PAYLOAD_LENGTH)}...[TRUNCATED]`
    : json;
};

const resolveSeverity = (status: number, declared = AuditSeverity.INFO) => {
  if (status >= 500) return AuditSeverity.ERROR;
  if (
    SECURITY_STATUSES.includes(status) &&
    SEVERITY_RANK.indexOf(declared) <
      SEVERITY_RANK.indexOf(AuditSeverity.WARNING)
  )
    return AuditSeverity.WARNING;
  return declared;
};

@Injectable()
export class AuditLogRecorder {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AuditLog.name)
    private readonly auditLogModel: AuditLogModel,
  ) {}

  /** Captures route details up front; the returned finisher saves the log once, whichever path completes the request. */
  begin(context: ExecutionContext): AuditFinisher {
    const start = Date.now();
    const req: ApiReq = context.switchToHttp().getRequest();
    const meta =
      this.reflector.get<AuditMetaData>(AUDIT_META_KEY, context.getHandler()) ??
      {};
    const controllerPath: string =
      this.reflector.get(PATH_METADATA, context.getClass()) ?? '';

    const baseLog: Partial<AuditLog> = {
      actionType:
        meta.action ??
        (controllerPath.includes('admins') ? AuditType.ADMIN : AuditType.USER),
      description: meta.description ?? `${context.getHandler().name} called`,
      serviceName: process.env.PLATFORM_STARTER_NAME,
      requestUrl: req.originalUrl,
      requestMethod: req.method,
      requestModelType:
        controllerPath.match(/^v\d+\/(?:admins\/)?([^/:]+)/)?.[1] ?? 'unknown',
      requestReference: randomUUID(),
      ipAddress: req.userIpAddress,
    };

    let finished = false;
    return (success, status, responseData) => {
      if (finished) return;
      finished = true;

      // Read at finish time: the body is parsed and req.user is set by then
      const log: Partial<AuditLog> = {
        ...baseLog,
        traceId: req.traceId,
        actionBy: req.user?._id ?? 'ANONYMOUS',
        requestData: serializePayload({
          body: req.body,
          query: req.query,
          params: req.params,
          userAgent: req.headers?.['user-agent'],
          source: isMobile(req) ? ReqType.MOBILE : ReqType.WEB,
        }),
        actionSuccessful: success,
        responseStatus: status,
        responseData: serializePayload(responseData),
        latencyMs: Date.now() - start,
        severity: resolveSeverity(status, meta.severity),
      };
      runNextTick(() => this.auditLogModel.create(log));
    };
  }
}

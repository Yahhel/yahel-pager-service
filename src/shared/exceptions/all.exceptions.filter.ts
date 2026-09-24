import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiReq, AuditSeverity, AuditType, LogLevel } from '../interfaces';
import { randomUUID } from 'crypto';
import { getIpAddress } from '../utils';
import { isAuditLogEnabled } from '../interceptors/audit.interceptor';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  private static transcribeMessage(message: string, statusCode: HttpStatus) {
    let isTranscribe = false;
    const msgStr = String(message || '');
    if (message && msgStr.indexOf('E11000') > -1) {
      isTranscribe = true;
      const fieldName = message.split('{')[1]?.split(':')?.[0];
      message = `Record already exists for "${fieldName?.trim()}" supplied.`;
    }

    if (
      message &&
      (msgStr.includes('12 bytes or a string of 24 hex characters') ||
        msgStr.includes('Cast to ObjectId'))
    ) {
      isTranscribe = true;
      message = 'Invalid identification provisioned.';
    }

    if (message && msgStr.includes('ECONNREFUSED')) {
      isTranscribe = false;
      statusCode = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Service unavailable due connection failure!';
    }

    return {
      message,
      statusCode: isTranscribe ? HttpStatus.BAD_REQUEST : statusCode,
    };
  }

  // Guard rejections (401/403/429) never reach AuditLogInterceptor, which marks the requests it logs with requestReference
  private static auditRejectedRequest(
    req: ApiReq,
    statusCode: number,
    message: any,
  ) {
    if (!req.route || req.headers.requestReference || !isAuditLogEnabled())
      return;

    const url = `${req.protocol}://${req.headers.host}${req.originalUrl}`;
    global.auditLogService?.create({
      actionBy: req.user?._id ?? 'UNKNOWN',
      requestActionBy: req.user?._id ?? 'UNKNOWN',
      actionType: req.originalUrl.includes('/admins/')
        ? AuditType.ADMIN
        : AuditType.USER,
      serviceName: process.env.PLATFORM_STARTER_NAME,
      action: url,
      requestUrl: url,
      requestMethod: req.method,
      requestModelType:
        req.originalUrl.match(/\/api\/(?:v\d+\/)?(?:admins\/)?([^/?]+)/)?.[1] ||
        'unknown',
      requestReference: randomUUID(),
      description: `Request rejected before reaching the handler: ${message}`,
      severity: statusCode >= 500 ? AuditSeverity.ERROR : AuditSeverity.WARNING,
      actionSuccessful: false,
      responseStatus: statusCode,
      ipAddress: req.userIpAddress,
      requestData: {
        body: req.body,
        method: req.method,
        traceId: req.traceId ?? 'UNKNOWN',
        userAgent: req.headers?.['user-agent'] || 'UNKNOWN',
      },
      responseData: { message },
    });
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req: ApiReq = ctx.getRequest();
    let httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.SERVICE_UNAVAILABLE;

    req.traceId = req.traceId || randomUUID();
    req.userIpAddress = getIpAddress(req);

    const msg =
      (exception as any)?.response?.message ||
      (exception as any)?.message ||
      'UNKNOWN';

    const { message, statusCode } = AllExceptionsFilter.transcribeMessage(
      msg,
      httpStatus,
    );

    httpStatus = statusCode;

    const responseBody = {
      traceId: req.traceId,
      statusCode: httpStatus,
      message,
      timestamp: new Date().toISOString(),
      requestUrl: httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    if ((exception as any)?.response?.validationErrors) {
      responseBody['validationErrors'] = (
        exception as any
      )?.response?.validationErrors;
    }

    AllExceptionsFilter.auditRejectedRequest(req, httpStatus, message);

    global.dataLogsService?.reqResLog(
      req.traceId,
      req,
      {
        ...responseBody,
        data: (exception as any)?.response,
        stack: (exception as any)?.response?.stack || (exception as any)?.stack,
      },
      Date.now(),
      LogLevel.ERROR,
    );
    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}

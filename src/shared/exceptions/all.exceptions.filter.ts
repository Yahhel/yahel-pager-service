import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiReq, LogLevel } from '../interfaces';
import { randomUUID } from 'crypto';
import { getIpAddress } from '../utils';
import { AUDIT_FINISHER_KEY } from '../interceptors/audit-log.recorder';

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

    if ((exception as any)?.response?.restrictions) {
      responseBody['restrictions'] = (exception as any).response.restrictions;
    }

    req[AUDIT_FINISHER_KEY]?.(false, httpStatus, responseBody);

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

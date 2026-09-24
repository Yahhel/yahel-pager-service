import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all.exceptions.filter';

describe('AllExceptionsFilter audit of rejected requests', () => {
  const httpAdapterHost: any = {
    httpAdapter: { reply: jest.fn(), getRequestUrl: (req) => req.originalUrl },
  };
  const filter = new AllExceptionsFilter(httpAdapterHost);
  const hostFor = (req: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({}) }),
    }) as any;
  const buildReq = (overrides = {}) => ({
    protocol: 'http',
    method: 'GET',
    originalUrl: '/api/v1/admins/users',
    headers: { host: 'localhost', 'user-agent': 'jest' },
    connection: {},
    route: { path: '/api/v1/admins/users' },
    user: { _id: 'u1' },
    body: { password: 'Secret#123' },
    ...overrides,
  });

  beforeEach(() => {
    process.env.ENABLE_AUDIT_LOG = 'true';
    global.auditLogService = { create: jest.fn() };
  });

  it('audits a request a guard rejected before the interceptor ran', () => {
    filter.catch(new ForbiddenException('Enable 2FA'), hostFor(buildReq()));

    expect(global.auditLogService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actionBy: 'u1',
        actionType: 'ADMIN',
        requestModelType: 'users',
        responseStatus: 403,
        severity: 'WARNING',
        actionSuccessful: false,
      }),
    );
  });

  it('skips requests the interceptor already audited', () => {
    const req = buildReq();
    req.headers['requestReference'] = 'already-logged';
    filter.catch(new ForbiddenException(), hostFor(req));
    expect(global.auditLogService.create).not.toHaveBeenCalled();
  });

  it('skips unknown routes', () => {
    filter.catch(
      new NotFoundException(),
      hostFor(buildReq({ route: undefined })),
    );
    expect(global.auditLogService.create).not.toHaveBeenCalled();
  });

  it('does nothing when audit logging is disabled', () => {
    process.env.ENABLE_AUDIT_LOG = 'false';
    filter.catch(new ForbiddenException(), hostFor(buildReq()));
    expect(global.auditLogService.create).not.toHaveBeenCalled();
  });
});

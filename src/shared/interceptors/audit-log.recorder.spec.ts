import { Reflector } from '@nestjs/core';
import { AUDIT_META_KEY } from '../decorators';
import { AuditSeverity, AuditType } from '../interfaces';
import { AuditContextGuard } from './audit-context.guard';
import { AUDIT_FINISHER_KEY, AuditLogRecorder } from './audit-log.recorder';

const flushNextTick = () => new Promise((resolve) => setImmediate(resolve));

const contextFor = (req: any, meta?: any, controllerPath = 'v1/auth') => {
  const handler = function login() {
    return null;
  };
  if (meta) Reflect.defineMetadata(AUDIT_META_KEY, meta, handler);
  class Controller {}
  Reflect.defineMetadata('path', controllerPath, Controller);
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
};

describe('AuditLogRecorder', () => {
  let auditLogModel: any;
  let recorder: AuditLogRecorder;
  const req = () => ({
    originalUrl: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'user-agent': 'jest' },
    body: { email: 'ada@test.com', password: 'Secret#123' },
    query: {},
    params: {},
  });

  beforeEach(() => {
    auditLogModel = { create: jest.fn().mockResolvedValue({}) };
    recorder = new AuditLogRecorder(new Reflector(), auditLogModel);
  });

  it('saves exactly once however many times it is finished', async () => {
    const finish = recorder.begin(contextFor(req()));
    finish(false, 401, { message: 'Unauthorized' });
    finish(false, 500, { message: 'again' });
    await flushNextTick();

    expect(auditLogModel.create).toHaveBeenCalledTimes(1);
    expect(auditLogModel.create.mock.calls[0][0]).toMatchObject({
      responseStatus: 401,
      actionSuccessful: false,
    });
  });

  it('uses route metadata and redacts the request body', async () => {
    const finish = recorder.begin(
      contextFor(req(), {
        description: 'User login attempt',
        severity: AuditSeverity.INFO,
      }),
    );
    finish(true, 200, { accessToken: 'secret-token' });
    await flushNextTick();

    const log = auditLogModel.create.mock.calls[0][0];
    expect(log).toMatchObject({
      description: 'User login attempt',
      requestModelType: 'auth',
      actionType: AuditType.USER,
      actionBy: 'ANONYMOUS',
    });
    expect(log.requestData).not.toContain('Secret#123');
    expect(log.responseData).not.toContain('secret-token');
  });

  it('reads the user at finish time so guard-authenticated users are recorded', async () => {
    const request: any = req();
    const finish = recorder.begin(contextFor(request));
    request.user = { _id: 'user-1' };
    finish(true, 200, {});
    await flushNextTick();

    expect(auditLogModel.create.mock.calls[0][0].actionBy).toBe('user-1');
  });

  it.each([
    [401, AuditSeverity.INFO, AuditSeverity.WARNING],
    [403, undefined, AuditSeverity.WARNING],
    [429, AuditSeverity.CRITICAL, AuditSeverity.CRITICAL],
    [400, AuditSeverity.INFO, AuditSeverity.INFO],
    [500, AuditSeverity.INFO, AuditSeverity.ERROR],
  ])(
    'status %s with declared severity %s is logged as %s',
    async (status, declared, expected) => {
      const finish = recorder.begin(
        contextFor(req(), declared ? { severity: declared } : undefined),
      );
      finish(false, status, {});
      await flushNextTick();
      expect(auditLogModel.create.mock.calls[0][0].severity).toBe(expected);
    },
  );

  it('marks admin routes as ADMIN actions', async () => {
    const finish = recorder.begin(
      contextFor(req(), undefined, 'v1/admins/users'),
    );
    finish(true, 200, {});
    await flushNextTick();
    expect(auditLogModel.create.mock.calls[0][0]).toMatchObject({
      actionType: AuditType.ADMIN,
      requestModelType: 'users',
    });
  });
});

describe('AuditContextGuard', () => {
  const originalFlag = process.env.ENABLE_AUDIT_LOG;
  afterEach(() => (process.env.ENABLE_AUDIT_LOG = originalFlag));

  it('attaches a finisher to the request and always allows it through', () => {
    process.env.ENABLE_AUDIT_LOG = 'true';
    const recorder: any = { begin: jest.fn(() => jest.fn()) };
    const request: any = {};

    expect(
      new AuditContextGuard(recorder).canActivate(contextFor(request)),
    ).toBe(true);
    expect(request[AUDIT_FINISHER_KEY]).toBeDefined();
  });

  it('does nothing when audit logging is disabled', () => {
    process.env.ENABLE_AUDIT_LOG = 'false';
    const recorder: any = { begin: jest.fn() };
    const request: any = {};

    expect(
      new AuditContextGuard(recorder).canActivate(contextFor(request)),
    ).toBe(true);
    expect(recorder.begin).not.toHaveBeenCalled();
    expect(request[AUDIT_FINISHER_KEY]).toBeUndefined();
  });
});

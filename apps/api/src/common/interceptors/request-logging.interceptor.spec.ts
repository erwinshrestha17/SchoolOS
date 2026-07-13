import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    logSpy = jest
      .spyOn((interceptor as any).logger, 'log')
      .mockImplementation();
    warnSpy = jest
      .spyOn((interceptor as any).logger, 'warn')
      .mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs successful requests with request, tenant, and user context', (done) => {
    const context = makeContext();
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, handler).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(logSpy.mock.calls[0][0]);
      expect(payload).toEqual(
        expect.objectContaining({
          requestId: 'req-1',
          method: 'GET',
          path: '/api/v1/students',
          statusCode: 200,
          tenantId: 'tenant-1',
          userId: 'user-1',
          durationMs: expect.any(Number),
        }),
      );
      done();
    });
  });

  it('continues to log the actual successful status for a POST request', (done) => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/hr/leaves/leave-1/approve',
      responseStatusCode: 201,
    });
    const handler: CallHandler = { handle: () => of({ status: 'APPROVED' }) };

    interceptor.intercept(context, handler).subscribe(() => {
      const payload = JSON.parse(logSpy.mock.calls[0][0]);
      expect(payload).toEqual(
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/hr/leaves/leave-1/approve',
          statusCode: 201,
        }),
      );
      done();
    });
  });

  it('defaults unknown errors to HTTP 500 instead of the pre-set response status', (done) => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/hr/leaves/leave-1/approve',
      responseStatusCode: 201,
    });
    const error = new Error('Database unavailable');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: (received) => {
        expect(received).toBe(error);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(payload).toEqual(
          expect.objectContaining({
            requestId: 'req-1',
            statusCode: 500,
            error: 'Database unavailable',
          }),
        );
        done();
      },
    });
  });

  it('logs the actual 400 status for a BadRequestException, not the pre-set 201', (done) => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/hr/leaves/leave-1/approve',
      responseStatusCode: 201,
    });
    const error = new BadRequestException(
      'status must be one of the following values: APPROVED, REJECTED',
    );
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        const payload = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(payload.statusCode).toBe(400);
        done();
      },
    });
  });

  it('logs the actual 403 status for a ForbiddenException', (done) => {
    const context = makeContext({ responseStatusCode: 200 });
    const error = new ForbiddenException('Not entitled');
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        const payload = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(payload.statusCode).toBe(403);
        done();
      },
    });
  });

  it('logs the actual 409 status for a ConflictException', (done) => {
    const context = makeContext({
      method: 'POST',
      originalUrl: '/api/v1/hr/leaves/leave-1/reject',
      responseStatusCode: 201,
    });
    const error = new ConflictException(
      'A review note is required when rejecting a leave request',
    );
    const handler: CallHandler = { handle: () => throwError(() => error) };

    interceptor.intercept(context, handler).subscribe({
      error: () => {
        const payload = JSON.parse(warnSpy.mock.calls[0][0]);
        expect(payload.statusCode).toBe(409);
        done();
      },
    });
  });
});

function makeContext(overrides?: {
  method?: string;
  originalUrl?: string;
  responseStatusCode?: number;
}) {
  const request = {
    requestId: 'req-1',
    method: overrides?.method ?? 'GET',
    originalUrl: overrides?.originalUrl ?? '/api/v1/students',
    auth: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      roles: ['school_admin'],
    },
  };
  const response = { statusCode: overrides?.responseStatusCode ?? 200 };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

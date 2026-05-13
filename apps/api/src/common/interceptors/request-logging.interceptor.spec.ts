import { CallHandler, ExecutionContext } from '@nestjs/common';
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

  it('logs failed requests and rethrows the original error', (done) => {
    const context = makeContext();
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
            error: 'Database unavailable',
          }),
        );
        done();
      },
    });
  });
});

function makeContext() {
  const request = {
    requestId: 'req-1',
    method: 'GET',
    originalUrl: '/api/v1/students',
    auth: {
      tenantId: 'tenant-1',
      userId: 'user-1',
      roles: ['school_admin'],
    },
  };
  const response = { statusCode: 200 };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

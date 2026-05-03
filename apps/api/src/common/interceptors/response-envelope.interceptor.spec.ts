import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor';
import { ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { of } from 'rxjs';

describe('ResponseEnvelopeInterceptor', () => {
  let interceptor: ResponseEnvelopeInterceptor;

  beforeEach(() => {
    interceptor = new ResponseEnvelopeInterceptor();
  });

  it('should wrap successful data in an envelope', (done) => {
    const data = { foo: 'bar' };
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    const mockRequest = { requestId: 'test-req-id' };
    const mockResponse = { headersSent: false, statusCode: 200 };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      } as any),
      getHandler: () => ({ name: 'testHandler' } as any),
    };

    interceptor.intercept(mockContext as ExecutionContext, callHandler).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        message: 'Operation successful',
        data,
        timestamp: expect.any(String),
        requestId: 'test-req-id',
      });
      done();
    });
  });

  it('should NOT wrap StreamableFile', (done) => {
    const data = new StreamableFile(Buffer.from('test'));
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    const mockRequest = {};
    const mockResponse = { headersSent: false, statusCode: 200 };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      } as any),
      getHandler: () => ({ name: 'testHandler' } as any),
    };

    interceptor.intercept(mockContext as ExecutionContext, callHandler).subscribe((result) => {
      expect(result).toBeInstanceOf(StreamableFile);
      done();
    });
  });

  it('should NOT wrap if already wrapped', (done) => {
    const data = {
      success: true,
      message: 'Already wrapped',
      data: { bar: 'baz' },
      timestamp: new Date().toISOString(),
    };
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    const mockRequest = {};
    const mockResponse = { headersSent: false, statusCode: 200 };
    const mockContext: Partial<ExecutionContext> = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      } as any),
      getHandler: () => ({ name: 'testHandler' } as any),
    };

    interceptor.intercept(mockContext as ExecutionContext, callHandler).subscribe((result) => {
      expect(result).toEqual(data);
      done();
    });
  });
});

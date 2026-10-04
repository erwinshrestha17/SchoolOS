import { HttpExceptionFilter } from './http-exception.filter';
import {
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  type ArgumentsHost,
} from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('should format HttpException correctly in the envelope', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({
      url: '/test',
      method: 'GET',
      requestId: 'test-id',
    });

    const mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;

    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Forbidden',
        data: null,
        meta: {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'FORBIDDEN',
          path: '/test',
          method: 'GET',
        },
        requestId: 'test-id',
      }),
    );
  });

  it('should handle non-HttpException correctly', () => {
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({
      url: '/test',
      method: 'POST',
      requestId: 'req-123',
    });

    const mockArgumentsHost = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    } as unknown as ArgumentsHost;

    const exception = new Error('Unexpected error');

    filter.catch(exception, mockArgumentsHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error',
        data: null,
        meta: {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'INTERNAL_SERVER_ERROR',
          path: '/test',
          method: 'POST',
        },
        requestId: 'req-123',
      }),
    );
  });

  describe('Phase 7.12: stable reason codes', () => {
    function run(exception: unknown) {
      const json = jest.fn();
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({ status: () => ({ json }) }),
          getRequest: () => ({ url: '/x', method: 'POST', requestId: 'r' }),
        }),
      } as unknown as ArgumentsHost;
      filter.catch(exception, host);
      return json.mock.calls[0][0] as { meta: Record<string, unknown> };
    }

    it('forwards a constant-style code from a structured 4xx exception', () => {
      const body = run(
        new ConflictException({
          code: 'CLOSE_PREVIEW_STALE',
          message: 'Review the preview again before closing.',
        }),
      );
      expect(body.meta.code).toBe('CLOSE_PREVIEW_STALE');
      expect(body.meta.statusCode).toBe(409);
    });

    it('never forwards free text, a non-string or a 5xx code', () => {
      expect(
        run(new ConflictException({ code: 'not a code', message: 'm' })).meta,
      ).not.toHaveProperty('code');
      expect(
        run(new ConflictException({ code: 42, message: 'm' })).meta,
      ).not.toHaveProperty('code');
      expect(
        run(
          new InternalServerErrorException({
            code: 'INTERNAL_DETAIL',
            message: 'm',
          }),
        ).meta,
      ).not.toHaveProperty('code');
      expect(run(new ConflictException('plain')).meta).not.toHaveProperty(
        'code',
      );
    });
  });
});

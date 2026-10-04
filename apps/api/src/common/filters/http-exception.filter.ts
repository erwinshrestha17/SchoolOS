import { staffAttendanceHistoryError } from '../../hr/staff-attendance-history-error';
import { isAuthorizationDenial } from '../../authorization/authorization-denied.exception';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

const STABLE_ERROR_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

/**
 * Phase 7.12: services throw `new ConflictException({ code, message })` with
 * stable reason codes (for example `CLOSE_PREVIEW_STALE`,
 * `LEAVE_REQUEST_STALE`), but the envelope dropped `code`, so HTTP clients
 * could only match on wording. Forward it as `meta.code` for 4xx responses,
 * only when it is a constant-style identifier (never free text, never 5xx).
 */
function stableErrorCode(
  status: number,
  exceptionResponse: string | object | null,
): string | undefined {
  if (status >= 500 || typeof exceptionResponse !== 'object') return undefined;
  const code = (exceptionResponse as { code?: unknown } | null)?.code;
  return typeof code === 'string' && STABLE_ERROR_CODE.test(code)
    ? code
    : undefined;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    exception = staffAttendanceHistoryError(exception) ?? exception;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      status === 500 || !(exception instanceof HttpException)
        ? 'Internal server error'
        : typeof exceptionResponse === 'object' &&
            exceptionResponse !== null &&
            'message' in exceptionResponse
          ? (exceptionResponse as { message: string | string[] }).message
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

    const code = stableErrorCode(status, exceptionResponse);
    const payload = {
      success: false,
      message,
      data: null,
      meta: {
        statusCode: status,
        error:
          typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'error' in exceptionResponse
            ? (exceptionResponse as { error: string }).error
            : HttpStatus[status] || 'Error',
        ...(isAuthorizationDenial(exception)
          ? { reasonCode: exception.decision.reasonCode }
          : {}),
        ...(code ? { code } : {}),
        path: request.url,
        method: request.method,
      },
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    };

    this.logger.error(
      JSON.stringify(
        isAuthorizationDenial(exception)
          ? {
              outcome: exception.decision.outcome,
              reasonCode: exception.decision.reasonCode,
              stage: exception.decision.stage,
              policyId: exception.decision.policyId,
              statusCode: status,
            }
          : {
              ...payload,
              stack: exception instanceof Error ? exception.stack : undefined,
            },
      ),
    );

    response.status(status).json(payload);
  }
}

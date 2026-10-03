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

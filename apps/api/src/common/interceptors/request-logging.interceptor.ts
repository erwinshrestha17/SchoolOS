import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

type RequestWithContext = Request & {
  requestId?: string;
  auth?: {
    userId: string;
    tenantId: string;
    roles: string[];
  };
};

const SLOW_REQUEST_THRESHOLD_MS = 1000;

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const payload = this.buildPayload(request, response, durationMs);

        if (durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
          this.logger.warn(JSON.stringify({ ...payload, slow: true }));
          return;
        }

        this.logger.log(JSON.stringify(payload));
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startedAt;
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;
        this.logger.warn(
          JSON.stringify({
            ...this.buildPayload(request, response, durationMs),
            statusCode,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        );

        return throwError(() => error);
      }),
    );
  }

  private buildPayload(
    request: RequestWithContext,
    response: Response,
    durationMs: number,
  ) {
    return {
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl ?? request.url,
      statusCode: response.statusCode,
      durationMs,
      tenantId: request.auth?.tenantId,
      userId: request.auth?.userId,
    };
  }
}

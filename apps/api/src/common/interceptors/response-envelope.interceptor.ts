import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { requestId?: string }>();
    const response = http.getResponse<Response>();

    // Skip Server-Sent Events (SSE)
    // NestJS marked SSE handlers often return an Observable directly, but we can also check metadata
    const isSse = Reflect.getMetadata('__sse__', context.getHandler());
    if (isSse) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        // Skip if already wrapped (manual wrap in controller)
        if (
          data &&
          typeof data === 'object' &&
          'success' in data &&
          'data' in data &&
          'timestamp' in data
        ) {
          return data;
        }

        // Skip if it's a StreamableFile (PDF, CSV, etc.)
        if (data instanceof StreamableFile) {
          return data;
        }

        // Skip if response has already been sent (e.g. manual res.send)
        if (response.headersSent) {
          return data;
        }

        // Skip for redirects
        if ([301, 302, 307, 308].includes(response.statusCode)) {
          return data;
        }

        // Standard JSON wrap
        return {
          success: true,
          message: 'Operation successful',
          data: data ?? null,
          timestamp: new Date().toISOString(),
          requestId: request.requestId,
        };
      }),
    );
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ClsService } from 'nestjs-cls';
import { REQUEST_ID_KEY } from '../security/cls-keys';
import type { Request } from 'express';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request & { requestId: string }>();
    const requestId = request.requestId;

    if (requestId) {
      this.cls.set(REQUEST_ID_KEY, requestId);
    }

    return next.handle();
  }
}

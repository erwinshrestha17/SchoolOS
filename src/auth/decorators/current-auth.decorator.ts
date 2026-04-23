import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthContext } from '../auth.types';
import { AuthenticatedRequest } from '../auth-request.interface';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.auth;
  },
);

import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type AuthContext } from '../auth.types';
import { type AuthenticatedRequest } from '../auth-request.interface';

export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.auth;
  },
);

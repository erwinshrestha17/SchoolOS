import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AuthorizationDecision } from './authorization.types';

/** Controlled kernel failures; domain exceptions retain their existing contracts. */
export class AuthorizationForbiddenException extends ForbiddenException {
  constructor(
    readonly decision: AuthorizationDecision,
    message: string,
  ) {
    super({ message, reasonCode: decision.reasonCode });
  }
}
export class AuthorizationUnauthorizedException extends UnauthorizedException {
  constructor(
    readonly decision: AuthorizationDecision,
    message: string,
  ) {
    super({ message, reasonCode: decision.reasonCode });
  }
}
export function isAuthorizationDenial(
  error: unknown,
): error is
  | AuthorizationForbiddenException
  | AuthorizationUnauthorizedException {
  return (
    error instanceof AuthorizationForbiddenException ||
    error instanceof AuthorizationUnauthorizedException
  );
}

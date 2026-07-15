import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

// Keep the legacy error code stable for existing clients even though Chat is
// removed from the active product.
export const CHAT_DEFERRED_ERROR = {
  code: 'CHAT_DEFERRED',
  message:
    'Chat and conversations have been removed. Historical records remain available only through authorized read access.',
} as const;

@Injectable()
export class ChatWriteDisabledGuard implements CanActivate {
  canActivate(): never {
    throw new ForbiddenException(CHAT_DEFERRED_ERROR);
  }
}

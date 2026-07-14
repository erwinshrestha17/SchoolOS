import { CanActivate, ForbiddenException, Injectable } from '@nestjs/common';

export const CHAT_DEFERRED_ERROR = {
  code: 'CHAT_DEFERRED',
  message:
    'Chat and conversations are deferred for this release. Historical records remain available only through authorized read access.',
} as const;

@Injectable()
export class ChatWriteDisabledGuard implements CanActivate {
  canActivate(): never {
    throw new ForbiddenException(CHAT_DEFERRED_ERROR);
  }
}

import { ForbiddenException } from '@nestjs/common';
import {
  CHAT_DEFERRED_ERROR,
  ChatWriteDisabledGuard,
} from './chat-write-disabled.guard';

describe('ChatWriteDisabledGuard', () => {
  it('fails closed with a bounded compatibility response', () => {
    const guard = new ChatWriteDisabledGuard();

    expect(() => guard.canActivate()).toThrow(ForbiddenException);
    try {
      guard.canActivate();
    } catch (error) {
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining(CHAT_DEFERRED_ERROR),
      );
    }
  });
});

import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthMethod } from '@prisma/client';
import { firstValueFrom, take } from 'rxjs';
import type { AuthContext } from '../auth/auth.types';
import { MessagingController } from './messaging.controller';

describe('MessagingController', () => {
  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'user@school.test',
    roles: ['parent'],
    permissions: ['messaging:read'],
    authMethod: AuthMethod.PASSWORD,
    tenantSlug: 'green-valley',
  };

  it('streams only a generic tenant-scoped change signal without message content', async () => {
    const eventEmitter = new EventEmitter2();
    const controller = new MessagingController({} as never, eventEmitter);
    const eventPromise = firstValueFrom(
      controller.streamMessages(actor).pipe(take(1)),
    );

    eventEmitter.emit('message.sent', {
      tenantId: 'tenant-other',
      body: 'Other tenant message',
    });
    eventEmitter.emit('message.sent', {
      tenantId: 'tenant-1',
      conversationId: 'conversation-1',
      messageId: 'message-1',
      body: 'Sensitive message body',
      senderUserId: 'staff-user-1',
    });

    await expect(eventPromise).resolves.toEqual({
      data: { type: 'message.sent' },
    });
  });
});

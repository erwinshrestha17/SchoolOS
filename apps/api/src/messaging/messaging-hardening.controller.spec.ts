import type { AuthContext } from '../auth/auth.types';
import { MessagingHardeningController } from './messaging-hardening.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'teacher@school.test',
  roles: ['teacher'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const messagingHardeningService = {
    markMessageRead: jest.fn(),
    markThreadRead: jest.fn(),
    listEscalations: jest.fn(),
  };
  const parentTeacherChatService = {
    resolveEscalation: jest.fn(),
  };

  return {
    controller: new MessagingHardeningController(
      messagingHardeningService as never,
      parentTeacherChatService as never,
    ),
    messagingHardeningService,
    parentTeacherChatService,
  };
}

describe('MessagingHardeningController contracts', () => {
  it('delegates message read receipt through hardening service', () => {
    const { controller, messagingHardeningService } = createController();
    messagingHardeningService.markMessageRead.mockReturnValue({
      id: 'message-1',
      readAt: new Date('2026-05-09T00:00:00.000Z'),
    });

    const result = controller.markMessageRead('message-1', actor);

    expect(messagingHardeningService.markMessageRead).toHaveBeenCalledWith(
      'message-1',
      actor,
    );
    expect(result).toEqual({
      id: 'message-1',
      readAt: new Date('2026-05-09T00:00:00.000Z'),
    });
  });

  it('delegates thread read receipt through hardening service', () => {
    const { controller, messagingHardeningService } = createController();
    messagingHardeningService.markThreadRead.mockReturnValue({ count: 2 });

    const result = controller.markThreadRead('thread-1', actor);

    expect(messagingHardeningService.markThreadRead).toHaveBeenCalledWith(
      'thread-1',
      actor,
    );
    expect(result).toEqual({ count: 2 });
  });

  it('delegates moderation escalation listing and resolution aliases', () => {
    const { controller, messagingHardeningService, parentTeacherChatService } =
      createController();
    messagingHardeningService.listEscalations.mockReturnValue([
      { id: 'escalation-1' },
    ]);
    parentTeacherChatService.resolveEscalation.mockReturnValue({
      status: 'RESOLVED',
    });

    expect(controller.listEscalations(actor)).toEqual([{ id: 'escalation-1' }]);
    expect(controller.resolveEscalation('escalation-1', actor)).toEqual({
      status: 'RESOLVED',
    });
    expect(messagingHardeningService.listEscalations).toHaveBeenCalledWith(
      actor,
    );
    expect(parentTeacherChatService.resolveEscalation).toHaveBeenCalledWith(
      'escalation-1',
      { resolutionNote: 'Resolved by moderator' },
      actor,
    );
  });
});

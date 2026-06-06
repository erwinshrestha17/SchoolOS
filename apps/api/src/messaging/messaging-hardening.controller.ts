import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { MessagingHardeningService } from './messaging-hardening.service';
import { ParentTeacherChatService } from './parent-teacher-chat.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.communications')
export class MessagingHardeningController {
  constructor(
    private readonly messagingHardeningService: MessagingHardeningService,
    private readonly parentTeacherChatService: ParentTeacherChatService,
  ) {}

  @Post('messages/:messageId/read')
  @Permissions('messaging:create')
  markMessageRead(
    @Param('messageId') messageId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.messagingHardeningService.markMessageRead(messageId, auth);
  }

  @Post('threads/:threadId/read')
  @Permissions('messaging:create')
  markThreadRead(
    @Param('threadId') threadId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.messagingHardeningService.markThreadRead(threadId, auth);
  }

  @Get('moderation/escalations')
  @Permissions('messaging:manage')
  listEscalations(@CurrentAuth() auth: AuthContext) {
    return this.messagingHardeningService.listEscalations(auth);
  }

  @Post('moderation/escalations/:escalationId/resolve')
  @Permissions('messaging:manage')
  resolveEscalation(
    @Param('escalationId') escalationId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.parentTeacherChatService.resolveEscalation(
      escalationId,
      { resolutionNote: 'Resolved by moderator' },
      auth,
    );
  }
}

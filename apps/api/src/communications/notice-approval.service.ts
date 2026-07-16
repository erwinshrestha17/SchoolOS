import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ApprovalWorkflowType,
  NoticeLifecycleStatus,
  NoticePriority,
} from '@prisma/client';
import { ApprovalWorkflowService } from '../advanced-operations/approval-workflow.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';
import type { NoticeApprovalRequestDto } from './dto/notice-lifecycle.dto';

const NOTICE_APPROVAL_ACTION = 'communications.notice.publish_high_impact';

@Injectable()
export class NoticeApprovalService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalWorkflowService: ApprovalWorkflowService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  onModuleInit() {
    this.approvalWorkflowService.registerFinalAction(NOTICE_APPROVAL_ACTION, {
      apply: async ({ tenantId, requestId, targetId, payload, actor }) => {
        if (tenantId !== actor.tenantId) {
          throw new NotFoundException('Notice approval was not found');
        }
        await this.communicationsService.markNoticeApproved(
          targetId,
          requestId,
          actor,
        );
        const finalActionPayload = asRecord(payload);
        return this.communicationsService.publishNotice(targetId, actor, {
          scheduledFor:
            typeof finalActionPayload.scheduledFor === 'string'
              ? finalActionPayload.scheduledFor
              : null,
        });
      },
    });
  }

  async requestApproval(
    noticeId: string,
    dto: NoticeApprovalRequestDto,
    actor: AuthContext,
  ) {
    const notice = await this.prisma.notice.findFirst({
      where: { id: noticeId, tenantId: actor.tenantId },
    });
    if (!notice) {
      throw new NotFoundException('Notice not found');
    }
    if (notice.priority === NoticePriority.NORMAL) {
      throw new BadRequestException('This notice does not require approval');
    }
    if (
      notice.lifecycleStatus === NoticeLifecycleStatus.APPROVAL_PENDING &&
      notice.approvalRequestId
    ) {
      return {
        notice,
        approvalRequestId: notice.approvalRequestId,
        replayed: true,
      };
    }
    if (notice.lifecycleStatus !== NoticeLifecycleStatus.DRAFT) {
      throw new ConflictException(
        `Notice cannot request approval from ${notice.lifecycleStatus.toLowerCase()} state`,
      );
    }

    const scheduledFor = dto.scheduledFor
      ? new Date(dto.scheduledFor)
      : null;
    if (scheduledFor && scheduledFor <= new Date()) {
      throw new BadRequestException('Scheduled time must be in the future');
    }

    const recipientPreview =
      await this.communicationsService.previewNoticeRecipients(
        {
          title: notice.title,
          body: notice.body,
          priority: notice.priority,
          audienceType: notice.audienceType,
          classId: notice.classId ?? undefined,
          sectionId: notice.sectionId ?? undefined,
        },
        actor,
      );
    if (recipientPreview.allowedRecipientCount < 1) {
      throw new ConflictException(
        'No eligible recipients are available for this notice',
      );
    }

    const approvalRequest = await this.approvalWorkflowService.createRequest(
      {
        workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
        title: `Notice approval: ${notice.title}`,
        reason: dto.reason.trim(),
        targetModule: 'notices',
        targetType: 'notice',
        targetId: notice.id,
        safeContext: {
          priority: notice.priority,
          audienceType: notice.audienceType,
          recipientCount: recipientPreview.allowedRecipientCount,
          channels: recipientPreview.channels,
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
        finalActionKey: NOTICE_APPROVAL_ACTION,
        finalActionPayload: {
          scheduledFor: scheduledFor?.toISOString() ?? null,
        },
        idempotencyKey: `notice-approval:${notice.id}:${notice.updatedAt.toISOString()}`,
      },
      actor,
    );
    const updated = await this.communicationsService.markNoticeApprovalPending(
      notice.id,
      approvalRequest.id,
      actor,
    );

    return {
      notice: updated,
      approvalRequestId: approvalRequest.id,
      replayed: false,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

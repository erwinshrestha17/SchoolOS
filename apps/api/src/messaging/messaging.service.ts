import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  NotificationStatus,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { isParentOnly } from '../common/security/parent-scope';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { ReadMessageDto } from './dto/read-message.dto';
import { UsageService } from '../usage/usage.service';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
    private readonly usageService: UsageService,
  ) {}

  async listConversations(actor: AuthContext) {
    const conversationScope = await this.buildConversationScopeWhere(actor);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        tenantId: actor.tenantId,
        ...conversationScope,
      },
      include: {
        class: true,
        section: true,
        student: true,
        guardian: true,
        participants: true,
        messages: {
          orderBy: [{ createdAt: 'desc' }],
          take: 3,
          include: {
            readReceipts: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });

    return conversations.map((conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        this.sanitizeMessageAttachment(message),
      ),
    }));
  }

  async createConversation(dto: CreateConversationDto, actor: AuthContext) {
    await this.ensureConversationScope(dto, actor);
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    const conversation = await this.prisma.conversation.create({
      data: {
        tenantId: actor.tenantId,
        type: dto.type,
        title: dto.title ?? null,
        classId: dto.classId ?? null,
        sectionId: dto.sectionId ?? null,
        studentId: dto.studentId ?? null,
        guardianId: dto.guardianId ?? null,
        createdById: actor.userId,
        participants: {
          create: [
            {
              tenantId: actor.tenantId,
              userId: actor.userId,
              staffId: staff?.id ?? null,
              role: 'staff',
            },
            ...(dto.guardianId
              ? [
                  {
                    tenantId: actor.tenantId,
                    guardianId: dto.guardianId,
                    role: 'guardian',
                  },
                ]
              : []),
            ...(dto.studentId
              ? [
                  {
                    tenantId: actor.tenantId,
                    studentId: dto.studentId,
                    role: 'student',
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        participants: true,
        class: true,
        section: true,
        student: true,
        guardian: true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'conversation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: conversation.id,
      after: {
        type: conversation.type,
        classId: conversation.classId,
        guardianId: conversation.guardianId,
      },
    });

    return conversation;
  }

  async listMessages(actor: AuthContext) {
    const conversationScope = await this.buildConversationScopeWhere(actor);
    const messages = await this.prisma.message.findMany({
      where: { tenantId: actor.tenantId, conversation: conversationScope },
      include: {
        conversation: true,
        senderStaff: true,
        senderGuardian: true,
        readReceipts: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return messages.map((message) => this.sanitizeMessageAttachment(message));
  }

  async createMessage(dto: CreateMessageDto, actor: AuthContext) {
    this.assertSafeAttachmentUrl(dto.attachmentUrl);
    const conversationScope = await this.buildConversationScopeWhere(actor);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: dto.conversationId,
        tenantId: actor.tenantId,
        ...conversationScope,
      },
      include: {
        guardian: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found in this tenant');
    }

    if (conversation.guardianId) {
      await this.ensureMessagingConsent(actor, conversation.guardianId);
    }

    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });
    const senderGuardian = isParentOnly(actor)
      ? await this.getGuardianForActor(actor)
      : null;

    // Check usage limit (monthly messages)
    await this.usageService.checkLimit(actor.tenantId, 'messages.sent', 1);

    const message = await this.prisma.message.create({
      data: {
        tenantId: actor.tenantId,
        conversationId: conversation.id,
        senderUserId: actor.userId,
        senderStaffId: staff?.id ?? null,
        senderGuardianId: senderGuardian?.id ?? null,
        body: dto.body,
        attachmentUrl: dto.attachmentUrl ?? null,
      },
      include: {
        conversation: true,
        senderStaff: true,
      },
    });

    await this.usageService.incrementUsage(actor.tenantId, 'messages.sent');

    await this.recordMessageDeliveries(actor, conversation, message);

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    this.eventEmitter.emit('message.sent', {
      tenantId: actor.tenantId,
    });

    return message;
  }

  async getUnreadCount(actor: AuthContext) {
    const conversationScope = await this.buildConversationScopeWhere(actor);
    const guardian = isParentOnly(actor)
      ? await this.getGuardianForActor(actor)
      : null;
    const participations = await this.prisma.conversationParticipant.findMany({
      where: {
        tenantId: actor.tenantId,
        OR: [
          { userId: actor.userId },
          ...(guardian ? [{ guardianId: guardian.id }] : []),
        ],
        conversation: conversationScope,
      },
    });

    let totalUnread = 0;

    for (const participation of participations) {
      const unreadCount = await this.prisma.message.count({
        where: {
          tenantId: actor.tenantId,
          conversationId: participation.conversationId,
          conversation: conversationScope,
          createdAt: {
            gt: participation.lastReadAt ?? new Date(0),
          },
          senderUserId: { not: actor.userId },
        },
      });
      totalUnread += unreadCount;
    }

    return { unreadCount: totalUnread };
  }

  async listReadReceipts(actor: AuthContext) {
    const conversationScope = await this.buildConversationScopeWhere(actor);
    return this.prisma.messageReadReceipt.findMany({
      where: {
        tenantId: actor.tenantId,
        message: { conversation: conversationScope },
      },
      include: {
        message: true,
        guardian: true,
      },
      orderBy: [{ readAt: 'desc' }],
      take: 100,
    });
  }

  async markRead(dto: ReadMessageDto, actor: AuthContext) {
    const conversationScope = await this.buildConversationScopeWhere(actor);
    const message = await this.prisma.message.findFirst({
      where: {
        id: dto.messageId,
        tenantId: actor.tenantId,
        conversation: conversationScope,
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found in this tenant');
    }
    const readerGuardian = isParentOnly(actor)
      ? await this.getGuardianForActor(actor)
      : null;

    const receipt = await this.prisma.messageReadReceipt.create({
      data: {
        tenantId: actor.tenantId,
        messageId: dto.messageId,
        readerUserId: actor.userId,
        guardianId: readerGuardian?.id ?? dto.guardianId ?? null,
      },
      include: {
        message: true,
        guardian: true,
      },
    });

    await this.prisma.message.update({
      where: { id: message.id },
      data: { status: 'READ' },
    });

    await this.prisma.conversationParticipant.updateMany({
      where: {
        tenantId: actor.tenantId,
        conversationId: message.conversationId,
        OR: [
          { userId: actor.userId },
          { guardianId: readerGuardian?.id ?? dto.guardianId },
        ],
      },
      data: { lastReadAt: receipt.readAt },
    });

    return receipt;
  }

  private async ensureConversationScope(
    dto: CreateConversationDto,
    actor: AuthContext,
  ) {
    if (dto.classId) {
      const classroom = await this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      });

      if (!classroom) {
        throw new NotFoundException('Class not found in this tenant');
      }
    }

    if (dto.sectionId) {
      const section = await this.prisma.section.findFirst({
        where: {
          id: dto.sectionId,
          tenantId: actor.tenantId,
          ...(dto.classId ? { classId: dto.classId } : {}),
        },
      });

      if (!section) {
        throw new NotFoundException('Section not found in this tenant');
      }
    }

    if (dto.studentId) {
      const student = await this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
      });

      if (!student) {
        throw new NotFoundException('Student not found in this tenant');
      }
    }

    if (dto.guardianId) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { id: dto.guardianId, tenantId: actor.tenantId },
      });

      if (!guardian) {
        throw new NotFoundException('Guardian not found in this tenant');
      }
    }
  }

  private async ensureMessagingConsent(actor: AuthContext, guardianId: string) {
    const latestConsent = await this.prisma.guardianConsent.findFirst({
      where: {
        tenantId: actor.tenantId,
        guardianId,
        consentType: ConsentType.MESSAGING,
      },
      orderBy: [{ capturedAt: 'desc' }],
    });

    if (latestConsent && !latestConsent.granted) {
      throw new ConflictException('Guardian has revoked messaging consent');
    }
  }

  private async buildConversationScopeWhere(
    actor: AuthContext,
  ): Promise<Prisma.ConversationWhereInput> {
    if (!isParentOnly(actor)) {
      return {};
    }

    const guardian = await this.getGuardianForActor(actor);
    const linkedStudentIds = await this.getLinkedStudentIds(actor, guardian.id);
    const studentScopedConversation: Prisma.ConversationWhereInput[] =
      linkedStudentIds.length > 0
        ? [
            { studentId: { in: linkedStudentIds } },
            {
              guardianId: guardian.id,
              studentId: { in: linkedStudentIds },
            },
            {
              participants: { some: { guardianId: guardian.id } },
              studentId: { in: linkedStudentIds },
            },
          ]
        : [];

    return {
      OR: [
        {
          guardianId: guardian.id,
          studentId: null,
        },
        {
          participants: { some: { guardianId: guardian.id } },
          studentId: null,
        },
        ...studentScopedConversation,
      ],
    };
  }

  private async getGuardianForActor(actor: AuthContext) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
    });

    if (!guardian) {
      throw new ForbiddenException(
        'No guardian profile is linked to this account',
      );
    }

    return guardian;
  }

  private async getLinkedStudentIds(actor: AuthContext, guardianId: string) {
    const links = await this.prisma.studentGuardian.findMany({
      where: { tenantId: actor.tenantId, guardianId },
      select: { studentId: true },
    });

    return links.map((link) => link.studentId);
  }

  private sanitizeMessageAttachment<T extends { attachmentUrl: string | null }>(
    message: T,
  ): T {
    if (this.isSafeAttachmentUrl(message.attachmentUrl)) {
      return message;
    }

    return { ...message, attachmentUrl: null };
  }

  private assertSafeAttachmentUrl(url?: string | null) {
    if (!url || this.isSafeAttachmentUrl(url)) {
      return;
    }

    throw new BadRequestException(
      'Message attachments must use a protected API URL or a signed HTTP(S) URL',
    );
  }

  private isSafeAttachmentUrl(url?: string | null) {
    if (!url) {
      return false;
    }

    if (url.startsWith('/api/') || url.startsWith('/files/')) {
      return true;
    }

    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private async recordMessageDeliveries(
    actor: AuthContext,
    conversation: {
      id: string;
      type: string;
      classId: string | null;
      sectionId: string | null;
      studentId: string | null;
      guardianId: string | null;
    },
    message: { id: string; body: string },
  ) {
    if (conversation.studentId) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'message',
        sourceId: message.id,
        audienceType: AudienceType.ALL,
        studentIds: [conversation.studentId],
        title: 'New SchoolOS message',
        body: message.body,
        channels: [NotificationChannel.PUSH],
      });
      return;
    }

    if (conversation.classId || conversation.sectionId) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'message',
        sourceId: message.id,
        audienceType: conversation.sectionId
          ? AudienceType.SECTION
          : AudienceType.CLASS,
        classId: conversation.classId,
        sectionId: conversation.sectionId,
        title: 'New SchoolOS message',
        body: message.body,
        channels: [NotificationChannel.PUSH],
      });
      return;
    }

    if (conversation.guardianId) {
      const guardian = await this.prisma.guardian.findFirst({
        where: { id: conversation.guardianId, tenantId: actor.tenantId },
      });

      await this.prisma.notificationDelivery.create({
        data: {
          tenantId: actor.tenantId,
          channel: NotificationChannel.PUSH,
          status: NotificationStatus.SENT,
          sourceType: 'message',
          sourceId: message.id,
          audienceType: AudienceType.ALL,
          guardianId: conversation.guardianId,
          recipientUserId: guardian?.userId ?? null,
          destination:
            guardian?.userId ??
            guardian?.primaryPhone ??
            guardian?.email ??
            null,
          title: 'New SchoolOS message',
          body: message.body,
          sentAt: new Date(),
        },
      });
    }
  }
}

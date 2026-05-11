import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ParentTeacherChatService } from './parent-teacher-chat.service';

@Injectable()
export class MessagingHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parentTeacherChatService: ParentTeacherChatService,
  ) {}

  async markMessageRead(messageId: string, actor: AuthContext) {
    const message = await this.parentTeacherChatService.markMessageRead(
      messageId,
      actor,
    );

    await this.recordReadReceipt({
      tenantId: actor.tenantId,
      messageId: message.id,
      threadId: message.threadId,
      userId: actor.userId,
      recipientType: this.resolveRecipientType(actor),
    });

    return message;
  }

  async markThreadRead(threadId: string, actor: AuthContext) {
    const result = await this.parentTeacherChatService.markThreadRead(
      threadId,
      actor,
    );

    const messages = await this.prisma.parentTeacherMessage.findMany({
      where: {
        tenantId: actor.tenantId,
        threadId,
        senderUserId: { not: actor.userId },
      },
      select: { id: true, threadId: true },
      take: 500,
    });

    for (const message of messages) {
      await this.recordReadReceipt({
        tenantId: actor.tenantId,
        messageId: message.id,
        threadId: message.threadId,
        userId: actor.userId,
        recipientType: this.resolveRecipientType(actor),
      });
    }

    return result;
  }

  listEscalations(actor: AuthContext) {
    return this.prisma.chatEscalation.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  private async recordReadReceipt(input: {
    tenantId: string;
    messageId: string;
    threadId: string;
    userId: string;
    recipientType: 'PARENT' | 'TEACHER' | 'ADMIN';
  }) {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "ParentTeacherMessageReadReceipt" (
        "tenantId",
        "messageId",
        "threadId",
        "userId",
        "recipientType",
        "readAt"
      ) VALUES (
        ${input.tenantId},
        ${input.messageId},
        ${input.threadId},
        ${input.userId},
        ${input.recipientType},
        NOW()
      )
      ON CONFLICT ("tenantId", "messageId", "userId")
      DO UPDATE SET "readAt" = EXCLUDED."readAt"
    `);
  }

  private resolveRecipientType(
    actor: AuthContext,
  ): 'PARENT' | 'TEACHER' | 'ADMIN' {
    if (
      actor.roles.some((role) =>
        ['platform_super_admin', 'admin', 'principal'].includes(role),
      )
    ) {
      return 'ADMIN';
    }

    if (
      actor.roles.some((role) => ['teacher', 'subject_teacher'].includes(role))
    ) {
      return 'TEACHER';
    }

    return 'PARENT';
  }
}

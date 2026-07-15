import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NoticeLifecycleStatus, UserStatus } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CommunicationsService } from './communications.service';

@Injectable()
export class NoticeLifecycleCron {
  private readonly logger = new Logger(NoticeLifecycleCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processDueNoticeLifecycle() {
    const now = new Date();
    const tenantRows = await this.prisma.notice.findMany({
      where: {
        tenant: { isActive: true },
        OR: [
          {
            lifecycleStatus: NoticeLifecycleStatus.SCHEDULED,
            publishedAt: null,
            scheduledFor: { lte: now },
          },
          {
            lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
            expiresAt: { lte: now },
          },
        ],
      },
      distinct: ['tenantId'],
      select: { tenantId: true },
    });

    for (const { tenantId } of tenantRows) {
      const actor = await this.resolveSystemActor(tenantId);
      if (!actor) {
        this.logger.warn(
          `Skipping due notice lifecycle for tenant ${tenantId}: no active user`,
        );
        continue;
      }

      try {
        await this.communicationsService.processScheduledNotices(actor);
        await this.communicationsService.processExpiredNotices(actor);
      } catch (error) {
        this.logger.error(
          `Due notice lifecycle failed for tenant ${tenantId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async resolveSystemActor(
    tenantId: string,
  ): Promise<AuthContext | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        tenantId,
        status: UserStatus.ACTIVE,
        tenant: { isActive: true },
      },
      select: {
        id: true,
        email: true,
        authMethod: true,
        tenant: { select: { slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!user) return null;

    return {
      userId: user.id,
      tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      authMethod: user.authMethod,
      roles: ['system'],
      permissions: [],
    };
  }
}

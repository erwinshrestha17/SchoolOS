import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { LibraryHardeningService } from './library-hardening.service';

@Injectable()
export class LibraryCron {
  private readonly logger = new Logger(LibraryCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly libraryHardeningService: LibraryHardeningService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processOverdueNotifications() {
    this.logger.log('Starting daily library overdue notification processing...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
    });

    for (const tenant of tenants) {
      const actorUser = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          status: 'ACTIVE',
        },
        orderBy: [{ createdAt: 'asc' }],
      });

      if (!actorUser) {
        this.logger.warn(
          `Skipping library overdue reminders for tenant ${tenant.slug}: no active user found`,
        );
        continue;
      }

      try {
        const result = await this.libraryHardeningService.sendOverdueRemindersIdempotent({
          userId: actorUser.id,
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          email: actorUser.email,
          authMethod: actorUser.authMethod,
          roles: ['platform_super_admin'],
          permissions: ['library:reports:read'],
        });

        if (result.skipped) {
          this.logger.log(
            `Library overdue reminders skipped for tenant ${tenant.slug} (Already sent today)`,
          );
        } else {
          this.logger.log(
            `Library overdue reminders sent for tenant ${tenant.slug}: ${result.deliveryCount} recipients`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to process library overdue reminders for tenant ${tenant.slug}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

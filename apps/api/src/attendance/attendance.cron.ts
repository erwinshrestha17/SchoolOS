import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

@Injectable()
export class AttendanceCron {
  private readonly logger = new Logger(AttendanceCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async processDailyEscalations() {
    this.logger.log('Starting daily attendance escalation processing...');

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      orderBy: [{ createdAt: 'asc' }],
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
          `Skipping attendance escalations for tenant ${tenant.slug}: no active user found`,
        );
        continue;
      }

      try {
        const result =
          await this.attendanceService.processDailyEscalationWarnings({
            userId: actorUser.id,
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
            email: actorUser.email,
            authMethod: actorUser.authMethod,
            roles: ['platform_super_admin'],
            permissions: [],
          });

        this.logger.log(
          `Attendance escalations processed for tenant ${tenant.slug}: ${result.warningCount} warnings`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process attendance escalations for tenant ${tenant.slug}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}

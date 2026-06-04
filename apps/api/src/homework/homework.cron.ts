import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HomeworkAssignmentStatus, UserStatus } from '@prisma/client';
import { HomeworkReminderType } from './dto/reminder.dto';
import { AuthContext } from '../auth/auth.types';

export interface HomeworkReminderJobData {
  tenantId: string;
  homeworkId: string;
  reminderType: HomeworkReminderType;
  actor: AuthContext;
  force: boolean;
}

@Injectable()
export class HomeworkCron {
  private readonly logger = new Logger(HomeworkCron.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('homework') private readonly homeworkQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM) // Reminders at 8 AM daily
  async processDailyReminders() {
    this.logger.log('Starting daily homework reminder processing...');

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Find homework due soon (within next 24 hours)
    const dueSoonHomework = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenant: { isActive: true },
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: {
          lte: tomorrow,
          gte: now,
        },
      },
    });

    for (const hw of dueSoonHomework) {
      await this.queueReminder(hw, HomeworkReminderType.HOMEWORK_DUE_SOON);
    }

    // 2. Find overdue homework
    const overdueHomework = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenant: { isActive: true },
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: {
          lt: now,
        },
      },
    });

    for (const hw of overdueHomework) {
      await this.queueReminder(hw, HomeworkReminderType.HOMEWORK_OVERDUE);
    }

    this.logger.log(
      `Queued reminders for ${dueSoonHomework.length} due-soon and ${overdueHomework.length} overdue assignments.`,
    );
  }

  private async queueReminder(
    homework: { id: string; tenantId: string },
    reminderType: HomeworkReminderType,
  ) {
    const adminUser = await this.prisma.user.findFirst({
      where: {
        tenantId: homework.tenantId,
        status: UserStatus.ACTIVE,
        tenant: { isActive: true },
        userRoles: {
          some: {
            tenantId: homework.tenantId,
            role: { name: { in: ['admin', 'principal'] } },
          },
        },
      },
      include: {
        tenant: { select: { slug: true } },
        userRoles: {
          where: { tenantId: homework.tenantId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!adminUser) {
      this.logger.warn(
        `Skipping ${reminderType} for homework ${homework.id}: active tenant admin/principal not found`,
      );
      return;
    }

    const actorPayload: AuthContext = {
      userId: adminUser.id,
      tenantId: homework.tenantId,
      tenantSlug: adminUser.tenant.slug,
      email: adminUser.email,
      authMethod: adminUser.authMethod,
      roles: adminUser.userRoles.map((userRole) => userRole.role.name),
      permissions: adminUser.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map(
          ({ permission }) => `${permission.resource}:${permission.action}`,
        ),
      ),
    };

    await this.homeworkQueue.add(
      'sendReminder',
      {
        tenantId: homework.tenantId,
        homeworkId: homework.id,
        reminderType,
        actor: actorPayload,
        force: false,
      },
      {
        jobId: `${homework.id}:${reminderType}:${new Date().toISOString().split('T')[0]}`,
        removeOnComplete: true,
      },
    );
  }
}

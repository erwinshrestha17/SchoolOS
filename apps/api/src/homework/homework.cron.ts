import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { HomeworkAssignmentStatus, AuthMethod } from '@prisma/client';
import { HomeworkReminderType } from './dto/reminder.dto';

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

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // 1. Find homework due soon (within next 24 hours)
    const dueSoonHomework = await this.prisma.homeworkAssignment.findMany({
      where: {
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: {
          lte: tomorrow,
          gte: new Date(),
        },
      },
    });

    for (const hw of dueSoonHomework) {
      await this.queueReminder(hw, HomeworkReminderType.HOMEWORK_DUE_SOON);
    }

    // 2. Find overdue homework
    const overdueHomework = await this.prisma.homeworkAssignment.findMany({
      where: {
        status: HomeworkAssignmentStatus.ASSIGNED,
        dueDate: {
          lt: new Date(),
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
    homework: any,
    reminderType: HomeworkReminderType,
  ) {
    const adminUser = await this.prisma.user.findFirst({
      where: {
        tenantId: homework.tenantId,
        userRoles: { some: { role: { name: 'admin' } } },
      },
    });

    if (!adminUser) return;

    const actor = {
      userId: adminUser.id,
      tenantId: homework.tenantId,
      tenantSlug: 'system',
      email: adminUser.email,
      authMethod: AuthMethod.PASSWORD,
      roles: ['admin'],
      permissions: ['homework:manage'],
    };

    await this.homeworkQueue.add(
      'sendReminder',
      {
        tenantId: homework.tenantId,
        homeworkId: homework.id,
        reminderType,
        actor,
        force: false,
      },
      {
        jobId: `${homework.id}:${reminderType}:${new Date().toISOString().split('T')[0]}`,
        removeOnComplete: true,
      },
    );
  }
}

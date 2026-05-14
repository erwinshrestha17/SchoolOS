import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { AuthMethod } from '@prisma/client';
import { Job } from 'bullmq';
import { HomeworkService } from './homework.service';
import { HomeworkReminderJobData } from './homework.cron';
import { AuthContext } from '../auth/auth.types';

@Processor('homework')
export class HomeworkProcessor extends WorkerHost {
  private readonly logger = new Logger(HomeworkProcessor.name);

  constructor(private readonly homeworkService: HomeworkService) {
    super();
  }

  async process(job: Job<HomeworkReminderJobData, void>): Promise<void> {
    const {
      tenantId,
      homeworkId,
      reminderType,
      actor: actorPayload,
      force,
    } = job.data;

    this.logger.log(
      `Processing homework reminder: ${reminderType} for homework ${homeworkId} (tenant: ${tenantId})`,
    );

    try {
      // Reconstruct minimal actor for system-triggered reminder
      const actor: AuthContext = {
        ...actorPayload,
        tenantSlug: 'system',
        authMethod: AuthMethod.PASSWORD,
        roles: ['admin'],
        permissions: ['homework:manage'],
      };

      await this.homeworkService.sendHomeworkReminder(
        homeworkId,
        { reminderType, force },
        actor,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process homework reminder ${reminderType} for ${homeworkId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }
}

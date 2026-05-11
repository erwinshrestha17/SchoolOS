import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { HomeworkService } from './homework.service';
import { HomeworkReminderType } from './dto/reminder.dto';

@Processor('homework')
export class HomeworkProcessor extends WorkerHost {
  private readonly logger = new Logger(HomeworkProcessor.name);

  constructor(private readonly homeworkService: HomeworkService) {
    super();
  }

  async process(job: Job<any, void>): Promise<void> {
    const { tenantId, homeworkId, reminderType, actor, force } = job.data;
    
    this.logger.log(
      `Processing homework reminder: ${reminderType} for homework ${homeworkId} (tenant: ${tenantId})`,
    );

    try {
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

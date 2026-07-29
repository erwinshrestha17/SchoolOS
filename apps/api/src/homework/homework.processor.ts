import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';
import { PlansService } from '../plans/plans.service';
import { runTenantScopedJob } from '../plans/processor-tenant.context';
import { HomeworkService } from './homework.service';
import { HomeworkReminderJobData } from './homework.cron';

@Processor('homework')
export class HomeworkProcessor extends WorkerHost {
  private readonly logger = new Logger(HomeworkProcessor.name);

  constructor(
    private readonly homeworkService: HomeworkService,
    private readonly plansService: PlansService,
    private readonly cls: ClsService,
  ) {
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

    await runTenantScopedJob(
      this.cls,
      this.plansService,
      tenantId,
      this.logger,
      `homework reminder ${reminderType}`,
      async () => {
        this.logger.log(
          `Processing homework reminder: ${reminderType} for homework ${homeworkId} (tenant: ${tenantId})`,
        );

        try {
          await this.homeworkService.sendHomeworkReminder(
            homeworkId,
            { reminderType, force },
            actorPayload,
          );
        } catch (error) {
          this.logger.error(
            `Failed to process homework reminder ${reminderType} for ${homeworkId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          throw error;
        }
      },
    );
  }
}

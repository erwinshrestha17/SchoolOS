import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { ReportCardsService } from './report-cards.service';
import type { AuthContext } from '../auth/auth.types';

@Processor('academics')
export class AcademicsProcessor extends WorkerHost {
  private readonly logger = new Logger(AcademicsProcessor.name);

  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly plansService: PlansService,
  ) {
    super();
  }

  async process(
    job: Job<
      {
        tenantId: string;
        academicYearId: string;
        examTermId: string;
        studentIds: string[];
        remarks?: string;
        lock?: boolean;
        actor: AuthContext;
      },
      void
    >,
  ): Promise<void> {
    switch (job.name) {
      case 'batchGenerateReportCards':
        return this.handleBatchGenerateReportCards(job.data);
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleBatchGenerateReportCards(input: {
    tenantId: string;
    academicYearId: string;
    examTermId: string;
    studentIds: string[];
    remarks?: string;
    lock?: boolean;
    actor: AuthContext;
  }) {
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        input.tenantId,
        this.logger,
        'batchGenerateReportCards',
      )
    ) {
      return;
    }

    this.logger.log(
      `Starting batch report-card generation for tenant ${input.tenantId}: studentsCount=${input.studentIds.length}...`,
    );

    const failures: Array<{ studentId: string; message: string }> = [];

    for (const studentId of input.studentIds) {
      try {
        await this.reportCardsService.generateReportCard(
          {
            academicYearId: input.academicYearId,
            examTermId: input.examTermId,
            studentId,
            remarks: input.remarks,
            lock: input.lock,
          },
          input.actor,
        );
      } catch (err) {
        if (isAlreadyGeneratedLockedReportCardError(err)) {
          this.logger.warn(
            `Skipping already generated locked report card for student ${studentId} during batch retry.`,
          );
          continue;
        }

        failures.push({
          studentId,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
        this.logger.error(
          `Failed to generate report card for student ${studentId} in background job:`,
          err,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Report-card batch generation failed for ${failures.length} of ${input.studentIds.length} students: ${failures
          .map((failure) => `${failure.studentId} (${failure.message})`)
          .join(', ')}`,
      );
    }

    this.logger.log(
      `Completed batch report-card generation background job for tenant ${input.tenantId}.`,
    );
  }
}

function isAlreadyGeneratedLockedReportCardError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(
      'Locked report cards cannot be regenerated without a correction workflow',
    )
  );
}

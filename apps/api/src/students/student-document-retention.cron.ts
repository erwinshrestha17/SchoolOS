import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from './students.service';

@Injectable()
export class StudentDocumentRetentionCron {
  private readonly logger = new Logger(StudentDocumentRetentionCron.name);

  constructor(
    private readonly studentsService: StudentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processGeneratedDocumentRetention() {
    try {
      // Both reviews sweep documents for every tenant, so cross-tenant access
      // is declared explicitly rather than relying on an absent tenant context.
      const [retentionResult, expiryResult] =
        await this.prisma.runWithoutTenantScope(
          'student document retention and expiry review across all tenants',
          () =>
            Promise.all([
              this.studentsService.processGeneratedDocumentRetention(),
              this.studentsService.processStudentDocumentExpiryReminders(),
            ]),
        );
      this.logger.log(
        `Generated student document retention review complete: ${retentionResult.markedDocuments} marked, ${retentionResult.eligibleDocuments} eligible.`,
      );
      this.logger.log(
        `Student document expiry reminder review complete: ${expiryResult.remindedDocuments} reminded, ${expiryResult.skippedDocuments} skipped, ${expiryResult.candidateDocuments} candidates.`,
      );
    } catch (error) {
      this.logger.error(
        'Student document retention/expiry review failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

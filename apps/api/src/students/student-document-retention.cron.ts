import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StudentsService } from './students.service';

@Injectable()
export class StudentDocumentRetentionCron {
  private readonly logger = new Logger(StudentDocumentRetentionCron.name);

  constructor(private readonly studentsService: StudentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async processGeneratedDocumentRetention() {
    try {
      const result =
        await this.studentsService.processGeneratedDocumentRetention();
      this.logger.log(
        `Generated student document retention review complete: ${result.markedDocuments} marked, ${result.eligibleDocuments} eligible.`,
      );
    } catch (error) {
      this.logger.error(
        'Generated student document retention review failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

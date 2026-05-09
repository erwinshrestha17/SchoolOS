import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FinanceModule } from '../finance/finance.module';
import { SettingsModule } from '../settings/settings.module';
import { AcademicsController } from './academics.controller';
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService } from './academics.service';
import { AssessmentComponentsService } from './assessment-components.service';
import { CasRecordsService } from './cas-records.service';
import { GradeCalculatorService } from './grade-calculator.service';
import { MarkLockWorkflowService } from './mark-lock-workflow.service';
import { MarksEntryService } from './marks-entry.service';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardsService } from './report-cards.service';
import { ResultPublishingService } from './result-publishing.service';
import {
  SubjectsController,
  TeacherAssignmentsController,
} from './subjects.controller';

@Module({
  imports: [
    AuthModule,
    CommunicationsModule,
    AuditModule,
    FinanceModule,
    SettingsModule,
  ],
  controllers: [
    SubjectsController,
    TeacherAssignmentsController,
    AcademicsController,
  ],
  providers: [
    AcademicsService,
    AcademicsFoundationService,
    AssessmentComponentsService,
    CasRecordsService,
    GradeCalculatorService,
    MarkLockWorkflowService,
    MarksEntryService,
    ReportCardPdfService,
    ReportCardsService,
    ResultPublishingService,
  ],
  exports: [
    AcademicsService,
    AcademicsFoundationService,
    AssessmentComponentsService,
    CasRecordsService,
    GradeCalculatorService,
    MarkLockWorkflowService,
    MarksEntryService,
    ReportCardPdfService,
    ReportCardsService,
    ResultPublishingService,
  ],
})
export class AcademicsModule {}

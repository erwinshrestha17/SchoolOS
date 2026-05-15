import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FinanceModule } from '../finance/finance.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { SettingsModule } from '../settings/settings.module';
import { UsageModule } from '../usage/usage.module';
import { AcademicsController } from './academics.controller';
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService } from './academics.service';
import { AssessmentComponentsService } from './assessment-components.service';
import { CasRecordsService } from './cas-records.service';
import { GradeCalculatorService } from './grade-calculator.service';
import { MarkLockWorkflowService } from './mark-lock-workflow.service';
import { MarksService } from './marks.service';
import { PromotionReadinessService } from './promotion-readiness.service';
import { ReportCardPdfService } from './report-card-pdf.service';
import { ReportCardsService } from './report-cards.service';
import { ResultPublishingService } from './result-publishing.service';
import { ResultsService } from './results.service';
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
    FileRegistryModule,
    SettingsModule,
    UsageModule,
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
    MarksService,
    PromotionReadinessService,
    ReportCardPdfService,
    ReportCardsService,
    ResultPublishingService,
    ResultsService,
  ],
  exports: [
    AcademicsService,
    AcademicsFoundationService,
    AssessmentComponentsService,
    CasRecordsService,
    GradeCalculatorService,
    MarkLockWorkflowService,
    MarksService,
    PromotionReadinessService,
    ReportCardPdfService,
    ReportCardsService,
    ResultPublishingService,
    ResultsService,
  ],
})
export class AcademicsModule {}

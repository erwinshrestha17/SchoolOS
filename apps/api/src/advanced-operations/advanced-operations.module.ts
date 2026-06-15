import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { ApprovalWorkflowController } from './approval-workflow.controller';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { AutomationEngineController } from './automation-engine.controller';
import { AutomationEngineService } from './automation-engine.service';
import { DescriptiveAnalyticsController } from './descriptive-analytics.controller';
import { DescriptiveAnalyticsService } from './descriptive-analytics.service';
import { DocumentTemplateController } from './document-template.controller';
import { DocumentTemplateService } from './document-template.service';
import { DataExportCenterController } from './data-export-center.controller';
import { DataExportCenterService } from './data-export-center.service';
import { AdvancedOperationsProcessor } from './advanced-operations.processor';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    FileRegistryModule,
    BullModule.registerQueue({ name: 'advanced-operations' }),
  ],
  controllers: [
    ApprovalWorkflowController,
    AutomationEngineController,
    DescriptiveAnalyticsController,
    DocumentTemplateController,
    DataExportCenterController,
  ],
  providers: [
    ApprovalWorkflowService,
    AutomationEngineService,
    DescriptiveAnalyticsService,
    DocumentTemplateService,
    DataExportCenterService,
    AdvancedOperationsProcessor,
  ],
  exports: [
    ApprovalWorkflowService,
    AutomationEngineService,
    DescriptiveAnalyticsService,
    DocumentTemplateService,
    DataExportCenterService,
  ],
})
export class AdvancedOperationsModule {}

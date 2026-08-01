import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StorageModule } from '../storage/storage.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingPostingModule } from './accounting-posting.module';
import { AccountingReportsController } from './accounting-reports.controller';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingReportExportsService } from './accounting-report-exports.service';
import { AccountingReportsProcessor } from './accounting-reports.processor';
import { AccountingBankImportJobsService } from './accounting-bank-import-jobs.service';
import { AccountingBankImportProcessor } from './accounting-bank-import.processor';
import { AccountingM9Controller } from './accounting-m9.controller';
import { AccountingM9Service } from './accounting-m9.service';
import { M9TemplateService } from './m9-template.service';
import { AccountingSourceMappingService } from './accounting-source-mapping.service';
import { AccountingBudgetController } from './accounting-budget.controller';
import { AccountingBudgetService } from './accounting-budget.service';
import { AdvancedOperationsModule } from '../advanced-operations/advanced-operations.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    FinanceModule,
    AccountingPostingModule,
    FileRegistryModule,
    StorageModule,
    AdvancedOperationsModule,
    BullModule.registerQueue({
      name: 'accounting-reports',
    }),
    BullModule.registerQueue({
      name: 'accounting-bank-import',
    }),
  ],
  controllers: [
    AccountingController,
    AccountingReportsController,
    AccountingM9Controller,
    AccountingBudgetController,
  ],
  providers: [
    AccountingService,
    AccountingReportsService,
    AccountingReportExportsService,
    AccountingReportsProcessor,
    AccountingBankImportJobsService,
    AccountingBankImportProcessor,
    AccountingM9Service,
    M9TemplateService,
    AccountingSourceMappingService,
    AccountingBudgetService,
  ],
  exports: [
    AccountingService,
    AccountingPostingModule,
    AccountingReportsService,
    AccountingBankImportJobsService,
    AccountingM9Service,
    M9TemplateService,
    AccountingSourceMappingService,
  ],
})
export class AccountingModule {}

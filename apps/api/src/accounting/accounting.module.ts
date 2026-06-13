import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingPostingModule } from './accounting-posting.module';
import { AccountingReportsController } from './accounting-reports.controller';
import { AccountingReportsService } from './accounting-reports.service';
import { AccountingReportExportsService } from './accounting-report-exports.service';
import { AccountingM9Controller } from './accounting-m9.controller';
import { AccountingM9Service } from './accounting-m9.service';
import { M9SourceService } from './m9-source.service';
import { M9TemplateService } from './m9-template.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    FinanceModule,
    AccountingPostingModule,
    FileRegistryModule,
  ],
  controllers: [
    AccountingController,
    AccountingReportsController,
    AccountingM9Controller,
  ],
  providers: [
    AccountingService,
    AccountingReportsService,
    AccountingReportExportsService,
    AccountingM9Service,
    M9SourceService,
    M9TemplateService,
  ],
  exports: [
    AccountingService,
    AccountingPostingModule,
    AccountingReportsService,
    AccountingM9Service,
    M9SourceService,
    M9TemplateService,
  ],
})
export class AccountingModule {}

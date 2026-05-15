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

@Module({
  imports: [
    AuthModule,
    AuditModule,
    FinanceModule,
    AccountingPostingModule,
    FileRegistryModule,
  ],
  controllers: [AccountingController, AccountingReportsController],
  providers: [
    AccountingService,
    AccountingReportsService,
    AccountingReportExportsService,
  ],
  exports: [
    AccountingService,
    AccountingPostingModule,
    AccountingReportsService,
  ],
})
export class AccountingModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { AccountingController } from './accounting.controller';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingService } from './accounting.service';

@Module({
  imports: [AuthModule, AuditModule, FinanceModule],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingPostingService],
  exports: [AccountingService, AccountingPostingService],
})
export class AccountingModule {}

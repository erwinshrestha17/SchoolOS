import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { AccountingPostingModule } from './accounting-posting.module';

@Module({
  imports: [AuthModule, AuditModule, FinanceModule, AccountingPostingModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService, AccountingPostingModule],
})
export class AccountingModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FeesController } from './fees.controller';
import { FinanceService } from './finance.service';
import { LedgerController } from './ledger.controller';
import { PaymentsController } from './payments.controller';
import { ReceiptsController } from './receipts.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    FeesController,
    PaymentsController,
    LedgerController,
    ReceiptsController,
  ],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FeesController } from './fees.controller';
import { FinanceCompatController } from './finance-compat.controller';
import { FinanceCompatService } from './finance-compat.service';
import { FinanceService } from './finance.service';
import { LedgerController } from './ledger.controller';
import { PaymentsController } from './payments.controller';
import { ReceiptsController } from './receipts.controller';

import { BullModule } from '@nestjs/bullmq';
import { FinanceProcessor } from './finance.processor';
import { FinanceCron } from './finance.cron';

import { AccountingPostingModule } from '../accounting/accounting-posting.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    CommunicationsModule,
    AccountingPostingModule,
    BullModule.registerQueue({
      name: 'finance',
    }),
  ],
  controllers: [
    FeesController,
    FinanceCompatController,
    PaymentsController,
    LedgerController,
    ReceiptsController,
  ],
  providers: [
    FinanceService,
    FinanceCompatService,
    FinanceProcessor,
    FinanceCron,
  ],
  exports: [FinanceService, FinanceCompatService],
})
export class FinanceModule {}

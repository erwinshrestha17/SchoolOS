import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FeesController } from './fees.controller';
import { FinanceService } from './finance.service';
import { LedgerController } from './ledger.controller';
import { PaymentsController } from './payments.controller';
import { ReceiptsController } from './receipts.controller';

import { BullModule } from '@nestjs/bullmq';
import { FinanceProcessor } from './finance.processor';
import { FinanceCron } from './finance.cron';

@Module({
  imports: [
    AuthModule, 
    AuditModule, 
    CommunicationsModule,
    BullModule.registerQueue({
      name: 'finance',
    }),
  ],
  controllers: [
    FeesController,
    PaymentsController,
    LedgerController,
    ReceiptsController,
  ],
  providers: [FinanceService, FinanceProcessor, FinanceCron],
  exports: [FinanceService],
})
export class FinanceModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FinanceModule } from '../finance/finance.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StudentsModule } from '../students/students.module';
import { CanteenController } from './canteen.controller';
import { CanteenHardeningService } from './canteen-hardening.service';
import { CanteenService } from './canteen.service';
import { CanteenAlertsProcessor } from './canteen-alerts.processor';
import { CanteenOperationsController } from './canteen-operations.controller';
import { CanteenOperationsService } from './canteen-operations.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    CommunicationsModule,
    StudentsModule,
    FinanceModule,
    BullModule.registerQueue({
      name: 'canteen-alerts',
    }),
  ],
  controllers: [CanteenController, CanteenOperationsController],
  providers: [
    CanteenService,
    CanteenHardeningService,
    CanteenOperationsService,
    CanteenAlertsProcessor,
  ],
  exports: [CanteenService, CanteenHardeningService, CanteenOperationsService],
})
export class CanteenModule {}

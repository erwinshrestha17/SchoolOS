import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StudentsModule } from '../students/students.module';
import { CanteenController } from './canteen.controller';
import { CanteenHardeningService } from './canteen-hardening.service';
import { CanteenService } from './canteen.service';
import { CanteenAlertsProcessor } from './canteen-alerts.processor';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    CommunicationsModule,
    StudentsModule,
    BullModule.registerQueue({
      name: 'canteen-alerts',
    }),
  ],
  controllers: [CanteenController],
  providers: [
    CanteenService,
    CanteenHardeningService,
    CanteenAlertsProcessor,
  ],
  exports: [CanteenService, CanteenHardeningService],
})
export class CanteenModule {}

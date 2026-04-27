import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HrContractsController } from '../hr/hr-contracts.controller';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

import { BullModule } from '@nestjs/bullmq';
import { PayrollProcessor } from './payroll.processor';

@Module({
  imports: [
    AuthModule, 
    AuditModule,
    BullModule.registerQueue({
      name: 'payroll',
    }),
  ],
  controllers: [HrContractsController, PayrollController],
  providers: [PayrollService, PayrollProcessor],
  exports: [PayrollService],
})
export class PayrollModule {}

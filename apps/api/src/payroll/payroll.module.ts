import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HrContractsController } from '../hr/hr-contracts.controller';
import { PayrollController } from './payroll.controller';
import { PayrollProcessor } from './payroll.processor';
import { PayrollSalarySlipService } from './payroll-salary-slip.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    BullModule.registerQueue({
      name: 'payroll',
    }),
  ],
  controllers: [HrContractsController, PayrollController],
  providers: [PayrollService, PayrollSalarySlipService, PayrollProcessor],
  exports: [PayrollService, PayrollSalarySlipService],
})
export class PayrollModule {}

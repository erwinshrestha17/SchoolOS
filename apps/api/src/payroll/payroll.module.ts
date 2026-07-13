import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { HrContractsController } from '../hr/hr-contracts.controller';
import { PayrollController } from './payroll.controller';
import { PayrollProcessor } from './payroll.processor';
import { PayrollReadinessService } from './payroll-readiness.service';
import { PayrollSalarySlipService } from './payroll-salary-slip.service';
import { PayrollService } from './payroll.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    FileRegistryModule,
    BullModule.registerQueue({
      name: 'payroll',
    }),
  ],
  controllers: [HrContractsController, PayrollController],
  providers: [
    PayrollService,
    PayrollReadinessService,
    PayrollSalarySlipService,
    PayrollProcessor,
  ],
  exports: [PayrollService, PayrollReadinessService, PayrollSalarySlipService],
})
export class PayrollModule {}

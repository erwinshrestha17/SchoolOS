import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { HrContractsController } from '../hr/hr-contracts.controller';
import { HrStatutoryMembershipController } from '../hr/hr-statutory-membership.controller';
import { PayrollController } from './payroll.controller';
import { PayrollProcessor } from './payroll.processor';
import { PayrollReadinessService } from './payroll-readiness.service';
import { PayrollSalarySlipService } from './payroll-salary-slip.service';
import { PayrollService } from './payroll.service';
import { StatutoryMembershipService } from './statutory-membership.service';

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
  controllers: [
    HrContractsController,
    HrStatutoryMembershipController,
    PayrollController,
  ],
  providers: [
    PayrollService,
    PayrollReadinessService,
    PayrollSalarySlipService,
    PayrollProcessor,
    StatutoryMembershipService,
  ],
  exports: [
    PayrollService,
    PayrollReadinessService,
    PayrollSalarySlipService,
    StatutoryMembershipService,
  ],
})
export class PayrollModule {}

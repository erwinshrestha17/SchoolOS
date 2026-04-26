import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HrContractsController } from '../hr/hr-contracts.controller';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [HrContractsController, PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}

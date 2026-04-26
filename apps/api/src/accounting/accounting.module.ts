import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AccountingController],
  providers: [AccountingService],
})
export class AccountingModule {}

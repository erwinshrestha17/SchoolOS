import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingPostingService } from './accounting-posting.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [AccountingPostingService],
  exports: [AccountingPostingService],
})
export class AccountingPostingModule {}

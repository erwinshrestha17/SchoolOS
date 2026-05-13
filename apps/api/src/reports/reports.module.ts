import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

import { FinanceModule } from '../finance/finance.module';

import { BullModule } from '@nestjs/bullmq';

import { ReportsProcessor } from './reports.processor';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    FinanceModule,
    BullModule.registerQueue({
      name: 'reports',
    }),
  ],
  providers: [ReportsService, ReportsProcessor],
  controllers: [ReportsController],
  exports: [ReportsService],
})
export class ReportsModule {}

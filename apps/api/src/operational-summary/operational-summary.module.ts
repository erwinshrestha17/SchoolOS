import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  OperationalDashboardSummaryController,
  OperationalMobileSummaryController,
} from './operational-summary.controller';
import { OperationalSummaryService } from './operational-summary.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    OperationalDashboardSummaryController,
    OperationalMobileSummaryController,
  ],
  providers: [OperationalSummaryService],
  exports: [OperationalSummaryService],
})
export class OperationalSummaryModule {}

import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { PlatformModule } from '../platform/platform.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OperationalPlatformSummaryController } from './operational-platform-summary.controller';
import {
  OperationalDashboardSummaryController,
  OperationalMobileSummaryController,
} from './operational-summary.controller';
import { OperationalSummaryService } from './operational-summary.service';

@Module({
  imports: [PrismaModule, PlansModule, PlatformModule],
  controllers: [
    OperationalPlatformSummaryController,
    OperationalDashboardSummaryController,
    OperationalMobileSummaryController,
  ],
  providers: [OperationalSummaryService],
  exports: [OperationalSummaryService],
})
export class OperationalSummaryModule {}

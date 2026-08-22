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
import { PrincipalOperationsSummaryController } from './principal-operations-summary.controller';
import { PrincipalOperationsSummaryService } from './principal-operations-summary.service';
import { TeacherScopeModule } from '../teacher-scope/teacher-scope.module';

@Module({
  imports: [PrismaModule, PlansModule, PlatformModule, TeacherScopeModule],
  controllers: [
    OperationalPlatformSummaryController,
    OperationalDashboardSummaryController,
    OperationalMobileSummaryController,
    PrincipalOperationsSummaryController,
  ],
  providers: [OperationalSummaryService, PrincipalOperationsSummaryService],
  exports: [OperationalSummaryService],
})
export class OperationalSummaryModule {}

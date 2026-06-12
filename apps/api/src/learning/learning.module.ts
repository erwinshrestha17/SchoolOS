import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LearningActivitiesController } from './activities/learning-activities.controller';
import { LearningActivitiesService } from './activities/learning-activities.service';
import { LearningActivityPermissionsService } from './activities/learning-activity-permissions.service';
import { LearningAttemptsController } from './attempts/learning-attempts.controller';
import { LearningAnswerEvaluatorService } from './attempts/learning-answer-evaluator.service';
import { LearningAttemptsService } from './attempts/learning-attempts.service';
import { ParentLearningSummaryController } from './parent-summary/parent-learning-summary.controller';
import { ParentLearningSummaryService } from './parent-summary/parent-learning-summary.service';
import { LearningProgressController } from './progress/learning-progress.controller';
import { LearningProgressService } from './progress/learning-progress.service';
import { LearningSessionAccessService } from './sessions/learning-session-access.service';
import { LearningSessionsController } from './sessions/learning-sessions.controller';
import { LearningSessionsService } from './sessions/learning-sessions.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    LearningActivitiesController,
    LearningSessionsController,
    LearningAttemptsController,
    LearningProgressController,
    ParentLearningSummaryController,
  ],
  providers: [
    LearningActivitiesService,
    LearningActivityPermissionsService,
    LearningSessionsService,
    LearningSessionAccessService,
    LearningAttemptsService,
    LearningAnswerEvaluatorService,
    LearningProgressService,
    ParentLearningSummaryService,
  ],
  exports: [
    LearningActivitiesService,
    LearningSessionsService,
    LearningAttemptsService,
    LearningProgressService,
    ParentLearningSummaryService,
  ],
})
export class LearningModule {}

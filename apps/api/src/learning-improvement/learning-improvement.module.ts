import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LearningImprovementController } from './learning-improvement.controller';
import { LearningImprovementService } from './learning-improvement.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [LearningImprovementController],
  providers: [LearningImprovementService],
  exports: [LearningImprovementService],
})
export class LearningImprovementModule {}

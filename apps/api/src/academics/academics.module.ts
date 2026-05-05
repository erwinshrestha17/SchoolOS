import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { AcademicsController } from './academics.controller';
import { AcademicsFoundationService } from './academics-foundation.service';
import { AcademicsService } from './academics.service';
import {
  SubjectsController,
  TeacherAssignmentsController,
} from './subjects.controller';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule],
  controllers: [
    SubjectsController,
    TeacherAssignmentsController,
    AcademicsController,
  ],
  providers: [AcademicsService, AcademicsFoundationService],
  exports: [AcademicsService, AcademicsFoundationService],
})
export class AcademicsModule {}

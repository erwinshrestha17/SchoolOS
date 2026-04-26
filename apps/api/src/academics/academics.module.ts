import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AcademicsController } from './academics.controller';
import { AcademicsService } from './academics.service';
import {
  SubjectsController,
  TeacherAssignmentsController,
} from './subjects.controller';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [
    SubjectsController,
    TeacherAssignmentsController,
    AcademicsController,
  ],
  providers: [AcademicsService],
  exports: [AcademicsService],
})
export class AcademicsModule {}

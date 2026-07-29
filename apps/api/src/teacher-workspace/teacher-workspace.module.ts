import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { HomeworkModule } from '../homework/homework.module';
import { TimetableModule } from '../timetable/timetable.module';
import { TeacherTodayService } from './teacher-today.service';
import { TeacherTodayController } from './teacher-today.controller';
import { TeacherStudentsService } from './teacher-students.service';
import { TeacherStudentsController } from './teacher-students.controller';
import { TeacherScheduleController } from './teacher-schedule.controller';
import { HomeroomSummaryController } from './homeroom-summary.controller';
import { HomeroomSummaryService } from './homeroom-summary.service';
import {
  TeacherAssignmentsController,
  TeacherAssignmentsService,
} from './teacher-assignments.controller';
import { TeacherScopeModule } from '../teacher-scope/teacher-scope.module';
import { TeacherWorkspaceModuleResolver } from './teacher-workspace-modules';

@Module({
  imports: [
    PrismaModule,
    AttendanceModule,
    HomeworkModule,
    TimetableModule,
    TeacherScopeModule,
  ],
  controllers: [
    TeacherTodayController,
    TeacherStudentsController,
    TeacherScheduleController,
    HomeroomSummaryController,
    TeacherAssignmentsController,
  ],
  providers: [
    TeacherTodayService,
    TeacherStudentsService,
    HomeroomSummaryService,
    TeacherAssignmentsService,
    TeacherWorkspaceModuleResolver,
  ],
  exports: [
    TeacherTodayService,
    TeacherStudentsService,
    HomeroomSummaryService,
  ],
})
export class TeacherWorkspaceModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { HomeworkModule } from '../homework/homework.module';
import { TimetableModule } from '../timetable/timetable.module';
import { TeacherTodayService } from './teacher-today.service';
import { TeacherTodayController } from './teacher-today.controller';
import { TeacherStudentsService } from './teacher-students.service';
import { TeacherStudentsController } from './teacher-students.controller';

@Module({
  imports: [PrismaModule, AttendanceModule, HomeworkModule, TimetableModule],
  controllers: [TeacherTodayController, TeacherStudentsController],
  providers: [TeacherTodayService, TeacherStudentsService],
  exports: [TeacherTodayService, TeacherStudentsService],
})
export class TeacherWorkspaceModule {}

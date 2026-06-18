import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileTeacherAttendanceController } from './mobile-teacher-attendance.controller';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';
import { AcademicsModule } from '../academics/academics.module';
import { CommunicationsModule } from '../communications/communications.module';
import { HomeworkModule } from '../homework/homework.module';

@Module({
  imports: [
    PrismaModule,
    AttendanceModule,
    FinanceModule,
    AcademicsModule,
    CommunicationsModule,
    HomeworkModule,
  ],
  controllers: [MobileController, MobileTeacherAttendanceController],
  providers: [MobileService],
})
export class MobileModule {}

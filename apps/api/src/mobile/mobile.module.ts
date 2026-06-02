import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileTeacherAttendanceController } from './mobile-teacher-attendance.controller';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [PrismaModule, AttendanceModule, FinanceModule],
  controllers: [MobileController, MobileTeacherAttendanceController],
  providers: [MobileService],
})
export class MobileModule {}

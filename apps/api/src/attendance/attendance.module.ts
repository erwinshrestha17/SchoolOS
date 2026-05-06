import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { AttendanceCron } from './attendance.cron';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HrAttendanceController } from './hr-attendance.controller';

@Module({
  imports: [AuthModule, AuditModule, CommunicationsModule],
  controllers: [AttendanceController, HrAttendanceController],
  providers: [AttendanceService, AttendanceCron],
})
export class AttendanceModule {}

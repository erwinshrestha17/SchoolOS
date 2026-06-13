import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { SettingsModule } from '../settings/settings.module';
import { AttendanceCron } from './attendance.cron';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { HrAttendanceController } from './hr-attendance.controller';
import { HrLeaveQueueController } from './hr-leave-queue.controller';
import { StaffLeaveQueueService } from './staff-leave-queue.service';
import { StaffSelfServiceController } from './staff-self-service.controller';
import { StaffSelfServiceService } from './staff-self-service.service';
import { StaffTimeClockService } from './staff-time-clock.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    CommunicationsModule,
    SettingsModule,
    FileRegistryModule,
  ],
  controllers: [
    AttendanceController,
    HrAttendanceController,
    HrLeaveQueueController,
    StaffSelfServiceController,
  ],
  providers: [
    AttendanceService,
    AttendanceCron,
    StaffLeaveQueueService,
    StaffSelfServiceService,
    StaffTimeClockService,
  ],
  exports: [AttendanceService, StaffSelfServiceService, StaffTimeClockService],
})
export class AttendanceModule {}

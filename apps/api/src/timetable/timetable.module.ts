import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { TimetableConflictService } from './timetable-conflict.service';
import { TimetableController } from './timetable.controller';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import { TimetableService } from './timetable.service';

import { TimetableSubstitutionService } from './timetable-substitution.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule, AttendanceModule],
  controllers: [TimetableController],
  providers: [
    TimetableService,
    TimetableConflictService,
    TimetableLifecycleService,
    TimetableSubstitutionService,
  ],
  exports: [
    TimetableService,
    TimetableConflictService,
    TimetableLifecycleService,
    TimetableSubstitutionService,
  ],
})
export class TimetableModule {}

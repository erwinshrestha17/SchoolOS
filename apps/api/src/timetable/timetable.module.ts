import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { TimetableConflictService } from './timetable-conflict.service';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule],
  controllers: [TimetableController],
  providers: [TimetableService, TimetableConflictService],
  exports: [TimetableService, TimetableConflictService],
})
export class TimetableModule {}

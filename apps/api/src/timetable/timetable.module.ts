import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { HomeworkController } from './homework.controller';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule],
  controllers: [TimetableController, HomeworkController],
  providers: [TimetableService],
})
export class TimetableModule {}

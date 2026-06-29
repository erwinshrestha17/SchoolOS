import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileTeacherAttendanceController } from './mobile-teacher-attendance.controller';
import { MobileTeacherHomeworkController } from './mobile-teacher-homework.controller';
import { MobileTeacherStudentsController } from './mobile-teacher-students.controller';
import { MobileTeacherTimetableController } from './mobile-teacher-timetable.controller';
import { MobilePrincipalController } from './mobile-principal.controller';
import { MobilePrincipalService } from './mobile-principal.service';
import { MobileController } from './mobile.controller';
import { MobileService } from './mobile.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';
import { AcademicsModule } from '../academics/academics.module';
import { CommunicationsModule } from '../communications/communications.module';
import { HomeworkModule } from '../homework/homework.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StorageModule } from '../storage/storage.module';
import { CanteenModule } from '../canteen/canteen.module';
import { TimetableModule } from '../timetable/timetable.module';
import { AdvancedOperationsModule } from '../advanced-operations/advanced-operations.module';
import { ActivityFeedModule } from '../activity-feed/activity-feed.module';
import { MobileTeacherActivityController } from './mobile-teacher-activity.controller';

@Module({
  imports: [
    PrismaModule,
    AttendanceModule,
    FinanceModule,
    AcademicsModule,
    CommunicationsModule,
    HomeworkModule,
    FileRegistryModule,
    StorageModule,
    CanteenModule,
    TimetableModule,
    AdvancedOperationsModule,
    ActivityFeedModule,
  ],
  controllers: [
    MobileController,
    MobileTeacherAttendanceController,
    MobileTeacherActivityController,
    MobileTeacherHomeworkController,
    MobileTeacherStudentsController,
    MobileTeacherTimetableController,
    MobilePrincipalController,
  ],
  providers: [MobileService, MobilePrincipalService],
})
export class MobileModule {}

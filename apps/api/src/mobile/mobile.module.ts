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
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StorageModule } from '../storage/storage.module';
import { CanteenModule } from '../canteen/canteen.module';

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
  ],
  controllers: [MobileController, MobileTeacherAttendanceController],
  providers: [MobileService],
})
export class MobileModule {}

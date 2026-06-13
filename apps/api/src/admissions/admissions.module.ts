import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StudentRecordsModule } from '../student-records/student-records.module';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { M1AdmissionsHardeningController } from './m1-admissions-hardening.controller';
import { M1AdmissionsHardeningService } from './m1-admissions-hardening.service';
import { UsageModule } from '../usage/usage.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    NotificationsModule,
    FinanceModule,
    StudentRecordsModule,
    StudentsModule,
    AuditModule,
    StorageModule,
    FileRegistryModule,
    UsageModule,
  ],
  controllers: [AdmissionsController, M1AdmissionsHardeningController],
  providers: [AdmissionsService, M1AdmissionsHardeningService],
})
export class AdmissionsModule {}

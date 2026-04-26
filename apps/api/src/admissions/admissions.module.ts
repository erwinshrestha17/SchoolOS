import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentRecordsModule } from '../student-records/student-records.module';
import { UsersModule } from '../users/users.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    NotificationsModule,
    FinanceModule,
    StudentRecordsModule,
    AuditModule,
  ],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
})
export class AdmissionsModule {}

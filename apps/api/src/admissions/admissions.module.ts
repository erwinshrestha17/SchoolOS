import { Module } from '@nestjs/common';
import { AdvancedOperationsModule } from '../advanced-operations/advanced-operations.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StudentRecordsModule } from '../student-records/student-records.module';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';
import { AdmissionCaseFollowUpsController } from './admission-case-follow-ups.controller';
import { AdmissionCaseFollowUpsService } from './admission-case-follow-ups.service';
import { AdmissionCaseQueuesController } from './admission-case-queues.controller';
import { AdmissionCaseQueuesService } from './admission-case-queues.service';
import { AdmissionCasesController } from './admission-cases.controller';
import { AdmissionCasesService } from './admission-cases.service';
import { AdmissionPolicyController } from './admission-policy.controller';
import { AdmissionPolicyService } from './admission-policy.service';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { M1AdmissionsHardeningController } from './m1-admissions-hardening.controller';
import { M1AdmissionsHardeningService } from './m1-admissions-hardening.service';
import { MobileAdmissionsSummaryController } from './mobile-admissions-summary.controller';
import { MobileAdmissionsSummaryService } from './mobile-admissions-summary.service';
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
    AdvancedOperationsModule,
  ],
  controllers: [
    AdmissionsController,
    AdmissionCasesController,
    AdmissionPolicyController,
    AdmissionCaseQueuesController,
    AdmissionCaseFollowUpsController,
    MobileAdmissionsSummaryController,
    M1AdmissionsHardeningController,
  ],
  providers: [
    AdmissionsService,
    AdmissionCasesService,
    AdmissionPolicyService,
    AdmissionCaseQueuesService,
    AdmissionCaseFollowUpsService,
    MobileAdmissionsSummaryService,
    M1AdmissionsHardeningService,
  ],
})
export class AdmissionsModule {}

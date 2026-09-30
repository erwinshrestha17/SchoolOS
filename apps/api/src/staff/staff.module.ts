import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { HrStaffController } from './hr-staff.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffDocumentService } from './staff-document.service';
import { StaffLifecycleService } from './staff-lifecycle.service';
import { StaffLeaveAccrualService } from '../hr/staff-leave-accrual.service';
import { HrCoverageController } from '../hr/hr-coverage.controller';
import { HrCoverageService } from '../hr/hr-coverage.service';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { UsageModule } from '../usage/usage.module';
import { AddressModule } from '../addresses/address.module';
import { TeacherScopeModule } from '../teacher-scope/teacher-scope.module';
import {
  HrProfessionalIdentityController,
  HrProfessionalReportsController,
} from '../hr/hr-professional-identity.controller';
import { ProfessionalIdentityService } from '../hr/professional-identity.service';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AuditModule,
    FileRegistryModule,
    UsageModule,
    AddressModule,
    TeacherScopeModule,
  ],
  providers: [
    StaffService,
    StaffDocumentService,
    StaffLifecycleService,
    StaffLeaveAccrualService,
    HrCoverageService,
    ProfessionalIdentityService,
  ],
  controllers: [
    StaffController,
    HrStaffController,
    HrCoverageController,
    HrProfessionalIdentityController,
    HrProfessionalReportsController,
  ],
  exports: [
    StaffService,
    StaffDocumentService,
    StaffLifecycleService,
    StaffLeaveAccrualService,
    HrCoverageService,
  ],
})
export class StaffModule {}

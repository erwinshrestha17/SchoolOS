import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { HrStaffController } from './hr-staff.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffDocumentService } from './staff-document.service';
import { StaffLifecycleService } from './staff-lifecycle.service';
import { FileRegistryModule } from '../file-registry/file-registry.module';

@Module({
  imports: [AuthModule, UsersModule, AuditModule, FileRegistryModule],
  providers: [StaffService, StaffDocumentService, StaffLifecycleService],
  controllers: [StaffController, HrStaffController],
  exports: [StaffService, StaffDocumentService, StaffLifecycleService],
})
export class StaffModule {}

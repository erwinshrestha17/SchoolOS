import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TeacherScopeService } from './teacher-scope.service';
import { TeacherProfessionalEligibilityService } from './teacher-professional-eligibility.service';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [TeacherScopeService, TeacherProfessionalEligibilityService],
  exports: [TeacherScopeService, TeacherProfessionalEligibilityService],
})
export class TeacherScopeModule {}

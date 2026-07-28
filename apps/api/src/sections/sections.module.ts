import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SectionsController } from './sections.controller';
import { SectionsService } from './sections.service';
import { TeacherScopeModule } from '../teacher-scope/teacher-scope.module';

@Module({
  imports: [AuthModule, AuditModule, TeacherScopeModule],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}

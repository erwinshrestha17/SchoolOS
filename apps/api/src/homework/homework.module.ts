import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { HomeworkAttachmentAccessService } from './homework-attachment-access.service';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';

@Module({
  imports: [AuthModule, CommunicationsModule, AuditModule, FileRegistryModule],
  controllers: [HomeworkController],
  providers: [HomeworkService, HomeworkAttachmentAccessService],
  exports: [HomeworkService, HomeworkAttachmentAccessService],
})
export class HomeworkModule {}

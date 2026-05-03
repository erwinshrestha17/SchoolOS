import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { UsersModule } from '../users/users.module';
import { StudentDocumentRetentionCron } from './student-document-retention.cron';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    CommunicationsModule,
    AuditModule,
    StorageModule,
    FileRegistryModule,
  ],
  providers: [StudentsService, StudentDocumentRetentionCron],
  controllers: [StudentsController],
  exports: [StudentsService],
})
export class StudentsModule {}

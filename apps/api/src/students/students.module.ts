import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { UsersModule } from '../users/users.module';
import { StudentDocumentRetentionCron } from './student-document-retention.cron';
import { StudentPhotoController } from './student-photo.controller';
import { StudentPhotoService } from './student-photo.service';
import { StudentSearchController } from './student-search.controller';
import { StudentSearchService } from './student-search.service';
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
  providers: [
    StudentsService,
    StudentSearchService,
    StudentPhotoService,
    StudentDocumentRetentionCron,
  ],
  controllers: [
    StudentSearchController,
    StudentsController,
    StudentPhotoController,
  ],
  exports: [StudentsService, StudentSearchService, StudentPhotoService],
})
export class StudentsModule {}

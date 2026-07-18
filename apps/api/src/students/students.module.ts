import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { UsersModule } from '../users/users.module';
import { UsageModule } from '../usage/usage.module';
import { StudentDocumentAccessController } from './student-document-access.controller';
import { StudentDocumentAccessService } from './student-document-access.service';
import { StudentDocumentRetentionCron } from './student-document-retention.cron';
import { StudentDuplicateReviewService } from './student-duplicate-review.service';
import { StudentPhotoController } from './student-photo.controller';
import { StudentPhotoService } from './student-photo.service';
import { StudentSearchController } from './student-search.controller';
import { StudentSearchService } from './student-search.service';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';
import { StudentQrService } from './student-qr.service';
import { StudentQrController } from './student-qr.controller';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    CommunicationsModule,
    NotificationsModule,
    AuditModule,
    StorageModule,
    FileRegistryModule,
    UsageModule,
  ],
  providers: [
    StudentsService,
    StudentSearchService,
    StudentPhotoService,
    StudentDocumentAccessService,
    StudentDocumentRetentionCron,
    StudentDuplicateReviewService,
    StudentQrService,
  ],
  controllers: [
    StudentSearchController,
    StudentsController,
    StudentPhotoController,
    StudentDocumentAccessController,
    StudentQrController,
  ],
  exports: [
    StudentsService,
    StudentSearchService,
    StudentPhotoService,
    StudentDocumentAccessService,
    StudentDuplicateReviewService,
    StudentQrService,
  ],
})
export class StudentsModule {}

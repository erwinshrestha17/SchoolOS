import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { SiblingsController } from './siblings.controller';
import { StudentDocumentsController } from './student-documents.controller';
import { StudentRecordsService } from './student-records.service';

@Module({
  imports: [AuthModule, AuditModule, StorageModule, FileRegistryModule],
  controllers: [StudentDocumentsController, SiblingsController],
  providers: [StudentRecordsService],
  exports: [StudentRecordsService],
})
export class StudentRecordsModule {}

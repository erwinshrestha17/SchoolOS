import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommunicationsModule } from '../communications/communications.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { StudentsModule } from '../students/students.module';
import { LibraryController } from './library.controller';
import { LibraryHardeningService } from './library-hardening.service';
import { LibraryService } from './library.service';
import { LibraryCron } from './library.cron';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    CommunicationsModule,
    FileRegistryModule,
    StudentsModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService, LibraryHardeningService, LibraryCron],
  exports: [LibraryService, LibraryHardeningService],
})
export class LibraryModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AccountingModule } from '../accounting/accounting.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StudentsModule } from '../students/students.module';
import { LibraryController } from './library.controller';
import { LibraryHardeningService } from './library-hardening.service';
import { LibraryService } from './library.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    AccountingModule,
    CommunicationsModule,
    StudentsModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService, LibraryHardeningService],
  exports: [LibraryService, LibraryHardeningService],
})
export class LibraryModule {}

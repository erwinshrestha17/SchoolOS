import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { LibraryController } from './library.controller';
import { LibraryHardeningService } from './library-hardening.service';
import { LibraryService } from './library.service';

@Module({
  imports: [AuthModule, AuditModule, CommunicationsModule],
  controllers: [LibraryController],
  providers: [LibraryService, LibraryHardeningService],
  exports: [LibraryService, LibraryHardeningService],
})
export class LibraryModule {}

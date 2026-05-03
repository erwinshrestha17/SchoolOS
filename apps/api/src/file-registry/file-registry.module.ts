import { Module } from '@nestjs/common';
import { FileRegistryService } from './file-registry.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [FileRegistryService],
  exports: [FileRegistryService],
})
export class FileRegistryModule {}

import { Module } from '@nestjs/common';
import { FileRegistryService } from './file-registry.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FileRegistryController } from './file-registry.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, AuditModule, StorageModule],
  controllers: [FileRegistryController],
  providers: [FileRegistryService],
  exports: [FileRegistryService],
})
export class FileRegistryModule {}

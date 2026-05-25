import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    PlatformModule,
    StorageModule,
    FileRegistryModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

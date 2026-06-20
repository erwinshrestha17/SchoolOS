import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SchoolSettingsWorkspaceController } from './school-settings-workspace.controller';
import { SettingsService } from './settings.service';
import { SchoolSettingsNavigationV1Service } from './school-settings-navigation-v1.service';
import { SchoolSettingsProfileService } from './school-settings-profile.service';
import { BrandingDocumentsService } from './branding-documents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';
import { StorageModule } from '../storage/storage.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';

@Module({
  imports: [PrismaModule, AuditModule, PlatformModule, StorageModule, FileRegistryModule],
  controllers: [SettingsController, SchoolSettingsWorkspaceController],
  providers: [SettingsService, SchoolSettingsNavigationV1Service, SchoolSettingsProfileService, BrandingDocumentsService],
  exports: [SettingsService],
})
export class SettingsModule {}

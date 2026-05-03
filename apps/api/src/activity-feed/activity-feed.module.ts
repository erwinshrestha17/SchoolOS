import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import { FileRegistryModule } from '../file-registry/file-registry.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    StorageModule,
    CommunicationsModule,
    FileRegistryModule,
  ],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService],
})
export class ActivityFeedModule {}

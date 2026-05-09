import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { ConfigModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityMediaService } from './activity-media.service';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { MediaAccessController } from './media-access.controller';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    ConfigModule,
    StorageModule,
    CommunicationsModule,
    FileRegistryModule,
  ],
  controllers: [ActivityFeedController, MediaAccessController],
  providers: [ActivityFeedService, ActivityMediaService],
})
export class ActivityFeedModule {}

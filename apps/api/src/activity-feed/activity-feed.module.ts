import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationsModule } from '../communications/communications.module';
import { ConfigModule } from '../config/config.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityMediaService } from './activity-media.service';
import { ActivityPostLifecycleService } from './activity-post-lifecycle.service';
import { ActivityMediaProcessor } from './processors/activity-media.processor';
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
    BullModule.registerQueue({
      name: 'activity-media',
    }),
  ],
  controllers: [ActivityFeedController, MediaAccessController],
  providers: [
    ActivityFeedService,
    ActivityMediaService,
    ActivityPostLifecycleService,
    ActivityMediaProcessor,
  ],
})
export class ActivityFeedModule {}

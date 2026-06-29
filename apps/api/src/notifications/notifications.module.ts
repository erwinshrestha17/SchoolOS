import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

import { BullModule } from '@nestjs/bullmq';
import { NotificationsProcessor } from './notifications.processor';
import { DevicePushTokensService } from './device-push-tokens.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [
    NotificationsService,
    DevicePushTokensService,
    NotificationsProcessor,
  ],
  exports: [NotificationsService, DevicePushTokensService],
})
export class NotificationsModule {}

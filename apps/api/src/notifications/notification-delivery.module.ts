import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DevicePushTokensService } from './device-push-tokens.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';

/**
 * Internal M12 transport boundary. Queue and job names remain stable for
 * compatibility; feature modules consume the exported notification service
 * instead of provider SDKs.
 */
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
export class NotificationDeliveryModule {}

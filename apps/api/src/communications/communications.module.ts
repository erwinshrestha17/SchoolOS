import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { NotificationDeliveryModule } from '../notifications/notification-delivery.module';
import { UsageModule } from '../usage/usage.module';
import { CommunicationsService } from './communications.service';
import { DeliveryRetryService } from './delivery-retry.service';
import { M10HardeningService } from './m10-hardening.service';
import { NoticeDetailService } from './notice-detail.service';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';
import { NotificationCenterService } from './notification-center.service';

import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    NotificationDeliveryModule,
    AuditModule,
    UsageModule,
    FileRegistryModule,
    RedisModule,
  ],
  // Internal compatibility providers shared by the active M12 and M15
  // modules. No standalone Communication module is mounted in AppModule.
  providers: [
    CommunicationsService,
    NotificationCenterService,
    NoticeDetailService,
    NoticeUnreadRecipientsService,
    DeliveryRetryService,
    M10HardeningService,
  ],
  exports: [
    CommunicationsService,
    NotificationCenterService,
    NoticeDetailService,
    NoticeUnreadRecipientsService,
    DeliveryRetryService,
    M10HardeningService,
  ],
})
export class CommunicationsModule {}

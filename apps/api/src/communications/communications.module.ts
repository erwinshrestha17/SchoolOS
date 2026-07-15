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
import { NoticeLifecycleCron } from './notice-lifecycle.cron';
import { NotificationEventService } from './notification-event.service';
import { NoticeAcknowledgementService } from './notice-acknowledgement.service';

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
    NoticeLifecycleCron,
    NotificationEventService,
    NoticeAcknowledgementService,
  ],
  exports: [
    CommunicationsService,
    NotificationCenterService,
    NoticeDetailService,
    NoticeUnreadRecipientsService,
    DeliveryRetryService,
    M10HardeningService,
    NotificationEventService,
    NoticeAcknowledgementService,
  ],
})
export class CommunicationsModule {}

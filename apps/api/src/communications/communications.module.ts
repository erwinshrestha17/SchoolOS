import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FileRegistryModule } from '../file-registry/file-registry.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsageModule } from '../usage/usage.module';
import { CommunicationsService } from './communications.service';
import { CommunicationsOperationsController } from './communications-operations.controller';
import { ConsentsController } from './consents.controller';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryRetryService } from './delivery-retry.service';
import { EventsController } from './events.controller';
import { M10HardeningController } from './m10-hardening.controller';
import { M10HardeningService } from './m10-hardening.service';
import { NoticeDetailController } from './notice-detail.controller';
import { NoticeDetailService } from './notice-detail.service';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';
import { NotificationCenterAliasController } from './notification-center-alias.controller';
import { NotificationCenterController } from './notification-center.controller';
import { NotificationCenterService } from './notification-center.service';
import { NotificationDeliveriesAliasController } from './notification-deliveries-alias.controller';
import { NoticesController } from './notices.controller';

import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    AuditModule,
    UsageModule,
    FileRegistryModule,
    RedisModule,
  ],
  controllers: [
    NoticesController,
    NoticeDetailController,
    EventsController,
    DeliveriesController,
    ConsentsController,
    NotificationCenterController,
    NotificationCenterAliasController,
    NotificationDeliveriesAliasController,
    CommunicationsOperationsController,
    M10HardeningController,
  ],
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

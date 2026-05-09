import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsService } from './communications.service';
import { ConsentsController } from './consents.controller';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryRetryService } from './delivery-retry.service';
import { EventsController } from './events.controller';
import { NoticeDetailController } from './notice-detail.controller';
import { NoticeDetailService } from './notice-detail.service';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';
import { NotificationCenterAliasController } from './notification-center-alias.controller';
import { NotificationCenterController } from './notification-center.controller';
import { NotificationCenterService } from './notification-center.service';
import { NotificationDeliveriesAliasController } from './notification-deliveries-alias.controller';
import { NoticesController } from './notices.controller';

@Module({
  imports: [AuthModule, NotificationsModule, AuditModule],
  controllers: [
    NoticesController,
    NoticeDetailController,
    EventsController,
    DeliveriesController,
    ConsentsController,
    NotificationCenterController,
    NotificationCenterAliasController,
    NotificationDeliveriesAliasController,
  ],
  providers: [
    CommunicationsService,
    NotificationCenterService,
    NoticeDetailService,
    NoticeUnreadRecipientsService,
    DeliveryRetryService,
  ],
  exports: [
    CommunicationsService,
    NotificationCenterService,
    NoticeDetailService,
    NoticeUnreadRecipientsService,
    DeliveryRetryService,
  ],
})
export class CommunicationsModule {}

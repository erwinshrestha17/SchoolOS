import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsService } from './communications.service';
import { ConsentsController } from './consents.controller';
import { DeliveriesController } from './deliveries.controller';
import { DeliveryRetryService } from './delivery-retry.service';
import { EventsController } from './events.controller';
import { M10HardeningController } from './m10-hardening.controller';
import { M10HardeningService } from './m10-hardening.service';
import { NoticeDetailController } from './notice-detail.controller';
import { NoticeDetailService } from './notice-detail.service';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';
import { NotificationCenterController } from './notification-center.controller';
import { NotificationCenterService } from './notification-center.service';
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

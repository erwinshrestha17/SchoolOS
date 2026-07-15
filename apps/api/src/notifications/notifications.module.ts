import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { CommunicationsOperationsController } from '../communications/communications-operations.controller';
import { ConsentsController } from '../communications/consents.controller';
import { DeliveriesController } from '../communications/deliveries.controller';
import { M10HardeningController } from '../communications/m10-hardening.controller';
import { NotificationCenterAliasController } from '../communications/notification-center-alias.controller';
import { NotificationCenterController } from '../communications/notification-center.controller';
import { NotificationDeliveriesAliasController } from '../communications/notification-deliveries-alias.controller';
import { NotificationDeliveryModule } from './notification-delivery.module';
import { NotificationPreferencesController } from './notification-preferences.controller';

@Module({
  imports: [NotificationDeliveryModule, CommunicationsModule],
  controllers: [
    NotificationCenterController,
    NotificationCenterAliasController,
    DeliveriesController,
    NotificationDeliveriesAliasController,
    CommunicationsOperationsController,
    ConsentsController,
    M10HardeningController,
    NotificationPreferencesController,
  ],
  exports: [NotificationDeliveryModule, CommunicationsModule],
})
export class NotificationsModule {}

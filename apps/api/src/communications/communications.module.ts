import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CommunicationsService } from './communications.service';
import { ConsentsController } from './consents.controller';
import { DeliveriesController } from './deliveries.controller';
import { EventsController } from './events.controller';
import { NoticesController } from './notices.controller';

@Module({
  imports: [AuthModule, NotificationsModule, AuditModule],
  controllers: [
    NoticesController,
    EventsController,
    DeliveriesController,
    ConsentsController,
  ],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}

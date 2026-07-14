import { Module } from '@nestjs/common';
import { CommunicationsModule } from '../communications/communications.module';
import { EventsController } from '../communications/events.controller';
import { NoticeDetailController } from '../communications/notice-detail.controller';
import { NoticesController } from '../communications/notices.controller';

/**
 * M15 Notices and Announcements. Persisted notice and legacy communication
 * names remain compatibility details; this module owns the active notice API.
 */
@Module({
  imports: [CommunicationsModule],
  controllers: [NoticesController, NoticeDetailController, EventsController],
  exports: [CommunicationsModule],
})
export class NoticesModule {}

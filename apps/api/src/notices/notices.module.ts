import { Module } from '@nestjs/common';
import { AdvancedOperationsModule } from '../advanced-operations/advanced-operations.module';
import { CommunicationsModule } from '../communications/communications.module';
import { EventsController } from '../communications/events.controller';
import { NoticeApprovalService } from '../communications/notice-approval.service';
import { NoticeDetailController } from '../communications/notice-detail.controller';
import { NoticesController } from '../communications/notices.controller';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * M15 Notices and Announcements. Persisted notice and legacy communication
 * names remain compatibility details; this module owns the active notice API.
 */
@Module({
  imports: [CommunicationsModule, AdvancedOperationsModule, PrismaModule],
  controllers: [NoticesController, NoticeDetailController, EventsController],
  providers: [NoticeApprovalService],
  exports: [CommunicationsModule],
})
export class NoticesModule {}

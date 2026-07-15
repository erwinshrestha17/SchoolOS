import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { NoticeDetailService } from './notice-detail.service';
import { NoticeUnreadRecipientsService } from './notice-unread-recipients.service';
import { NotificationCenterService } from './notification-center.service';
import { NoticeAcknowledgementService } from './notice-acknowledgement.service';
import {
  ListNoticeAcknowledgementsQueryDto,
  NoticeAcknowledgementFollowUpDto,
} from './dto/notice-acknowledgement.dto';
import { CommunicationPageQueryDto } from './dto/communication-list-query.dto';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notices')
export class NoticeDetailController {
  constructor(
    private readonly noticeDetailService: NoticeDetailService,
    private readonly noticeUnreadRecipientsService: NoticeUnreadRecipientsService,
    private readonly notificationCenterService: NotificationCenterService,
    private readonly noticeAcknowledgementService: NoticeAcknowledgementService,
  ) {}

  @Get(':noticeId')
  @Permissions('notices:read')
  getNoticeDetail(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeDetailService.getNoticeDetail(noticeId, auth);
  }

  @Post(':noticeId/read')
  @Permissions('notices:read')
  markNoticeRead(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.notificationCenterService.markNoticeRead(noticeId, auth);
  }

  @Get(':noticeId/unread-recipients')
  @Permissions('notices:read', 'notices:read_reports')
  getUnreadRecipients(
    @Param('noticeId') noticeId: string,
    @Query() query: CommunicationPageQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeUnreadRecipientsService.getUnreadRecipients(
      noticeId,
      auth,
      query,
    );
  }

  @Post(':noticeId/acknowledge')
  @Permissions('notices:read')
  acknowledge(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeAcknowledgementService.acknowledge(noticeId, auth);
  }

  @Get(':noticeId/acknowledgements')
  @Permissions('notices:read_reports')
  listAcknowledgements(
    @Param('noticeId') noticeId: string,
    @Query() query: ListNoticeAcknowledgementsQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeAcknowledgementService.listRecipients(
      noticeId,
      query,
      auth,
    );
  }

  @Post(':noticeId/acknowledgements/follow-up')
  @Permissions('notices:read_reports')
  requestAcknowledgementFollowUp(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeAcknowledgementFollowUpDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeAcknowledgementService.requestFollowUp(
      noticeId,
      dto,
      auth,
    );
  }
}

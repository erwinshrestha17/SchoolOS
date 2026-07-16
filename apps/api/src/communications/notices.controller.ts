import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AudienceType, NoticePriority } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from './communications.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import {
  CreateNoticeDraftDto,
  NoticeApprovalRequestDto,
  NoticeLifecycleReasonDto,
  NoticeScheduleDto,
  UpdateNoticeDraftDto,
} from './dto/notice-lifecycle.dto';
import { ListNoticesQueryDto } from './dto/communication-list-query.dto';
import { NoticeApprovalService } from './notice-approval.service';

@Controller('notices')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.notices')
export class NoticesController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly noticeApprovalService: NoticeApprovalService,
  ) {}

  @Get()
  @Permissions('notices:read')
  listNotices(
    @Query() query: ListNoticesQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.listNotices(auth, query);
  }

  @Post()
  @Permissions('notices:create')
  createNotice(@Body() dto: CreateNoticeDto, @CurrentAuth() auth: AuthContext) {
    return this.communicationsService.createNotice(dto, auth);
  }

  @Post('drafts')
  @Permissions('notices:create')
  createDraft(
    @Body() dto: CreateNoticeDraftDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.createNoticeDraft(
      {
        ...dto,
        priority: dto.priority ?? NoticePriority.NORMAL,
        audienceType: dto.audienceType ?? AudienceType.ALL,
      },
      auth,
    );
  }

  @Patch(':noticeId')
  @Permissions('notices:edit')
  updateDraft(
    @Param('noticeId') noticeId: string,
    @Body() dto: UpdateNoticeDraftDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.updateNoticeDraft(noticeId, dto, auth);
  }

  @Post(':noticeId/publish')
  @Permissions('notices:publish')
  publish(
    @Param('noticeId') noticeId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.publishPreparedNotice(noticeId, auth);
  }

  @Post(':noticeId/schedule')
  @Permissions('notices:schedule')
  schedule(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeScheduleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.scheduleNotice(
      noticeId,
      dto.scheduledFor,
      auth,
    );
  }

  @Post(':noticeId/approval')
  @Permissions('notices:create')
  requestApproval(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeApprovalRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.noticeApprovalService.requestApproval(noticeId, dto, auth);
  }

  @Post(':noticeId/cancel')
  @Permissions('notices:cancel')
  cancel(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeLifecycleReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.cancelNotice(noticeId, dto.reason, auth);
  }

  @Post(':noticeId/archive')
  @Permissions('notices:archive')
  archive(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeLifecycleReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.archiveNotice(noticeId, dto.reason, auth);
  }

  @Post(':noticeId/restore')
  @Permissions('notices:archive')
  restore(
    @Param('noticeId') noticeId: string,
    @Body() dto: NoticeLifecycleReasonDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.restoreNotice(noticeId, dto.reason, auth);
  }

  @Post('recipient-preview')
  @Permissions('notices:create')
  previewNoticeRecipients(
    @Body() dto: CreateNoticeDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.communicationsService.previewNoticeRecipients(dto, auth);
  }

  @Post('scheduled/process')
  @Permissions('notices:create')
  processScheduled(@CurrentAuth() auth: AuthContext) {
    return this.communicationsService.processScheduledNotices(auth);
  }
}

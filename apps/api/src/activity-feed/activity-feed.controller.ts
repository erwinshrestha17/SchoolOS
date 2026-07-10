import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, map, filter, merge } from 'rxjs';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { RequiredModule } from '../auth/decorators/required-module.decorator';
import type { AuthContext } from '../auth/auth.types';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityMediaService } from './activity-media.service';
import { ActivityPostLifecycleService } from './activity-post-lifecycle.service';
import { CreateActivityPostDto } from './dto/create-activity-post.dto';
import { CreateActivityReactionDto } from './dto/create-activity-reaction.dto';
import { CreateDevelopmentalMilestoneDto } from './dto/create-developmental-milestone.dto';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';
import {
  DeleteActivityPostDto,
  ModerateActivityPostDto,
} from './dto/moderate-activity-post.dto';
import { UpdateActivityPostDto } from './dto/update-activity-post.dto';

interface FeedPostEvent {
  tenantId: string;
}

@Controller('activity-feed')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@RequiredModule('activity')
export class ActivityFeedController {
  constructor(
    private readonly activityFeedService: ActivityFeedService,
    private readonly activityMediaService: ActivityMediaService,
    private readonly activityPostLifecycleService: ActivityPostLifecycleService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('stream')
  @Permissions('activity_feed:read')
  streamFeed(@CurrentAuth() auth: AuthContext): Observable<MessageEvent> {
    const created$ = fromEvent(this.eventEmitter, 'feed.post.created');
    const updated$ = fromEvent(this.eventEmitter, 'feed.post.updated');
    const deleted$ = fromEvent(this.eventEmitter, 'feed.post.deleted');
    const moderated$ = fromEvent(this.eventEmitter, 'feed.post.moderated');

    return merge(created$, updated$, deleted$, moderated$).pipe(
      filter(
        (payload): payload is FeedPostEvent =>
          typeof payload === 'object' &&
          payload !== null &&
          'tenantId' in payload &&
          payload.tenantId === auth.tenantId,
      ),
      map(
        (payload) =>
          ({
            data: payload,
          }) as MessageEvent,
      ),
    );
  }

  @Get('posts')
  @Permissions('activity_feed:read')
  listPosts(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('category') category?: string,
    @Query('month') month?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.activityFeedService.listPosts(auth, {
      studentId,
      classId,
      sectionId,
      category,
      month,
      status,
      limit,
      offset,
    });
  }

  @Get('parent')
  @Permissions('activity_feed:read')
  listParentPosts(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('category') category?: string,
    @Query('month') month?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.activityFeedService.listPosts(auth, {
      studentId,
      category,
      month,
      limit,
      offset,
    });
  }

  @Get('reactions/analytics')
  @Permissions('activity_feed:read')
  getReactionAnalytics(@CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.getReactionAnalytics(auth);
  }

  @Get('audience-preview')
  @Permissions('activity_feed:read')
  previewAudience(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('studentIds') studentIds?: string | string[],
  ) {
    return this.activityFeedService.previewAudience(auth, {
      classId,
      sectionId,
      studentIds,
    });
  }

  @Get('posts/:id')
  @Permissions('activity_feed:read')
  getPostDetail(@Param('id') postId: string, @CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.getPostDetail(postId, auth);
  }

  @Get('gallery')
  @Permissions('activity_feed:read')
  listGallery(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.activityFeedService.listGallery(auth, {
      studentId,
      classId,
      sectionId,
      category,
      limit,
      offset,
    });
  }

  @Post('posts')
  @Permissions('activity_feed:create')
  createPost(
    @Body() dto: CreateActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createPost(dto, auth);
  }

  @Patch('posts/:id')
  @Permissions('activity_feed:create')
  updatePost(
    @Param('id') postId: string,
    @Body() dto: UpdateActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityPostLifecycleService.updatePost(postId, dto, auth);
  }

  @Delete('posts/:id')
  @Permissions('activity_feed:create')
  softDeletePost(
    @Param('id') postId: string,
    @Body() dto: DeleteActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityPostLifecycleService.softDeletePost(postId, dto, auth);
  }

  @Patch('posts/:id/restore')
  @Permissions('activity_feed:moderate')
  restorePost(@Param('id') postId: string, @CurrentAuth() auth: AuthContext) {
    return this.activityPostLifecycleService.restorePost(postId, auth);
  }

  @Patch('posts/:id/moderation')
  @Permissions('activity_feed:moderate')
  moderatePost(
    @Param('id') postId: string,
    @Body() dto: ModerateActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityPostLifecycleService.moderatePost(postId, dto, auth);
  }

  @Post('posts/:id/reactions')
  @Permissions('activity_feed:read')
  createReaction(
    @Param('id') postId: string,
    @Body() dto: CreateActivityReactionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createReaction(postId, dto, auth);
  }

  @Get('mood-logs')
  @Permissions('activity_feed:read')
  listMoodLogs(@CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.listMoodLogs(auth);
  }

  @Post('mood-logs')
  @Permissions('activity_feed:create')
  createMoodLog(
    @Body() dto: CreateMoodLogDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createMoodLog(dto, auth);
  }

  @Get('milestones')
  @Permissions('activity_feed:read')
  listMilestones(
    @CurrentAuth() auth: AuthContext,
    @Query('studentId') studentId?: string,
    @Query('month') month?: string,
  ) {
    return this.activityFeedService.listMilestones(auth, { studentId, month });
  }

  @Get('milestone-templates')
  @Permissions('activity_feed:read')
  listMilestoneTemplates(
    @Query('stage') stage?: string,
    @Query('domain') domain?: string,
  ) {
    return this.activityFeedService.listMilestoneTemplates({ stage, domain });
  }

  @Post('milestones')
  @Permissions('activity_feed:create')
  createMilestone(
    @Body() dto: CreateDevelopmentalMilestoneDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createMilestone(dto, auth);
  }

  @Get('media/:id/preview-url')
  @Permissions('activity_feed:read')
  getMediaPreviewUrl(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      attachmentId,
      'preview',
    );
  }

  @Get('media/:id/download-url')
  @Permissions('activity_feed:read')
  getMediaDownloadUrl(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      attachmentId,
      'download',
    );
  }

  @Get('parent/media/:id/preview-url')
  @Permissions('activity_feed:read')
  getParentMediaPreviewUrl(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      attachmentId,
      'preview',
    );
  }

  @Get('parent/media/:id/download-url')
  @Permissions('activity_feed:read')
  getParentMediaDownloadUrl(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityMediaService.getAttachmentAccessUrl(
      auth,
      attachmentId,
      'download',
    );
  }

  @Get('attachments/:id/preview')
  @Permissions('activity_feed:read')
  async getAttachmentPreview(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
    @Res() res: Response,
  ) {
    const media = await this.activityMediaService.getAttachmentMedia(
      auth,
      attachmentId,
      'preview',
    );

    if (media.redirectUrl) {
      res.redirect(media.redirectUrl);
      return;
    }

    res.setHeader('Content-Type', media.contentType);
    res.setHeader('Content-Length', String(media.sizeBytes));
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${sanitizeFileName(media.fileName)}"`,
    );

    return media.stream?.pipe(res);
  }

  @Get('attachments/:id/download')
  @Permissions('activity_feed:read')
  @Header('Cache-Control', 'private, max-age=60')
  async downloadAttachment(
    @Param('id') attachmentId: string,
    @CurrentAuth() auth: AuthContext,
    @Res() res: Response,
  ) {
    const media = await this.activityMediaService.getAttachmentMedia(
      auth,
      attachmentId,
      'download',
    );

    if (media.redirectUrl) {
      res.redirect(media.redirectUrl);
      return;
    }

    res.setHeader('Content-Type', media.contentType);
    res.setHeader('Content-Length', String(media.sizeBytes));
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFileName(media.fileName)}"`,
    );

    return media.stream?.pipe(res);
  }
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\r\n"]/g, '_');
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent, map, filter } from 'rxjs';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { ActivityFeedService } from './activity-feed.service';
import { CreateActivityPostDto } from './dto/create-activity-post.dto';
import { CreateActivityReactionDto } from './dto/create-activity-reaction.dto';
import { CreateDevelopmentalMilestoneDto } from './dto/create-developmental-milestone.dto';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

type FeedPostEvent = { tenantId: string };

@Controller('activity-feed')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ActivityFeedController {
  constructor(
    private readonly activityFeedService: ActivityFeedService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Sse('stream')
  @Permissions('activity_feed:read')
  streamFeed(@CurrentAuth() auth: AuthContext): Observable<MessageEvent> {
    // Uses RxJS to observe the event emitter and map it to an SSE MessageEvent.
    // Filters events to ensure the user only receives posts intended for their tenant.
    return fromEvent(this.eventEmitter, 'feed.post.created').pipe(
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
  ) {
    return this.activityFeedService.listPosts(auth, {
      studentId,
      classId,
      sectionId,
      category,
      month,
    });
  }

  @Get('reactions/analytics')
  @Permissions('activity_feed:read')
  getReactionAnalytics(@CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.getReactionAnalytics(auth);
  }

  @Post('posts')
  @Permissions('activity_feed:create')
  createPost(
    @Body() dto: CreateActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createPost(dto, auth);
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

  @Post('milestones')
  @Permissions('activity_feed:create')
  createMilestone(
    @Body() dto: CreateDevelopmentalMilestoneDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createMilestone(dto, auth);
  }
}

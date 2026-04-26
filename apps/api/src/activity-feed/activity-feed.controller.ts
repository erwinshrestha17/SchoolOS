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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { ActivityFeedService } from './activity-feed.service';
import { CreateActivityPostDto } from './dto/create-activity-post.dto';
import { CreateActivityReactionDto } from './dto/create-activity-reaction.dto';
import { CreateDevelopmentalMilestoneDto } from './dto/create-developmental-milestone.dto';
import { CreateMoodLogDto } from './dto/create-mood-log.dto';

@Controller('activity-feed')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class ActivityFeedController {
  constructor(private readonly activityFeedService: ActivityFeedService) {}

  @Get('posts')
  @Permissions('activity_feed:read')
  listPosts(@CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.listPosts(auth);
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

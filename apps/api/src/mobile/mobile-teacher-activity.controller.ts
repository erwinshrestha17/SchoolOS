import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse } from '@nestjs/swagger';
import { ActivityFeedService } from '../activity-feed/activity-feed.service';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  CreateMobileTeacherActivityPostDto,
  CreateMobileTeacherMilestoneDto,
  MobileTeacherActivityPostsQueryDto,
  MobileTeacherActivityStudentsQueryDto,
} from './dto/mobile-teacher-activity.dto';
import { MobileTeacherMilestoneReceiptDto } from './dto/mobile-teacher-milestone-receipt.dto';

@Controller('mobile/teacher/activity')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.activity')
@Roles('teacher', 'subject_teacher')
export class MobileTeacherActivityController {
  constructor(private readonly activityFeedService: ActivityFeedService) {}

  @Get('scopes')
  @Permissions('activity_feed:read')
  listScopes(@CurrentAuth() auth: AuthContext) {
    return this.activityFeedService.listTeacherMobileScopes(auth);
  }

  @Get('students')
  @Permissions('activity_feed:read')
  listStudents(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherActivityStudentsQueryDto,
  ) {
    return this.activityFeedService.listTeacherMobileStudents(auth, query);
  }

  @Get('posts')
  @Permissions('activity_feed:read')
  listPosts(
    @CurrentAuth() auth: AuthContext,
    @Query() query: MobileTeacherActivityPostsQueryDto,
  ) {
    return this.activityFeedService.listTeacherMobilePosts(auth, query);
  }

  @Post('posts')
  @Permissions('activity_feed:create')
  createPost(
    @Body() dto: CreateMobileTeacherActivityPostDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.activityFeedService.createPost(dto, auth);
  }

  @Post('milestones')
  @Permissions('activity_feed:create')
  @ApiCreatedResponse({ type: MobileTeacherMilestoneReceiptDto })
  async createMilestone(
    @Body() dto: CreateMobileTeacherMilestoneDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    const milestone = await this.activityFeedService.createMilestone(dto, auth);
    return {
      resourceId: milestone.id,
      clientSubmissionId:
        milestone.clientSubmissionId ?? dto.clientSubmissionId,
      replayed: milestone.replayed,
      serverReceivedAt: milestone.serverReceivedAt,
    } satisfies MobileTeacherMilestoneReceiptDto;
  }
}

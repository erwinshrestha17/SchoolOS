import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Entitlement } from '../../auth/decorators/entitlement.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../../auth/guards/roles-permissions.guard';
import { LEARNING_MODULE_ENTITLEMENT } from '../learning.constants';
import { LEARNING_PERMISSIONS } from '../learning.permissions';
import { CreateLearningSessionDto } from './dto/create-learning-session.dto';
import { JoinLearningSessionDto } from './dto/join-learning-session.dto';
import { LearningSessionsService } from './learning-sessions.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class LearningSessionsController {
  constructor(
    private readonly learningSessionsService: LearningSessionsService,
  ) {}

  @Post('learning/activities/:id/sessions')
  @Permissions(LEARNING_PERMISSIONS.LAUNCH)
  launchSession(
    @Param('id') activityId: string,
    @Body() dto: CreateLearningSessionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningSessionsService.launchSession(activityId, dto, auth);
  }

  @Get('learning/sessions/:id')
  @Permissions(LEARNING_PERMISSIONS.READ)
  getSession(@Param('id') sessionId: string, @CurrentAuth() auth: AuthContext) {
    return this.learningSessionsService.getSession(auth, sessionId);
  }

  @Post('learning/sessions/:id/pause')
  @Permissions(LEARNING_PERMISSIONS.LAUNCH)
  pauseSession(
    @Param('id') sessionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningSessionsService.pauseSession(auth, sessionId);
  }

  @Post('learning/sessions/:id/resume')
  @Permissions(LEARNING_PERMISSIONS.LAUNCH)
  resumeSession(
    @Param('id') sessionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningSessionsService.resumeSession(auth, sessionId);
  }

  @Post('learning/sessions/:id/end')
  @Permissions(LEARNING_PERMISSIONS.LAUNCH)
  endSession(@Param('id') sessionId: string, @CurrentAuth() auth: AuthContext) {
    return this.learningSessionsService.endSession(auth, sessionId);
  }

  @Post('learning/sessions/join')
  @Permissions(LEARNING_PERMISSIONS.ATTEMPT)
  joinSession(
    @Body() dto: JoinLearningSessionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningSessionsService.joinSession(auth, dto);
  }
}

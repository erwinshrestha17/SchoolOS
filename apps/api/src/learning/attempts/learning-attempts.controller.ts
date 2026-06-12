import {
  Body,
  Controller,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Entitlement } from '../../auth/decorators/entitlement.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../../auth/guards/roles-permissions.guard';
import { LEARNING_MODULE_ENTITLEMENT } from '../learning.constants';
import { LEARNING_PERMISSIONS } from '../learning.permissions';
import { AutosaveLearningAttemptDto } from './dto/autosave-learning-attempt.dto';
import { SubmitLearningAttemptDto } from './dto/submit-learning-attempt.dto';
import { LearningAttemptsService } from './learning-attempts.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class LearningAttemptsController {
  constructor(
    private readonly learningAttemptsService: LearningAttemptsService,
  ) {}

  @Post('learning/sessions/:id/attempts')
  @Permissions(LEARNING_PERMISSIONS.ATTEMPT)
  startAttempt(
    @Param('id') sessionId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningAttemptsService.startAttempt(sessionId, auth);
  }

  @Patch('learning/attempts/:id/autosave')
  @Permissions(LEARNING_PERMISSIONS.ATTEMPT)
  autosaveAttempt(
    @Param('id') attemptId: string,
    @Body() dto: AutosaveLearningAttemptDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningAttemptsService.autosaveAttempt(attemptId, dto, auth);
  }

  @Post('learning/attempts/:id/submit')
  @Permissions(LEARNING_PERMISSIONS.ATTEMPT)
  submitAttempt(
    @Param('id') attemptId: string,
    @Body() dto: SubmitLearningAttemptDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningAttemptsService.submitAttempt(attemptId, dto, auth);
  }
}

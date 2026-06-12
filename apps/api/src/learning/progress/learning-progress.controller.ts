import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthContext } from '../../auth/auth.types';
import { CurrentAuth } from '../../auth/decorators/current-auth.decorator';
import { Entitlement } from '../../auth/decorators/entitlement.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { EntitlementGuard } from '../../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../../auth/guards/roles-permissions.guard';
import { LEARNING_MODULE_ENTITLEMENT } from '../learning.constants';
import { LEARNING_PERMISSIONS } from '../learning.permissions';
import { LearningProgressService } from './learning-progress.service';

@Controller('learning/progress')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class LearningProgressController {
  constructor(
    private readonly learningProgressService: LearningProgressService,
  ) {}

  @Get('class/:classId')
  @Permissions(LEARNING_PERMISSIONS.PROGRESS)
  getClassProgress(
    @Param('classId') classId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningProgressService.getClassProgress(auth, classId);
  }

  @Get('student/:studentId')
  @Permissions(LEARNING_PERMISSIONS.PROGRESS)
  getStudentProgress(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningProgressService.getStudentProgress(auth, studentId);
  }
}

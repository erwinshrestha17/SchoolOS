import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { CreateLearningActivityDto } from './dto/create-learning-activity.dto';
import { ListLearningActivitiesDto } from './dto/list-learning-activities.dto';
import { UpdateLearningActivityDto } from './dto/update-learning-activity.dto';
import { LearningActivitiesService } from './learning-activities.service';

@Controller('learning/activities')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class LearningActivitiesController {
  constructor(
    private readonly learningActivitiesService: LearningActivitiesService,
  ) {}

  @Get()
  @Permissions(LEARNING_PERMISSIONS.READ)
  listActivities(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListLearningActivitiesDto,
  ) {
    return this.learningActivitiesService.listActivities(auth, query);
  }

  @Post()
  @Permissions(LEARNING_PERMISSIONS.CREATE)
  createActivity(
    @Body() dto: CreateLearningActivityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningActivitiesService.createActivity(dto, auth);
  }

  @Get(':id')
  @Permissions(LEARNING_PERMISSIONS.READ)
  getActivity(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.learningActivitiesService.getActivity(auth, id);
  }

  @Patch(':id')
  @Permissions(LEARNING_PERMISSIONS.UPDATE)
  updateActivity(
    @Param('id') id: string,
    @Body() dto: UpdateLearningActivityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.learningActivitiesService.updateActivity(id, dto, auth);
  }

  @Delete(':id')
  @Permissions(LEARNING_PERMISSIONS.DELETE)
  archiveActivity(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.learningActivitiesService.archiveActivity(id, auth);
  }
}

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
import { CreateLearningResourceDto } from './dto/create-learning-resource.dto';
import { ListLearningResourcesDto } from './dto/list-learning-resources.dto';
import { UpdateLearningResourceDto } from './dto/update-learning-resource.dto';
import { LearningResourcesService } from './learning-resources.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement(LEARNING_MODULE_ENTITLEMENT)
export class LearningResourcesController {
  constructor(
    private readonly learningResourcesService: LearningResourcesService,
  ) {}

  @Get('learning/resources')
  @Permissions(LEARNING_PERMISSIONS.READ)
  listResources(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListLearningResourcesDto,
  ) {
    return this.learningResourcesService.listResources(auth, query);
  }

  @Post('learning/resources')
  @Permissions(LEARNING_PERMISSIONS.CREATE)
  createResource(
    @CurrentAuth() auth: AuthContext,
    @Body() dto: CreateLearningResourceDto,
  ) {
    return this.learningResourcesService.createResource(auth, dto);
  }

  @Get('learning/resources/:id')
  @Permissions(LEARNING_PERMISSIONS.READ)
  getResource(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.learningResourcesService.getResource(auth, id);
  }

  @Patch('learning/resources/:id')
  @Permissions(LEARNING_PERMISSIONS.UPDATE)
  updateResource(
    @CurrentAuth() auth: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateLearningResourceDto,
  ) {
    return this.learningResourcesService.updateResource(auth, id, dto);
  }

  @Delete('learning/resources/:id')
  @Permissions(LEARNING_PERMISSIONS.DELETE)
  archiveResource(@CurrentAuth() auth: AuthContext, @Param('id') id: string) {
    return this.learningResourcesService.archiveResource(auth, id);
  }

  @Get('learning/activities/:id/resources')
  @Permissions(LEARNING_PERMISSIONS.READ)
  listActivityResources(
    @CurrentAuth() auth: AuthContext,
    @Param('id') activityId: string,
  ) {
    return this.learningResourcesService.listActivityResources(
      auth,
      activityId,
    );
  }

  @Post('learning/activities/:id/resources')
  @Permissions(LEARNING_PERMISSIONS.CREATE)
  attachActivityResource(
    @CurrentAuth() auth: AuthContext,
    @Param('id') activityId: string,
    @Body() dto: CreateLearningResourceDto,
  ) {
    return this.learningResourcesService.attachActivityResource(
      auth,
      activityId,
      dto,
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { AssignClassStreamDto } from './dto/assign-class-stream.dto';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassesService } from './classes.service';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @Permissions('classes:read')
  @ApiOkResponse({
    description: 'Tenant-scoped classes with backend-owned program labels.',
    schema: { type: 'array', items: classSummarySchema(true) },
  })
  listClasses(@CurrentAuth() auth: AuthContext) {
    return this.classesService.listClasses(auth);
  }

  @Post()
  @Permissions('classes:create')
  @ApiCreatedResponse({
    description: 'Created Grade 1-12 class with its derived program.',
    schema: classSummarySchema(false),
  })
  createClass(@Body() dto: CreateClassDto, @CurrentAuth() auth: AuthContext) {
    return this.classesService.createClass(dto, auth);
  }

  @Patch(':id/stream')
  @Permissions('classes:create')
  @ApiOkResponse({
    description: 'Updated Higher Secondary stream assignment.',
    schema: classSummarySchema(false),
  })
  assignClassStream(
    @Param('id') id: string,
    @Body() dto: AssignClassStreamDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.classesService.assignClassStream(id, dto, auth);
  }
}

function classSummarySchema(withCounts: boolean) {
  return {
    type: 'object',
    required: [
      'id',
      'name',
      'level',
      'program',
      'streamId',
      'streamName',
      ...(withCounts ? ['studentCount', 'subjectCount', 'sectionCount'] : []),
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', maxLength: 100 },
      level: { type: 'integer', minimum: 1, maximum: 12 },
      program: {
        type: 'string',
        nullable: true,
        enum: ['SCHOOL', 'HIGHER_SECONDARY'],
      },
      streamId: { type: 'string', format: 'uuid', nullable: true },
      streamName: { type: 'string', nullable: true },
      ...(withCounts
        ? {
            studentCount: { type: 'integer', minimum: 0 },
            subjectCount: { type: 'integer', minimum: 0 },
            sectionCount: { type: 'integer', minimum: 0 },
          }
        : {}),
    },
  };
}

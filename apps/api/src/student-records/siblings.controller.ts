import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateSiblingGroupDto } from './dto/create-sibling-group.dto';
import { StudentRecordsService } from './student-records.service';

@Controller('siblings')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.students')
export class SiblingsController {
  constructor(private readonly studentRecordsService: StudentRecordsService) {}

  @Get()
  @Permissions('students:read')
  listSiblingGroups(@CurrentAuth() auth: AuthContext) {
    return this.studentRecordsService.listSiblingGroups(auth);
  }

  @Post()
  @Permissions('siblings:manage')
  createSiblingGroup(
    @Body() dto: CreateSiblingGroupDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.studentRecordsService.createSiblingGroup(dto, auth);
  }
}

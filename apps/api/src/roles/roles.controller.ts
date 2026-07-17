import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantActiveGuard } from '../auth/guards/tenant-active.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TenantActiveGuard, RolesPermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles:read')
  listRoles(@CurrentAuth() auth: AuthContext) {
    return this.rolesService.listRoles(auth);
  }

  @Get('permissions')
  @Permissions('roles:read')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Post()
  @Permissions('roles:create')
  createRole(@Body() dto: CreateRoleDto, @CurrentAuth() auth: AuthContext) {
    return this.rolesService.createRole(dto, auth);
  }

  @Post('assign')
  @Permissions('roles:assign')
  assignRoles(@Body() dto: AssignRoleDto, @CurrentAuth() auth: AuthContext) {
    return this.rolesService.assignRoles(dto, auth);
  }

  @Post(':id/permissions')
  @Permissions('roles:manage_permissions')
  assignPermissions(
    @Param('id') roleId: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.rolesService.assignPermissions(roleId, dto, auth);
  }
}

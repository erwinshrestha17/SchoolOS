import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffService } from './staff.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions('staff:read')
  listStaff(@CurrentAuth() auth: AuthContext) {
    return this.staffService.listStaff(auth);
  }

  @Post()
  @Permissions('staff:create')
  createStaff(@Body() dto: CreateStaffDto, @CurrentAuth() auth: AuthContext) {
    return this.staffService.createStaff(dto, auth);
  }
}

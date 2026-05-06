import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class HrStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get(':staffId')
  @Permissions('hr:staff:read')
  getStaffDetail(
    @Param('staffId') staffId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.getStaffDetail(staffId, auth);
  }

  @Patch(':staffId')
  @Permissions('hr:staff:update')
  updateStaff(
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.updateStaff(staffId, dto, auth);
  }

  @Post(':staffId/lifecycle')
  @Permissions('hr:staff:lifecycle')
  transitionStaff(
    @Param('staffId') staffId: string,
    @Body() dto: StaffLifecycleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(staffId, dto, auth);
  }
}

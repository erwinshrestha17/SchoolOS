import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('hr/staff')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class HrStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions('hr:staff:read')
  listStaff(@CurrentAuth() auth: AuthContext) {
    return this.staffService.listStaff(auth);
  }

  @Post()
  @Permissions('hr:staff:create')
  createStaff(@Body() dto: CreateStaffDto, @CurrentAuth() auth: AuthContext) {
    return this.staffService.createStaff(dto, auth);
  }

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

  @Post(':staffId/archive')
  @Permissions('hr:staff:archive')
  archiveStaff(
    @Param('staffId') staffId: string,
    @Body() dto: Partial<StaffLifecycleDto>,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(
      staffId,
      {
        status: StaffStatus.INACTIVE,
        reason: dto.reason ?? 'Archived through HR staff archive action',
      },
      auth,
    );
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

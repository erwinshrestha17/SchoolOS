import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import type { AuthContext } from '../auth/auth.types';
import { CreateStaffDto } from './dto/create-staff.dto';
import { StaffLifecycleDto } from './dto/staff-lifecycle.dto';
import { ListStaffQueryDto } from './dto/list-staff-query.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';
import {
  CreateStaffLeaveRequestDto,
  RecordStaffAttendanceDto,
} from './dto/staff-actions.dto';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.hr')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions('staff:read')
  listStaff(@CurrentAuth() auth: AuthContext) {
    return this.staffService.listStaff(auth);
  }

  @Get('directory')
  @Permissions('staff:read')
  listStaffDirectory(
    @Query() query: ListStaffQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.listStaffDirectory(query, auth);
  }

  @Get('me')
  @Permissions('staff:read')
  getMe(@CurrentAuth() auth: AuthContext) {
    return this.staffService.getStaffProfile(auth);
  }

  @Get('me/timeline')
  @Permissions('staff:read')
  getMyTimeline(@CurrentAuth() auth: AuthContext) {
    return this.staffService.getMyStaffTimeline(auth);
  }

  @Post('me/leave-requests')
  @Permissions('hr:leave:request')
  createMyLeaveRequest(
    @Body() dto: CreateStaffLeaveRequestDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.createMyLeaveRequest(dto, auth);
  }

  @Post('me/attendance')
  @Permissions('hr:attendance:write')
  recordMyAttendance(
    @Body() dto: RecordStaffAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.recordMyAttendance(dto, auth);
  }

  @Get(':id')
  @Permissions('staff:read')
  getStaffDetail(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.staffService.getStaffDetail(id, auth);
  }

  @Post()
  @Permissions('staff:create')
  createStaff(@Body() dto: CreateStaffDto, @CurrentAuth() auth: AuthContext) {
    return this.staffService.createStaff(dto, auth);
  }

  @Patch(':id')
  @Permissions('staff:update')
  updateStaff(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.updateStaff(id, dto, auth);
  }

  @Post(':id/archive')
  @Permissions('staff:update')
  archiveStaff(
    @Param('id') id: string,
    @Body() dto: StaffLifecycleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(
      id,
      { ...dto, status: StaffStatus.INACTIVE },
      auth,
    );
  }

  @Post(':id/terminate')
  @Permissions('staff:update')
  terminateStaff(
    @Param('id') id: string,
    @Body() dto: StaffLifecycleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.staffService.transitionStaffStatus(
      id,
      { ...dto, status: StaffStatus.TERMINATED },
      auth,
    );
  }
}

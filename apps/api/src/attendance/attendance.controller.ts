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
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from './attendance.service';
import { ReviewAttendanceConflictDto } from './dto/review-attendance-conflict.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { SyncAttendanceDto } from './dto/sync-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Permissions('attendance:read')
  listAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listAttendance(auth);
  }

  @Get('rosters')
  @Permissions('attendance:read')
  getRoster(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId: string,
    @Query('classId') classId: string,
    @Query('sectionId') sectionId?: string,
    @Query('attendanceDate') attendanceDate?: string,
  ) {
    return this.attendanceService.getRoster(
      auth,
      academicYearId,
      classId,
      sectionId,
      attendanceDate,
    );
  }

  @Get('analytics')
  @Permissions('attendance:read')
  getAnalytics(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.getAnalytics(auth);
  }

  @Get('conflicts')
  @Permissions('attendance:read')
  listConflicts(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listConflicts(auth);
  }

  @Post('sessions')
  @Permissions('attendance:mark')
  submitAttendance(
    @Body() dto: SubmitAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitAttendance(dto, auth);
  }

  @Post('sync')
  @Permissions('attendance:mark')
  syncAttendance(
    @Body() dto: SyncAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.syncAttendance(dto, auth);
  }

  @Patch('conflicts/:id/review')
  @Permissions('attendance:mark')
  reviewConflict(
    @Param('id') conflictId: string,
    @Body() dto: ReviewAttendanceConflictDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.reviewConflict(conflictId, dto, auth);
  }
}

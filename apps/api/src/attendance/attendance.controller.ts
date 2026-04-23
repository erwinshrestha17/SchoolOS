import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import type { AuthContext } from '../auth/auth.types';
import { AttendanceService } from './attendance.service';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @Permissions('attendance:read')
  listAttendance(@CurrentAuth() auth: AuthContext) {
    return this.attendanceService.listAttendance(auth);
  }

  @Post('sessions')
  @Permissions('attendance:mark')
  submitAttendance(
    @Body() dto: SubmitAttendanceDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.attendanceService.submitAttendance(dto, auth);
  }
}

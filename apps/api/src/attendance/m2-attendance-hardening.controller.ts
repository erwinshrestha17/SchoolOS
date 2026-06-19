import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import {
  M2AttendanceWindowDto,
  OfflineSyncConflictRulesDto,
  RepeatedAbsenceFollowUpDto,
  RunAttendanceCutoffDto,
  UpdateM2AttendancePolicyDto,
  UpsertM2CalendarPolicyDayDto,
} from './dto/m2-attendance-hardening.dto';
import { M2AttendanceHardeningService } from './m2-attendance-hardening.service';

@ApiTags('M2 Smart Attendance')
@ApiBearerAuth()
@Controller('attendance/m2')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.attendance')
export class M2AttendanceHardeningController {
  constructor(private readonly service: M2AttendanceHardeningService) {}

  @Get('policy')
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'Get tenant M2 attendance hardening policy' })
  getPolicy(@CurrentAuth() auth: AuthContext) {
    return this.service.getPolicy(auth);
  }

  @Patch('policy')
  @Permissions('attendance:manage_all')
  @ApiOperation({ summary: 'Update tenant M2 attendance hardening policy' })
  updatePolicy(
    @Body() dto: UpdateM2AttendancePolicyDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.updatePolicy(dto, auth);
  }

  @Get('states')
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'List backend-supported attendance states' })
  getSupportedStates() {
    return this.service.getSupportedStates();
  }

  @Get('anomalies/hardened')
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'List hardened attendance anomaly checks' })
  getHardeningAnomalies(
    @Query() query: M2AttendanceWindowDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getHardeningAnomalies(query, auth);
  }

  @Get('conflicts/audit')
  @Permissions('attendance:review_conflicts')
  @ApiOperation({ summary: 'List audited attendance sync conflicts' })
  getConflictAudit(
    @Query() query: M2AttendanceWindowDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getConflictAudit(query, auth);
  }

  @Get('corrections/audit')
  @Permissions('attendance:review_conflicts')
  @ApiOperation({ summary: 'List audited attendance correction reviews' })
  getCorrectionAudit(
    @Query() query: M2AttendanceWindowDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getCorrectionAudit(query, auth);
  }

  @Get('calendar-policy')
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'Get attendance calendar policy window' })
  getCalendarPolicy(
    @Query() query: M2AttendanceWindowDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getCalendarPolicy(query, auth);
  }

  @Post('calendar-policy/day')
  @Permissions('attendance:manage_all')
  @ApiOperation({ summary: 'Upsert one attendance calendar policy day' })
  upsertCalendarPolicyDay(
    @Body() dto: UpsertM2CalendarPolicyDayDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.upsertCalendarPolicyDay(dto, auth);
  }

  @Post('cutoff/run')
  @Permissions('attendance:manage_all')
  @ApiOperation({ summary: 'Preview or run attendance cutoff hardening' })
  runAttendanceCutoff(
    @Body() dto: RunAttendanceCutoffDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.runAttendanceCutoff(dto, auth);
  }

  @Get('follow-ups/queue')
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'List repeated absence and late follow-up queue' })
  getFollowUpQueue(
    @Query() query: RepeatedAbsenceFollowUpDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.getFollowUpQueue(query, auth);
  }

  @Post('follow-ups/run')
  @Permissions('attendance:manage_all')
  @ApiOperation({ summary: 'Preview or dispatch attendance follow-ups' })
  runFollowUpAutomation(
    @Body() dto: RepeatedAbsenceFollowUpDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.runFollowUpAutomation(dto, auth);
  }

  @Get('offline-sync/conflicts')
  @Permissions('attendance:review_conflicts')
  @ApiOperation({
    summary: 'List offline attendance sync conflicts and replays',
  })
  listOfflineSyncConflicts(
    @Query() query: OfflineSyncConflictRulesDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.service.listOfflineSyncConflicts(query, auth);
  }
}

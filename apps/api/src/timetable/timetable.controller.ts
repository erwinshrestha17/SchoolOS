import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import {
  AssignSubstitutionDto,
  CreateRoomDto,
  CreateSubjectWeeklyRequirementDto,
  CreateSubstitutionDto,
  CreateTimetablePeriodDto,
  CreateTimetableVersionDto,
  CreateVersionSlotDto,
  ListSubjectWeeklyRequirementQueryDto,
  ListTeacherAvailabilityQueryDto,
  ListTeacherWorkloadQueryDto,
  SubstitutionQueryDto,
  TeacherAvailabilityDto,
  TimetableVersionQueryDto,
  UpdateRoomDto,
  UpdateSubjectWeeklyRequirementDto,
  UpdateSubstitutionDto,
  UpdateTeacherAvailabilityDto,
  UpdateTimetablePeriodDto,
  UpdateTimetableVersionDto,
  RestoreTimetableVersionDto,
  UpdateVersionSlotDto,
  UpsertTeacherWorkloadLimitDto,
  WorkloadQueryDto,
} from './dto/timetable-setup.dto';
import { TimetableService } from './timetable.service';
import { TimetableSubstitutionService } from './timetable-substitution.service';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TimetableController {
  constructor(
    private readonly timetableService: TimetableService,
    private readonly substitutionService: TimetableSubstitutionService,
  ) {}

  @Get()
  @Permissions('timetable:read')
  listTimetable(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
  ) {
    return this.timetableService.listTimetable(auth, classId);
  }

  // --- Periods ---

  @Get('periods')
  @Permissions('timetable:read')
  listPeriods(
    @CurrentAuth() auth: AuthContext,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.timetableService.listPeriods(auth, academicYearId);
  }

  @Post('periods')
  @Permissions('timetable:create')
  createPeriod(
    @Body() dto: CreateTimetablePeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createPeriod(dto, auth);
  }

  @Patch('periods/:id')
  @Permissions('timetable:update')
  updatePeriod(
    @Param('id') id: string,
    @Body() dto: UpdateTimetablePeriodDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updatePeriod(id, dto, auth);
  }

  @Delete('periods/:id')
  @Permissions('timetable:delete')
  deletePeriod(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.deletePeriod(id, auth);
  }

  // --- Rooms ---

  @Get('rooms')
  @Permissions('timetable:read')
  listRooms(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.listRooms(auth);
  }

  @Post('rooms')
  @Permissions('timetable:create')
  createRoom(@Body() dto: CreateRoomDto, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.createRoom(dto, auth);
  }

  @Patch('rooms/:id')
  @Permissions('timetable:update')
  updateRoom(
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateRoom(id, dto, auth);
  }

  @Delete('rooms/:id')
  @Permissions('timetable:delete')
  deleteRoom(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.deleteRoom(id, auth);
  }

  // --- Versions ---

  @Get('versions')
  @Permissions('timetable:read')
  listVersions(
    @CurrentAuth() auth: AuthContext,
    @Query() query: TimetableVersionQueryDto,
  ) {
    return this.timetableService.listVersions(auth, query);
  }

  @Post('versions')
  @Permissions('timetable:create')
  createVersion(
    @Body() dto: CreateTimetableVersionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createVersion(dto, auth);
  }

  @Get('versions/:id')
  @Permissions('timetable:read')
  getVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.getVersion(id, auth);
  }

  @Patch('versions/:id')
  @Permissions('timetable:update')
  updateVersion(
    @Param('id') id: string,
    @Body() dto: UpdateTimetableVersionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateVersion(id, dto, auth);
  }

  @Post('versions/:id/restore')
  @Permissions('timetable:create')
  restoreVersion(
    @Param('id') id: string,
    @Body() dto: RestoreTimetableVersionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.restoreVersion(id, dto, auth);
  }

  @Get('versions/:id/compare/:targetId')
  @Permissions('timetable:read')
  compareVersions(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.compareVersions(id, targetId, auth);
  }

  // --- Version Lifecycle ---

  @Post('versions/:id/validate')
  @Permissions('timetable:read')
  validateVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.validateVersion(id, auth);
  }

  @Patch('versions/:id/publish')
  @Permissions('timetable:publish')
  publishVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.publishVersion(id, auth);
  }

  @Patch('versions/:id/lock')
  @Permissions('timetable:publish')
  lockVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.lockVersion(id, auth);
  }

  @Patch('versions/:id/archive')
  @Permissions('timetable:publish')
  archiveVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.archiveVersion(id, auth);
  }

  @Patch('versions/:id/reopen-draft')
  @Permissions('timetable:publish')
  reopenVersion(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.reopenVersion(id, auth);
  }

  // --- Slots ---

  @Post('versions/:id/slots')
  @Permissions('timetable:create')
  createVersionSlot(
    @Param('id') id: string,
    @Body() dto: CreateVersionSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createVersionSlot(id, dto, auth);
  }

  @Patch('slots/:id')
  @Permissions('timetable:update')
  updateSlot(
    @Param('id') id: string,
    @Body() dto: UpdateVersionSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateSlot(id, dto, auth);
  }

  @Delete('slots/:id')
  @Permissions('timetable:delete')
  deleteSlot(@Param('id') id: string, @CurrentAuth() auth: AuthContext) {
    return this.timetableService.deleteSlot(id, auth);
  }

  // --- Teacher Availability ---

  @Get('teacher-availability')
  @Permissions('timetable:read')
  listTeacherAvailability(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListTeacherAvailabilityQueryDto,
  ) {
    return this.timetableService.listTeacherAvailability(auth, query);
  }

  @Get('teachers/:teacherId/availability')
  @Permissions('timetable:read')
  getTeacherAvailability(
    @Param('teacherId') teacherId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.getTeacherAvailability(teacherId, auth);
  }

  @Post('teachers/:teacherId/availability')
  @Permissions('timetable:manage')
  upsertTeacherAvailability(
    @Param('teacherId') teacherId: string,
    @Body() dto: TeacherAvailabilityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createTeacherAvailability(
      teacherId,
      dto,
      auth,
    );
  }

  @Patch('teacher-availability/:id')
  @Permissions('timetable:manage')
  updateTeacherAvailability(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAvailabilityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateTeacherAvailability(id, dto, auth);
  }

  @Delete('teacher-availability/:id')
  @Permissions('timetable:manage')
  deleteTeacherAvailability(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.deleteTeacherAvailability(id, auth);
  }

  // --- Workload Rules ---

  @Get('workload-rules')
  @Permissions('timetable:read')
  listTeacherWorkloadRules(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListTeacherWorkloadQueryDto,
  ) {
    return this.timetableService.listTeacherWorkloadRules(auth, query);
  }

  @Get('workload-rules/:teacherId')
  @Permissions('timetable:read')
  getTeacherWorkloadRule(
    @Param('teacherId') teacherId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.getTeacherWorkloadRule(
      teacherId,
      auth,
      academicYearId,
    );
  }

  @Post('workload-rules/:teacherId')
  @Permissions('timetable:manage')
  upsertTeacherWorkloadRule(
    @Param('teacherId') teacherId: string,
    @Body() dto: UpsertTeacherWorkloadLimitDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.upsertTeacherWorkloadRule(
      teacherId,
      dto,
      auth,
    );
  }

  @Patch('workload-rules/:id')
  @Permissions('timetable:manage')
  updateTeacherWorkloadRule(
    @Param('id') id: string,
    @Body() dto: UpsertTeacherWorkloadLimitDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateTeacherWorkloadRule(id, dto, auth);
  }

  // --- Subject Weekly Requirements ---

  @Get('subject-weekly-requirements')
  @Permissions('timetable:read')
  listSubjectWeeklyRequirements(
    @CurrentAuth() auth: AuthContext,
    @Query() query: ListSubjectWeeklyRequirementQueryDto,
  ) {
    return this.timetableService.listSubjectWeeklyRequirements(auth, query);
  }

  @Post('subject-weekly-requirements')
  @Permissions('timetable:manage')
  createSubjectWeeklyRequirement(
    @Body() dto: CreateSubjectWeeklyRequirementDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createSubjectWeeklyRequirement(dto, auth);
  }

  @Patch('subject-weekly-requirements/:id')
  @Permissions('timetable:manage')
  updateSubjectWeeklyRequirement(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectWeeklyRequirementDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateSubjectWeeklyRequirement(id, dto, auth);
  }

  @Delete('subject-weekly-requirements/:id')
  @Permissions('timetable:manage')
  deleteSubjectWeeklyRequirement(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.deleteSubjectWeeklyRequirement(id, auth);
  }

  // --- Workload & Timetable Reports ---

  @Get('workload')
  @Permissions('timetable:read')
  listTeacherWorkload(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.listTeacherWorkload(auth);
  }

  @Get('teachers/:teacherId/workload')
  @Permissions('timetable:read')
  getTeacherWorkload(
    @Param('teacherId') teacherId: string,
    @Query() query: WorkloadQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.getTeacherWorkload(teacherId, query, auth);
  }

  @Get('reports/teacher/:teacherId')
  @Permissions('timetable:read')
  getTeacherTimetable(
    @Param('teacherId') teacherId: string,
    @Query() query: WorkloadQueryDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.getTeacherTimetable(teacherId, query, auth);
  }

  @Get('reports/class/:classId')
  @Permissions('timetable:read')
  exportClassTimetable(
    @Param('classId') classId: string,
    @Query('sectionId') sectionId: string,
    @Query('academicYearId') academicYearId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.exportClassTimetable(
      classId,
      sectionId || null,
      academicYearId,
      auth,
    );
  }

  // --- Substitutions ---

  @Get('substitutions')
  @Permissions('timetable:read')
  listSubstitutions(
    @CurrentAuth() auth: AuthContext,
    @Query() query: SubstitutionQueryDto,
  ) {
    return this.substitutionService.listSubstitutions(auth, query);
  }

  @Post('substitutions')
  @Permissions('timetable:substitute')
  createSubstitution(
    @Body() dto: CreateSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.substitutionService.createSubstitution(dto, auth);
  }

  @Patch('substitutions/:id')
  @Permissions('timetable:substitute')
  updateSubstitution(
    @Param('id') id: string,
    @Body() dto: UpdateSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.substitutionService.updateSubstitution(id, dto, auth);
  }

  @Patch('substitutions/:id/assign')
  @Permissions('timetable:substitute')
  assignSubstitution(
    @Param('id') id: string,
    @Body() dto: AssignSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.substitutionService.assignSubstitution(id, dto, auth);
  }

  @Patch('substitutions/:id/cancel')
  @Permissions('timetable:substitute')
  cancelSubstitution(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.substitutionService.cancelSubstitution(id, auth);
  }

  @Patch('substitutions/:id/complete')
  @Permissions('timetable:substitute')
  completeSubstitution(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.substitutionService.completeSubstitution(id, auth);
  }
}

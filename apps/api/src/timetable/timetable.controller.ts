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
  CreateSubstitutionDto,
  CreateTimetablePeriodDto,
  CreateTimetableVersionDto,
  CreateVersionSlotDto,
  SubstitutionQueryDto,
  TeacherAvailabilityDto,
  TimetableVersionQueryDto,
  UpdateRoomDto,
  UpdateSubstitutionDto,
  UpdateTimetablePeriodDto,
  UpdateVersionSlotDto,
  WorkloadQueryDto,
} from './dto/timetable-setup.dto';
import { TimetableService } from './timetable.service';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions('timetable:read')
  listTimetable(
    @CurrentAuth() auth: AuthContext,
    @Query('classId') classId?: string,
  ) {
    return this.timetableService.listTimetable(auth, classId);
  }

  @Post()
  @Permissions('timetable:create')
  createLegacySlot(
    @Body() dto: CreateTimetableSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createTimetableSlot(dto, auth);
  }

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

  @Post('versions/:id/slots')
  @Permissions('timetable:create')
  createVersionSlot(
    @Param('id') id: string,
    @Body() dto: CreateVersionSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createVersionSlot(id, dto, auth);
  }

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

  @Get('teachers/:teacherId/availability')
  @Permissions('timetable:read')
  listTeacherAvailability(
    @Param('teacherId') teacherId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.listTeacherAvailability(teacherId, auth);
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

  @Patch('availability/:id')
  @Permissions('timetable:manage')
  updateTeacherAvailability(
    @Param('id') id: string,
    @Body() dto: TeacherAvailabilityDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateTeacherAvailability(id, dto, auth);
  }

  @Delete('availability/:id')
  @Permissions('timetable:manage')
  deleteTeacherAvailability(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.deleteTeacherAvailability(id, auth);
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

  @Get('workload')
  @Permissions('timetable:read')
  listTeacherWorkload(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.listTeacherWorkload(auth);
  }

  @Get('substitutions')
  @Permissions('timetable:read')
  listSubstitutions(
    @CurrentAuth() auth: AuthContext,
    @Query() query: SubstitutionQueryDto,
  ) {
    return this.timetableService.listSubstitutions(auth, query);
  }

  @Post('substitutions')
  @Permissions('timetable:substitute')
  createSubstitution(
    @Body() dto: CreateSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createSubstitution(dto, auth);
  }

  @Patch('substitutions/:id')
  @Permissions('timetable:substitute')
  updateSubstitution(
    @Param('id') id: string,
    @Body() dto: UpdateSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.updateSubstitution(id, dto, auth);
  }

  @Patch('substitutions/:id/assign')
  @Permissions('timetable:substitute')
  assignSubstitution(
    @Param('id') id: string,
    @Body() dto: AssignSubstitutionDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.assignSubstitution(id, dto, auth);
  }

  @Patch('substitutions/:id/cancel')
  @Permissions('timetable:substitute')
  cancelSubstitution(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.cancelSubstitution(id, auth);
  }

  @Patch('substitutions/:id/complete')
  @Permissions('timetable:substitute')
  completeSubstitution(
    @Param('id') id: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.completeSubstitution(id, auth);
  }
}

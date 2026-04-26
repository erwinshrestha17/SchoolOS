import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { CreateTimetableSlotDto } from './dto/create-timetable-slot.dto';
import { TimetableService } from './timetable.service';

@Controller('timetable')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TimetableController {
  constructor(private readonly timetableService: TimetableService) {}

  @Get()
  @Permissions('timetable:read')
  listTimetable(@CurrentAuth() auth: AuthContext) {
    return this.timetableService.listTimetable(auth);
  }

  @Post()
  @Permissions('timetable:manage')
  createSlot(
    @Body() dto: CreateTimetableSlotDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.timetableService.createTimetableSlot(dto, auth);
  }
}

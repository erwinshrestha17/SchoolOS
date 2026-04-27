import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AssignTransportDriverDto } from './dto/assign-transport-driver.dto';
import { BroadcastRouteDelayDto } from './dto/broadcast-route-delay.dto';
import { CreateTransportRouteDto } from './dto/create-transport-route.dto';
import { CreateTransportVehicleDto } from './dto/create-transport-vehicle.dto';
import { EnrollTransportStudentDto } from './dto/enroll-transport-student.dto';
import { RecordTransportLogDto } from './dto/record-transport-log.dto';
import { TransportService } from './transport.service';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get('routes')
  @Permissions('transport:read')
  listRoutes(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listRoutes(auth);
  }

  @Post('routes')
  @Permissions('transport:manage')
  createRoute(
    @Body() dto: CreateTransportRouteDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.createRoute(dto, auth);
  }

  @Get('vehicles')
  @Permissions('transport:read')
  listVehicles(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listVehicles(auth);
  }

  @Post('vehicles')
  @Permissions('transport:manage')
  createVehicle(
    @Body() dto: CreateTransportVehicleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.createVehicle(dto, auth);
  }

  @Post('drivers')
  @Permissions('transport:manage')
  assignDriver(
    @Body() dto: AssignTransportDriverDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.assignDriver(dto, auth);
  }

  @Get('enrollments')
  @Permissions('transport:read')
  listEnrollments(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
  ) {
    return this.transportService.listEnrollments(auth, routeId);
  }

  @Post('enrollments')
  @Permissions('transport:manage')
  enrollStudent(
    @Body() dto: EnrollTransportStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.enrollStudent(dto, auth);
  }

  @Get('logs')
  @Permissions('transport:read')
  listLogs(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
  ) {
    return this.transportService.listLogs(auth, routeId);
  }

  @Post('logs')
  @Permissions('transport:manage')
  recordLog(
    @Body() dto: RecordTransportLogDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.recordLog(dto, auth);
  }

  @Post('delays')
  @Permissions('transport:manage')
  broadcastDelay(
    @Body() dto: BroadcastRouteDelayDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.broadcastDelay(dto, auth);
  }

  @Get('reports')
  @Permissions('transport:read')
  getReports(@CurrentAuth() auth: AuthContext) {
    return this.transportService.getReports(auth);
  }
}

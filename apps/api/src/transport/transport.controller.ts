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
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { AssignTransportDriverDto } from './dto/assign-transport-driver.dto';
import { BroadcastRouteDelayDto } from './dto/broadcast-route-delay.dto';
import { CompleteTransportTripDto } from './dto/complete-transport-trip.dto';
import { CreateTransportRouteDto } from './dto/create-transport-route.dto';
import { CreateTransportStopDto } from './dto/create-transport-stop.dto';
import { CreateTransportVehicleDto } from './dto/create-transport-vehicle.dto';
import { EnrollTransportStudentDto } from './dto/enroll-transport-student.dto';
import { MarkTransportStudentStatusDto } from './dto/mark-transport-student-status.dto';
import { RecordTransportLogDto } from './dto/record-transport-log.dto';
import { StartTransportTripDto } from './dto/start-transport-trip.dto';
import { TransportLocationPingDto } from './dto/transport-location-ping.dto';
import { UpdateTransportRouteDto } from './dto/update-transport-route.dto';
import { UpdateTransportStopDto } from './dto/update-transport-stop.dto';
import { UpdateTransportVehicleDto } from './dto/update-transport-vehicle.dto';
import { TransportService } from './transport.service';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard)
export class TransportController {
  constructor(private readonly transportService: TransportService) {}

  @Get('routes')
  @Permissions('transport:routes:read')
  listRoutes(@CurrentAuth() auth: AuthContext, @Query('q') query?: string) {
    return this.transportService.listRoutes(auth, query);
  }

  @Post('routes')
  @Permissions('transport:routes:create')
  createRoute(
    @Body() dto: CreateTransportRouteDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.createRoute(dto, auth);
  }

  @Patch('routes/:id')
  @Permissions('transport:routes:update')
  updateRoute(
    @Param('id') routeId: string,
    @Body() dto: UpdateTransportRouteDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.updateRoute(routeId, dto, auth);
  }

  @Get('stops')
  @Permissions('transport:routes:read')
  listStops(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
  ) {
    return this.transportService.listStops(auth, routeId);
  }

  @Post('stops')
  @Permissions('transport:routes:create')
  createStop(
    @Body() dto: CreateTransportStopDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.createStop(dto, auth);
  }

  @Patch('stops/:id')
  @Permissions('transport:routes:update')
  updateStop(
    @Param('id') stopId: string,
    @Body() dto: UpdateTransportStopDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.updateStop(stopId, dto, auth);
  }

  @Get('vehicles')
  @Permissions('transport:vehicles:read')
  listVehicles(@CurrentAuth() auth: AuthContext, @Query('q') query?: string) {
    return this.transportService.listVehicles(auth, query);
  }

  @Post('vehicles')
  @Permissions('transport:vehicles:create')
  createVehicle(
    @Body() dto: CreateTransportVehicleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.createVehicle(dto, auth);
  }

  @Patch('vehicles/:id')
  @Permissions('transport:vehicles:update')
  updateVehicle(
    @Param('id') vehicleId: string,
    @Body() dto: UpdateTransportVehicleDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.updateVehicle(vehicleId, dto, auth);
  }

  @Get('assignments/drivers')
  @Permissions('transport:assignments:read')
  listDriverAssignments(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.transportService.listDriverAssignments(auth, {
      routeId,
      vehicleId,
    });
  }

  @Post('assignments/drivers')
  @Permissions('transport:assignments:create')
  assignDriver(
    @Body() dto: AssignTransportDriverDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.assignDriver(dto, auth);
  }

  @Get('assignments/students')
  @Permissions('transport:assignments:read')
  listStudentAssignments(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.transportService.listStudentAssignments(auth, {
      routeId,
      studentId,
    });
  }

  @Post('assignments/students')
  @Permissions('transport:assignments:create')
  assignStudent(
    @Body() dto: EnrollTransportStudentDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.assignStudent(dto, auth);
  }

  @Post('trips')
  @Permissions('transport:trips:create')
  startTrip(
    @Body() dto: StartTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.startTrip(dto, auth);
  }

  @Patch('trips/:id/complete')
  @Permissions('transport:trips:update')
  completeTrip(
    @Param('id') tripId: string,
    @Body() dto: CompleteTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.completeTrip(tripId, dto, auth);
  }

  @Patch('trips/:id/students/boarded')
  @Permissions('transport:trips:update')
  markStudentBoarded(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentBoarded(tripId, dto, auth);
  }

  @Patch('trips/:id/students/dropped')
  @Permissions('transport:trips:update')
  markStudentDropped(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentDropped(tripId, dto, auth);
  }

  @Get('trips/active')
  @Permissions('transport:trips:read')
  listActiveTrips(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listActiveTrips(auth);
  }

  @Get('trips/history')
  @Permissions('transport:trips:read')
  listTripHistory(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
    @Query('vehicleId') vehicleId?: string,
  ) {
    return this.transportService.listTripHistory(auth, { routeId, vehicleId });
  }

  @Post('trips/:id/location')
  @Permissions('transport:location:update')
  recordLocationPing(
    @Param('id') tripId: string,
    @Body() dto: TransportLocationPingDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.recordLocationPing(tripId, dto, auth);
  }

  @Get('trips/:id/location/latest')
  @Permissions('transport:location:read')
  getLatestTripLocation(
    @Param('id') tripId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.getLatestTripLocation(tripId, auth);
  }

  @Get('logs')
  @Permissions('transport:reports:read')
  listLogs(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
  ) {
    return this.transportService.listLogs(auth, routeId);
  }

  @Post('logs')
  @Permissions('transport:trips:update')
  recordLog(
    @Body() dto: RecordTransportLogDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.recordLog(dto, auth);
  }

  @Post('delays')
  @Permissions('transport:trips:update')
  broadcastDelay(
    @Body() dto: BroadcastRouteDelayDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.broadcastDelay(dto, auth);
  }

  @Get('reports')
  @Permissions('transport:reports:read')
  getReports(@CurrentAuth() auth: AuthContext) {
    return this.transportService.getReports(auth);
  }
}

import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Query,
  Sse,
  Header,
  MessageEvent,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { CurrentAuth } from '../auth/decorators/current-auth.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import type { AuthContext } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesPermissionsGuard } from '../auth/guards/roles-permissions.guard';
import { EntitlementGuard } from '../auth/guards/entitlement.guard';
import { Entitlement } from '../auth/decorators/entitlement.decorator';
import { AssignTransportDriverDto } from './dto/assign-transport-driver.dto';
import { BroadcastRouteDelayDto } from './dto/broadcast-route-delay.dto';
import { CancelTransportTripDto } from './dto/cancel-transport-trip.dto';
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
import { TransportHardeningService } from './transport-hardening.service';
import { TransportService } from './transport.service';

@Controller('transport')
@UseGuards(JwtAuthGuard, RolesPermissionsGuard, EntitlementGuard)
@Entitlement('module.transport')
export class TransportController {
  constructor(
    private readonly transportService: TransportService,
    private readonly transportHardeningService: TransportHardeningService,
  ) {}

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

  @Patch('assignments/students/:id/pause')
  @Permissions('transport:assignments:update')
  pauseStudentAssignment(
    @Param('id') assignmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportHardeningService.pauseStudentAssignment(
      assignmentId,
      auth,
    );
  }

  @Patch('assignments/students/:id/end')
  @Permissions('transport:assignments:update')
  endStudentAssignment(
    @Param('id') assignmentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportHardeningService.endStudentAssignment(
      assignmentId,
      auth,
    );
  }

  @Get('parent/students/:studentId/active-trip')
  @Permissions('transport:tracking:parent')
  getParentStudentActiveTrip(
    @Param('studentId') studentId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportHardeningService.getParentStudentActiveTrip(
      studentId,
      auth,
    );
  }

  @Get('driver/dashboard')
  @Permissions('transport:operate')
  getDriverDashboard(@CurrentAuth() auth: AuthContext) {
    return this.transportService.getDriverDashboard(auth);
  }

  @Get('driver/assignments')
  @Permissions('transport:operate')
  listDriverOwnAssignments(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listDriverAssignments(auth, {});
  }

  @Get('driver/trips/active')
  @Permissions('transport:operate')
  listDriverActiveTrips(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listActiveTrips(auth);
  }

  @Get('driver/trips/history')
  @Permissions('transport:operate')
  listDriverTripHistory(@CurrentAuth() auth: AuthContext) {
    return this.transportService.listTripHistory(auth, {});
  }

  @Post('driver/trips')
  @Permissions('transport:operate')
  startDriverTrip(
    @Body() dto: StartTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.startTrip(dto, auth);
  }

  @Get('driver/trips/:id/manifest')
  @Permissions('transport:operate')
  getDriverTripManifest(
    @Param('id') tripId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.getDriverTripManifest(tripId, auth);
  }

  @Patch('driver/trips/:id/complete')
  @Permissions('transport:operate')
  completeDriverTrip(
    @Param('id') tripId: string,
    @Body() dto: CompleteTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.completeTrip(tripId, dto, auth);
  }

  @Patch('driver/trips/:id/students/boarded')
  @Permissions('transport:operate')
  markDriverStudentBoarded(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentBoarded(tripId, dto, auth);
  }

  @Patch('driver/trips/:id/students/dropped')
  @Permissions('transport:operate')
  markDriverStudentDropped(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentDropped(tripId, dto, auth);
  }

  @Patch('driver/trips/:id/students/absent')
  @Permissions('transport:operate')
  markDriverStudentAbsent(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentAbsent(tripId, dto, auth);
  }

  @Post('driver/trips/:id/location')
  @Permissions('transport:operate')
  recordDriverLocationPing(
    @Param('id') tripId: string,
    @Body() dto: TransportLocationPingDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.recordLocationPing(tripId, dto, auth);
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
  @Permissions('transport:trips:update', 'transport:operate')
  completeTrip(
    @Param('id') tripId: string,
    @Body() dto: CompleteTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.completeTrip(tripId, dto, auth);
  }

  @Patch('trips/:id/cancel')
  @Permissions('transport:trips:update')
  cancelTrip(
    @Param('id') tripId: string,
    @Body() dto: CancelTransportTripDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportHardeningService.cancelTrip(tripId, dto, auth);
  }

  @Patch('trips/:id/students/boarded')
  @Permissions('transport:trips:update', 'transport:operate')
  markStudentBoarded(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentBoarded(tripId, dto, auth);
  }

  @Patch('trips/:id/students/dropped')
  @Permissions('transport:trips:update', 'transport:operate')
  markStudentDropped(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentDropped(tripId, dto, auth);
  }

  @Patch('trips/:id/students/absent')
  @Permissions('transport:trips:update', 'transport:operate')
  markStudentAbsent(
    @Param('id') tripId: string,
    @Body() dto: MarkTransportStudentStatusDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markStudentAbsent(tripId, dto, auth);
  }

  @Get('trips/:id')
  @Permissions('transport:trips:read')
  getTripDetails(
    @Param('id') tripId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.getTripDetails(tripId, auth);
  }

  @Patch('trips/:id/delay')
  @Permissions('transport:trips:update', 'transport:operate')
  markTripDelay(
    @Param('id') tripId: string,
    @Body()
    dto: { isDelayed: boolean; delayReason?: string; delayMinutes?: number },
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.markTripDelay(tripId, dto, auth);
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
  @Permissions('transport:location:update', 'transport:operate')
  recordLocationPing(
    @Param('id') tripId: string,
    @Body() dto: TransportLocationPingDto,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.recordLocationPing(tripId, dto, auth);
  }

  @Post('location/cleanup')
  @Permissions('transport:manage')
  cleanupLocationHistory(
    @CurrentAuth() auth: AuthContext,
    @Query('days') days?: number,
  ) {
    return this.transportService.cleanupLocationHistory(auth, days);
  }

  @Get('trips/:id/location/latest')
  @Permissions('transport:location:read')
  getLatestTripLocation(
    @Param('id') tripId: string,
    @CurrentAuth() auth: AuthContext,
  ) {
    return this.transportService.getLatestTripLocation(tripId, auth);
  }

  @Sse('trips/:id/live')
  @Permissions('transport:location:read')
  streamTripLocation(
    @Param('id') tripId: string,
    @CurrentAuth() auth: AuthContext,
  ): Observable<MessageEvent> {
    return this.transportService.subscribeToTripLocation(tripId, auth);
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
  @Permissions('transport:trips:update', 'transport:operate')
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

  @Get('reports/trips')
  @Permissions('transport:reports:read')
  getTripHistoryReport(
    @CurrentAuth() auth: AuthContext,
    @Query('routeId') routeId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverAssignmentId') driverAssignmentId?: string,
  ) {
    return this.transportHardeningService.getTripHistoryReport(auth, {
      routeId,
      vehicleId,
      driverAssignmentId,
    });
  }

  @Get('reports/boarding')
  @Permissions('transport:reports:read')
  getBoardingReport(
    @CurrentAuth() auth: AuthContext,
    @Query('tripId') tripId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.transportHardeningService.getBoardingReport(auth, {
      tripId,
      studentId,
    });
  }

  @Get('reports/trips.csv')
  @Header('Content-Type', 'text/csv')
  @Header(
    'Content-Disposition',
    'attachment; filename="transport-trip-history.csv"',
  )
  @Permissions('transport:reports:read')
  exportTripHistoryCsv(@CurrentAuth() auth: AuthContext) {
    return this.transportHardeningService.exportTripHistoryCsv(auth);
  }
}

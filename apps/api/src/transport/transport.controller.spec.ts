import type { AuthContext } from '../auth/auth.types';
import { TransportController } from './transport.controller';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  email: 'transport@school.test',
  roles: ['admin'],
  permissions: [],
  authMethod: 'PASSWORD',
};

function createController() {
  const transportService = {
    listRoutes: jest.fn(),
    createRoute: jest.fn(),
    updateRoute: jest.fn(),
    listStops: jest.fn(),
    createStop: jest.fn(),
    updateStop: jest.fn(),
    listVehicles: jest.fn(),
    createVehicle: jest.fn(),
    updateVehicle: jest.fn(),
    listDriverAssignments: jest.fn(),
    assignDriver: jest.fn(),
    listStudentAssignments: jest.fn(),
    assignStudent: jest.fn(),
    startTrip: jest.fn(),
    completeTrip: jest.fn(),
    markStudentBoarded: jest.fn(),
    markStudentDropped: jest.fn(),
    markStudentAbsent: jest.fn(),
    listActiveTrips: jest.fn(),
    listTripHistory: jest.fn(),
    recordLocationPing: jest.fn(),
    getLatestTripLocation: jest.fn(),
    listLogs: jest.fn(),
    recordLog: jest.fn(),
    broadcastDelay: jest.fn(),
    getReports: jest.fn(),
  };
  const transportHardeningService = {
    cancelTrip: jest.fn(),
    pauseStudentAssignment: jest.fn(),
    endStudentAssignment: jest.fn(),
    getParentStudentActiveTrip: jest.fn(),
    getTripHistoryReport: jest.fn(),
    getBoardingReport: jest.fn(),
    exportTripHistoryCsv: jest.fn(),
  };

  return {
    controller: new TransportController(
      transportService as never,
      transportHardeningService as never,
    ),
    transportService,
    transportHardeningService,
  };
}

describe('TransportController M8B contracts', () => {
  it('delegates route, stop, and vehicle setup with current actor', () => {
    const { controller, transportService } = createController();
    const routeDto = { name: 'Route A', code: 'R-A', stops: [] };
    const stopDto = { routeId: 'route-1', name: 'Gate 1', sequence: 1 };
    const vehicleDto = { registrationNumber: 'BA-1-KHA-1234', capacity: 30 };
    transportService.listRoutes.mockReturnValue([{ id: 'route-1' }]);
    transportService.createRoute.mockReturnValue({ id: 'route-1' });
    transportService.updateRoute.mockReturnValue({ id: 'route-1' });
    transportService.listStops.mockReturnValue([{ id: 'stop-1' }]);
    transportService.createStop.mockReturnValue({ id: 'stop-1' });
    transportService.updateStop.mockReturnValue({ id: 'stop-1' });
    transportService.listVehicles.mockReturnValue([{ id: 'vehicle-1' }]);
    transportService.createVehicle.mockReturnValue({ id: 'vehicle-1' });
    transportService.updateVehicle.mockReturnValue({ id: 'vehicle-1' });

    expect(controller.listRoutes(actor, 'Route')).toEqual([{ id: 'route-1' }]);
    expect(controller.createRoute(routeDto as never, actor)).toEqual({
      id: 'route-1',
    });
    expect(controller.updateRoute('route-1', routeDto as never, actor)).toEqual(
      { id: 'route-1' },
    );
    expect(controller.listStops(actor, 'route-1')).toEqual([{ id: 'stop-1' }]);
    expect(controller.createStop(stopDto as never, actor)).toEqual({
      id: 'stop-1',
    });
    expect(controller.updateStop('stop-1', stopDto as never, actor)).toEqual({
      id: 'stop-1',
    });
    expect(controller.listVehicles(actor, 'BA')).toEqual([{ id: 'vehicle-1' }]);
    expect(controller.createVehicle(vehicleDto as never, actor)).toEqual({
      id: 'vehicle-1',
    });
    expect(
      controller.updateVehicle('vehicle-1', vehicleDto as never, actor),
    ).toEqual({ id: 'vehicle-1' });
    expect(transportService.createRoute).toHaveBeenCalledWith(routeDto, actor);
    expect(transportService.createStop).toHaveBeenCalledWith(stopDto, actor);
    expect(transportService.createVehicle).toHaveBeenCalledWith(
      vehicleDto,
      actor,
    );
  });

  it('delegates driver and student assignment lifecycle with tenant actor', () => {
    const { controller, transportService, transportHardeningService } =
      createController();
    const driverDto = {
      vehicleId: 'vehicle-1',
      routeId: 'route-1',
      staffId: 'staff-1',
      startsAt: '2026-05-09T00:00:00.000Z',
    };
    const studentDto = {
      studentId: 'student-1',
      routeId: 'route-1',
      stopId: 'stop-1',
    };
    transportService.listDriverAssignments.mockReturnValue([
      { id: 'driver-assignment-1' },
    ]);
    transportService.assignDriver.mockReturnValue({
      id: 'driver-assignment-1',
    });
    transportService.listStudentAssignments.mockReturnValue([
      { id: 'student-assignment-1' },
    ]);
    transportService.assignStudent.mockReturnValue({
      id: 'student-assignment-1',
    });
    transportHardeningService.pauseStudentAssignment.mockReturnValue({
      status: 'PAUSED',
    });
    transportHardeningService.endStudentAssignment.mockReturnValue({
      status: 'ENDED',
    });

    expect(
      controller.listDriverAssignments(actor, 'route-1', 'vehicle-1'),
    ).toEqual([{ id: 'driver-assignment-1' }]);
    expect(controller.assignDriver(driverDto as never, actor)).toEqual({
      id: 'driver-assignment-1',
    });
    expect(
      controller.listStudentAssignments(actor, 'route-1', 'student-1'),
    ).toEqual([{ id: 'student-assignment-1' }]);
    expect(controller.assignStudent(studentDto as never, actor)).toEqual({
      id: 'student-assignment-1',
    });
    expect(
      controller.pauseStudentAssignment('student-assignment-1', actor),
    ).toEqual({ status: 'PAUSED' });
    expect(
      controller.endStudentAssignment('student-assignment-1', actor),
    ).toEqual({ status: 'ENDED' });
    expect(transportService.assignDriver).toHaveBeenCalledWith(
      driverDto,
      actor,
    );
    expect(transportService.assignStudent).toHaveBeenCalledWith(
      studentDto,
      actor,
    );
    expect(
      transportHardeningService.pauseStudentAssignment,
    ).toHaveBeenCalledWith('student-assignment-1', actor);
    expect(transportHardeningService.endStudentAssignment).toHaveBeenCalledWith(
      'student-assignment-1',
      actor,
    );
  });

  it('delegates trip start complete cancel and active/history routes', () => {
    const { controller, transportService, transportHardeningService } =
      createController();
    const startDto = {
      routeId: 'route-1',
      vehicleId: 'vehicle-1',
      driverAssignmentId: 'driver-assignment-1',
      direction: 'PICKUP',
    };
    const completeDto = { notes: 'Completed safely' };
    const cancelDto = { reason: 'Vehicle breakdown' };
    transportService.startTrip.mockReturnValue({
      id: 'trip-1',
      status: 'ACTIVE',
    });
    transportService.completeTrip.mockReturnValue({
      id: 'trip-1',
      status: 'COMPLETED',
    });
    transportHardeningService.cancelTrip.mockReturnValue({
      id: 'trip-1',
      status: 'CANCELLED',
    });
    transportService.listActiveTrips.mockReturnValue([{ id: 'trip-1' }]);
    transportService.listTripHistory.mockReturnValue([{ id: 'trip-1' }]);

    expect(controller.startTrip(startDto as never, actor)).toEqual({
      id: 'trip-1',
      status: 'ACTIVE',
    });
    expect(controller.completeTrip('trip-1', completeDto, actor)).toEqual({
      id: 'trip-1',
      status: 'COMPLETED',
    });
    expect(controller.cancelTrip('trip-1', cancelDto, actor)).toEqual({
      id: 'trip-1',
      status: 'CANCELLED',
    });
    expect(controller.listActiveTrips(actor)).toEqual([{ id: 'trip-1' }]);
    expect(controller.listTripHistory(actor, 'route-1', 'vehicle-1')).toEqual([
      { id: 'trip-1' },
    ]);
    expect(transportService.startTrip).toHaveBeenCalledWith(startDto, actor);
    expect(transportService.completeTrip).toHaveBeenCalledWith(
      'trip-1',
      completeDto,
      actor,
    );
    expect(transportHardeningService.cancelTrip).toHaveBeenCalledWith(
      'trip-1',
      cancelDto,
      actor,
    );
    expect(transportService.listTripHistory).toHaveBeenCalledWith(actor, {
      routeId: 'route-1',
      vehicleId: 'vehicle-1',
    });
  });

  it('delegates boarding drop and notification-backed log/delay boundaries', () => {
    const { controller, transportService } = createController();
    const markDto = { studentId: 'student-1', notes: 'At main gate' };
    const logDto = {
      routeId: 'route-1',
      studentId: 'student-1',
      status: 'BOARDED',
    };
    const delayDto = {
      routeId: 'route-1',
      message: 'Traffic delay',
      estimatedDelay: '10 minutes',
    };
    transportService.markStudentBoarded.mockReturnValue({ status: 'BOARDED' });
    transportService.markStudentDropped.mockReturnValue({ status: 'DROPPED' });
    transportService.markStudentAbsent.mockReturnValue({ status: 'ABSENT' });
    transportService.recordLog.mockReturnValue({ id: 'log-1' });
    transportService.broadcastDelay.mockReturnValue({ deliveryCount: 1 });

    expect(controller.markStudentBoarded('trip-1', markDto, actor)).toEqual({
      status: 'BOARDED',
    });
    expect(controller.markStudentDropped('trip-1', markDto, actor)).toEqual({
      status: 'DROPPED',
    });
    expect(controller.markStudentAbsent('trip-1', markDto, actor)).toEqual({
      status: 'ABSENT',
    });
    expect(controller.recordLog(logDto as never, actor)).toEqual({
      id: 'log-1',
    });
    expect(controller.broadcastDelay(delayDto, actor)).toEqual({
      deliveryCount: 1,
    });
    expect(transportService.markStudentBoarded).toHaveBeenCalledWith(
      'trip-1',
      markDto,
      actor,
    );
    expect(transportService.markStudentDropped).toHaveBeenCalledWith(
      'trip-1',
      markDto,
      actor,
    );
    expect(transportService.markStudentAbsent).toHaveBeenCalledWith(
      'trip-1',
      markDto,
      actor,
    );
    expect(transportService.recordLog).toHaveBeenCalledWith(logDto, actor);
    expect(transportService.broadcastDelay).toHaveBeenCalledWith(
      delayDto,
      actor,
    );
  });

  it('delegates GPS ping and latest location through service/Redis boundary', () => {
    const { controller, transportService } = createController();
    const pingDto = {
      latitude: 27.7172,
      longitude: 85.324,
      speedKph: 22,
      recordedAt: '2026-05-09T08:00:00.000Z',
    };
    transportService.recordLocationPing.mockReturnValue({ tripId: 'trip-1' });
    transportService.getLatestTripLocation.mockReturnValue({
      tripId: 'trip-1',
    });

    expect(controller.recordLocationPing('trip-1', pingDto, actor)).toEqual({
      tripId: 'trip-1',
    });
    expect(controller.getLatestTripLocation('trip-1', actor)).toEqual({
      tripId: 'trip-1',
    });
    expect(transportService.recordLocationPing).toHaveBeenCalledWith(
      'trip-1',
      pingDto,
      actor,
    );
    expect(transportService.getLatestTripLocation).toHaveBeenCalledWith(
      'trip-1',
      actor,
    );
  });

  it('delegates parent child-specific active trip without exposing passenger list', () => {
    const { controller, transportHardeningService } = createController();
    transportHardeningService.getParentStudentActiveTrip.mockReturnValue({
      student: { id: 'student-1' },
      trip: { id: 'trip-1' },
      vehicle: { registrationNumber: 'BA-1-KHA-1234' },
    });

    const result = controller.getParentStudentActiveTrip('student-1', actor);

    expect(
      transportHardeningService.getParentStudentActiveTrip,
    ).toHaveBeenCalledWith('student-1', actor);
    expect(result).toEqual({
      student: { id: 'student-1' },
      trip: { id: 'trip-1' },
      vehicle: { registrationNumber: 'BA-1-KHA-1234' },
    });
    expect(JSON.stringify(result)).not.toContain('passenger');
  });

  it('delegates transport reports and CSV export from backend service', () => {
    const { controller, transportService, transportHardeningService } =
      createController();
    transportService.getReports.mockReturnValue({ activeTrips: 1 });
    transportHardeningService.getTripHistoryReport.mockReturnValue({
      items: [],
    });
    transportHardeningService.getBoardingReport.mockReturnValue({ items: [] });
    transportHardeningService.exportTripHistoryCsv.mockReturnValue(
      'Trip ID,Route\ntrip-1,Route A',
    );

    expect(controller.getReports(actor)).toEqual({ activeTrips: 1 });
    expect(
      controller.getTripHistoryReport(
        actor,
        'route-1',
        'vehicle-1',
        'driver-1',
      ),
    ).toEqual({ items: [] });
    expect(controller.getBoardingReport(actor, 'trip-1', 'student-1')).toEqual({
      items: [],
    });
    expect(controller.exportTripHistoryCsv(actor)).toBe(
      'Trip ID,Route\ntrip-1,Route A',
    );
    expect(transportHardeningService.getTripHistoryReport).toHaveBeenCalledWith(
      actor,
      {
        routeId: 'route-1',
        vehicleId: 'vehicle-1',
        driverAssignmentId: 'driver-1',
      },
    );
    expect(transportHardeningService.getBoardingReport).toHaveBeenCalledWith(
      actor,
      {
        tripId: 'trip-1',
        studentId: 'student-1',
      },
    );
    expect(transportHardeningService.exportTripHistoryCsv).toHaveBeenCalledWith(
      actor,
    );
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 3C Transport backend contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  it('exposes granular Transport Management endpoints and permissions', () => {
    const controller = read('src/transport/transport.controller.ts');

    for (const endpoint of [
      "@Get('routes')",
      "@Post('routes')",
      "@Patch('routes/:id')",
      "@Get('stops')",
      "@Post('stops')",
      "@Patch('stops/:id')",
      "@Get('vehicles')",
      "@Post('vehicles')",
      "@Patch('vehicles/:id')",
      "@Post('assignments/drivers')",
      "@Post('assignments/students')",
      "@Post('trips')",
      "@Patch('trips/:id/complete')",
      "@Patch('trips/:id/students/boarded')",
      "@Patch('trips/:id/students/dropped')",
      "@Get('trips/active')",
      "@Get('trips/history')",
      "@Post('trips/:id/location')",
      "@Get('trips/:id/location/latest')",
    ]) {
      expect(controller).toContain(endpoint);
    }

    for (const permission of [
      'transport:routes:create',
      'transport:routes:read',
      'transport:routes:update',
      'transport:vehicles:create',
      'transport:vehicles:read',
      'transport:vehicles:update',
      'transport:assignments:create',
      'transport:assignments:read',
      'transport:trips:create',
      'transport:trips:read',
      'transport:trips:update',
      'transport:location:read',
      'transport:location:update',
      'transport:reports:read',
    ]) {
      expect(controller).toContain(permission);
    }
  });

  it('adds transport trip, student status, and latest-location persistence schema', () => {
    const migration = read(
      'prisma/migrations/20260506141000_phase3c_transport_trip_foundation/migration.sql',
    );

    for (const model of [
      'TransportStudentAssignment',
      'TransportTrip',
      'TransportTripStudentStatus',
      'TransportLocationPing',
    ]) {
      expect(migration).toContain(`CREATE TABLE "${model}"`);
      expect(migration).toContain('"tenantId" TEXT NOT NULL');
    }

    for (const index of [
      'TransportRoute_tenantId_code_idx',
      'TransportRoute_tenantId_name_idx',
      'TransportVehicle_tenantId_registrationNumber_idx',
      'TransportDriverAssignment_tenantId_staffId_idx',
      'TransportStudentAssignment_tenantId_studentId_idx',
      'TransportTrip_tenantId_status_idx',
      'TransportTrip_tenantId_startedAt_idx',
      'TransportTrip_tenantId_routeId_idx',
      'TransportTrip_tenantId_vehicleId_idx',
      'TransportLocationPing_tenantId_tripId_recordedAt_idx',
    ]) {
      expect(migration).toContain(index);
    }

    expect(migration).toContain('TransportTrip_tenantId_vehicleId_active_key');
    expect(migration).toContain(
      'TransportVehicle_tenantId_registrationNumber_key',
    );
    expect(migration).toContain('TransportRoute_tenantId_code_key');
  });

  it('keeps transport business rules in the backend service', () => {
    const service = read('src/transport/transport.service.ts');

    for (const rule of [
      'Vehicle already has an active trip',
      'Cannot start trip without assigned driver and vehicle',
      'Trip is already completed',
      'Student is not assigned to this trip route',
      'Student cannot be dropped before boarding unless marked absent',
      'Location pings are accepted only for active trips',
      'transport:${tenantId}:trip:${tripId}:latest-location',
    ]) {
      expect(service).toContain(rule);
    }

    expect(service).toContain('where: { id: routeId, tenantId }');
    expect(service).toContain('where: { id: vehicleId, tenantId }');
    expect(service).toContain('where: { id: stopId, tenantId');
    expect(service).toContain('recordLocationPing');
    expect(service).toContain('.set(');
  });
});

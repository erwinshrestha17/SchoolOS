import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('M8B Transport backend contracts', () => {
  const root = join(__dirname, '..', '..');

  function read(relativePath: string) {
    return readFileSync(join(root, relativePath), 'utf8');
  }

  it('keeps transport tracking polling-only until live tracking is approved', () => {
    const controller = read('src/transport/transport.controller.ts');
    const service = read('src/transport/transport-m8b.service.ts');

    expect(controller).not.toContain('@Sse(');
    expect(controller).not.toContain("@Get('trips/:id/live')");
    expect(controller).not.toContain("@Sse('trips/:id/live')");
    expect(service).toContain('NO_LIVE_MAP_SSE_WEBSOCKET_YET');
    expect(service).toContain('POLLING_DEVICE_AUTH_CONTRACT');
  });

  it('exposes GPS ping contracts, acceptance/rejection reports, and stale GPS reports', () => {
    const controller = read('src/transport/transport.controller.ts');
    const service = read('src/transport/transport-m8b.service.ts');

    for (const endpoint of [
      "@Get('driver/gps-ping-contract')",
      "@Post('driver/trips/:id/gps-ping')",
      "@Get('reports/gps-pings')",
      "@Get('reports/stale-gps')",
    ]) {
      expect(controller).toContain(endpoint);
    }

    for (const contract of [
      'recordAutomatedDriverGpsPing',
      'getGpsAcceptRejectReport',
      'getStaleGpsReport',
      'staleLabel',
      'acceptedPersisted',
      'rejectedObserved',
    ]) {
      expect(service).toContain(contract);
    }
  });

  it('adds operational M8B reports and one-day route change contracts', () => {
    const controller = read('src/transport/transport.controller.ts');
    const service = read('src/transport/transport-m8b.service.ts');

    for (const endpoint of [
      "@Post('routes/one-day-changes')",
      "@Get('reports/one-day-route-changes')",
      "@Get('reports/vehicle-documents')",
      "@Get('reports/maintenance')",
      "@Get('reports/assignment-depth')",
      "@Post('driver/trips/:id/emergency-contact')",
      "@Patch('assignments/students/:id/fee-mapping')",
      "@Get('parent/students/:studentId/status')",
    ]) {
      expect(controller).toContain(endpoint);
    }

    for (const contract of [
      'scheduleOneDayRouteChange',
      'getVehicleDocumentExpiryReport',
      'getMaintenanceReminderReport',
      'getAssignmentDepthReport',
      'recordEmergencyContactFlow',
      'mapTransportFee',
      'getParentStudentStatus',
      'TransportEnrollmentStatus.ACTIVE',
    ]) {
      expect(service).toContain(contract);
    }
  });
});

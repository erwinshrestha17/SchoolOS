import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { TransportService } from './transport.service';
import { TransportHardeningService } from './transport-hardening.service';
import { TransportTripStatus } from '@prisma/client';

describe('Transport Security Boundaries', () => {
  let prisma: any;
  let redisClient: any;
  let service: TransportService;
  let hardeningService: TransportHardeningService;

  const tenantId = 'tenant-1';
  const adminActor: any = {
    userId: 'admin-1',
    tenantId,
    roles: ['admin'],
    permissions: ['transport:manage'],
  };

  const driverActor: any = {
    userId: 'driver-1',
    tenantId,
    roles: ['staff'],
    permissions: ['transport:operate'],
  };

  const parentActor: any = {
    userId: 'parent-1',
    tenantId,
    roles: ['guardian'],
    permissions: ['transport:tracking:parent'],
  };

  beforeEach(() => {
    prisma = {
      transportTrip: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      transportDriverAssignment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      studentGuardian: {
        findFirst: jest.fn(),
      },
      transportTripStudentStatus: {
        findFirst: jest.fn(),
      },
      transportLocationPing: {
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    redisClient = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      publish: jest.fn().mockResolvedValue(1),
      del: jest.fn(),
    };

    service = new TransportService(
      prisma as any,
      {} as any,
      {} as any,
      { getClient: () => redisClient } as any,
    );
    hardeningService = new TransportHardeningService(
      prisma as any,
      {} as any,
      {} as any,
      service,
    );
  });

  describe('Driver Boundary', () => {
    it('allows driver to record location for their assigned trip', async () => {
      const tripId = 'trip-1';
      const assignmentId = 'assignment-1';

      prisma.transportTrip.findFirst.mockResolvedValue({
        id: tripId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: assignmentId,
        vehicleId: 'v-1',
      });

      prisma.transportDriverAssignment.findFirst.mockResolvedValue({
        id: assignmentId,
        staff: { userId: driverActor.userId },
      });

      prisma.transportLocationPing.findFirst.mockResolvedValue(null);

      const result = await service.recordLocationPing(
        tripId,
        { latitude: 27.7172, longitude: 85.324 },
        driverActor,
      );

      expect(result).toMatchObject({ tripId, vehicleId: 'v-1' });
      expect(prisma.transportDriverAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, id: assignmentId },
        }),
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining(':location-pressure:driver-1'),
        '1',
        'EX',
        1,
        'NX',
      );
      expect(redisClient.set).toHaveBeenCalledWith(
        expect.stringContaining(':latest-location'),
        expect.any(String),
        'EX',
        21600,
      );
      expect(prisma.transportLocationPing.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, tripId }),
        }),
      );
    });

    it('scopes active trip lists to the assigned driver', async () => {
      prisma.transportTrip.findMany.mockResolvedValue([]);

      await service.listActiveTrips(driverActor);

      expect(prisma.transportTrip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            status: TransportTripStatus.ACTIVE,
            driverAssignment: { staff: { userId: driverActor.userId } },
          }),
        }),
      );
    });

    it('scopes driver assignments to the current driver', async () => {
      prisma.transportDriverAssignment.findMany.mockResolvedValue([]);

      await service.listDriverAssignments(driverActor, {});

      expect(prisma.transportDriverAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
            staff: { userId: driverActor.userId },
          }),
        }),
      );
    });

    it('denies driver manifest access for another driver trip', async () => {
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-2',
        driverAssignmentId: 'assignment-2',
      });
      prisma.transportDriverAssignment.findFirst.mockResolvedValue({
        id: 'assignment-2',
        staff: { userId: 'different-driver' },
      });

      await expect(
        service.getDriverTripManifest('trip-2', driverActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies driver from recording location for another driver trip', async () => {
      const tripId = 'trip-2';
      const assignmentId = 'assignment-2';

      prisma.transportTrip.findFirst.mockResolvedValue({
        id: tripId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: assignmentId,
        tenantId,
      });

      prisma.transportDriverAssignment.findFirst.mockResolvedValue({
        id: assignmentId,
        staff: { userId: 'different-driver' },
      });

      await expect(
        service.recordLocationPing(
          tripId,
          { latitude: 0, longitude: 0 },
          driverActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to record location for any trip (emergency override)', async () => {
      const tripId = 'trip-1';
      const assignmentId = 'assignment-1';

      prisma.transportTrip.findFirst.mockResolvedValue({
        id: tripId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: assignmentId,
        vehicleId: 'v-1',
      });

      prisma.transportLocationPing.findFirst.mockResolvedValue({
        recordedAt: new Date(),
      });

      await service.recordLocationPing(
        tripId,
        { latitude: 27.7172, longitude: 85.324 },
        adminActor,
      );

      expect(prisma.transportDriverAssignment.findFirst).not.toHaveBeenCalled();
      expect(prisma.transportLocationPing.create).not.toHaveBeenCalled();
      expect(redisClient.publish).toHaveBeenCalledWith(
        expect.stringContaining(':location-updates'),
        expect.any(String),
      );
    });

    it('rejects location ingestion pressure before cache or database writes', async () => {
      prisma.transportTrip.findFirst.mockResolvedValue({
        id: 'trip-1',
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: 'assignment-1',
        vehicleId: 'v-1',
      });
      prisma.transportDriverAssignment.findFirst.mockResolvedValue({
        id: 'assignment-1',
        staff: { userId: driverActor.userId },
      });
      redisClient.set.mockResolvedValueOnce(null);

      await expect(
        service.recordLocationPing(
          'trip-1',
          { latitude: 27.7172, longitude: 85.324 },
          driverActor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.transportLocationPing.create).not.toHaveBeenCalled();
      expect(redisClient.publish).not.toHaveBeenCalled();
    });
  });

  describe('Parent Visibility Boundary', () => {
    it('allows parent to view active trip of their own child', async () => {
      const studentId = 'student-1';

      prisma.studentGuardian.findFirst.mockResolvedValue({
        studentId,
        student: { id: studentId, firstNameEn: 'Child' },
      });

      prisma.transportTripStudentStatus.findFirst.mockResolvedValue({
        tripId: 'trip-1',
        trip: {
          id: 'trip-1',
          status: 'ACTIVE',
          route: { id: 'r-1', name: 'Route 1' },
          vehicle: { id: 'v-1', registrationNumber: 'BA1' },
          driverAssignment: { staff: { firstName: 'Driver' } },
        },
        stop: { name: 'Home' },
      });

      const result = await hardeningService.getParentStudentActiveTrip(
        studentId,
        parentActor,
      );
      expect(result.student.id).toBe(studentId);
      expect(result.trip).toBeDefined();
    });

    it('denies parent from viewing active trip of another child', async () => {
      const studentId = 'other-student';

      prisma.studentGuardian.findFirst.mockResolvedValue(null);

      await expect(
        hardeningService.getParentStudentActiveTrip(studentId, parentActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Billing Boundary', () => {
    it('keeps transport billing deferred until pricing rules are approved', () => {
      const readiness =
        hardeningService.getBillingIntegrationReadiness(adminActor);

      expect(readiness).toMatchObject({
        tenantId,
        approved: false,
        status: 'DEFERRED_PRICING_RULES_NOT_APPROVED',
      });
      expect(readiness.prohibitedEffects).toEqual(
        expect.arrayContaining(['invoice_create', 'journal_post']),
      );
    });
  });

  describe('Location Retention Boundary', () => {
    it('rejects unsafe cleanup retention windows', async () => {
      await expect(
        service.cleanupLocationHistory(adminActor, 0),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.transportLocationPing.deleteMany).not.toHaveBeenCalled();
    });
  });
});

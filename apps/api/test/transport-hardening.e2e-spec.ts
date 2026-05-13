import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { TransportController } from '../src/transport/transport.controller';
import { PrismaMock, createPrismaMock } from './test-helpers';
import {
  TransportTripStatus,
  TransportStudentTripStatus,
} from '@prisma/client';

describe('Transport Hardening (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let transportController: TransportController;
  let redis: any;

  const tenantId = 'tenant-1';
  const adminActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'admin-1',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: [
      'transport:manage',
      'transport:routes:read',
      'transport:trips:update',
      'transport:trips:read',
      'transport:location:update',
    ],
  };

  const driverActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'driver-1',
    email: 'driver@school.test',
    authMethod: 'PASSWORD',
    roles: ['staff', 'driver'],
    permissions: [
      'transport:operate',
      'transport:routes:read',
      'transport:trips:update',
      'transport:trips:read',
      'transport:location:update',
    ],
  };

  const parentActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'parent-1',
    email: 'parent@school.test',
    authMethod: 'PASSWORD',
    roles: ['guardian'],
    permissions: ['transport:tracking:parent'],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    redis = {
      getClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
        setex: jest.fn(),
        del: jest.fn(),
      }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue(redis)
      .compile();

    transportController = moduleRef.get(TransportController);
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Driver Boundaries', () => {
    it('filters routes for drivers to only show assigned ones', async () => {
      // Setup: 2 routes, driver-1 assigned to route-1
      const route1 = {
        id: 'route-1',
        tenantId,
        name: 'Route 1',
        isActive: true,
        driverAssignments: [{ endsAt: null, staff: { userId: 'driver-1' } }],
      };
      const route2 = {
        id: 'route-2',
        tenantId,
        name: 'Route 2',
        isActive: true,
        driverAssignments: [{ endsAt: null, staff: { userId: 'other' } }],
      };

      prisma.__state.transportRoutes = [route1, route2];
      prisma.__state.transportDriverAssignments = route1.driverAssignments.map(
        (a) => ({ ...a, id: 'assign-1', tenantId, routeId: 'route-1' }),
      );

      // Admin sees all
      const adminRoutes = await transportController.listRoutes(adminActor);
      expect(adminRoutes).toHaveLength(2);

      // Driver sees only route-1
      const driverRoutes = await transportController.listRoutes(driverActor);
      expect(driverRoutes).toHaveLength(1);
      expect(driverRoutes[0].id).toBe('route-1');
    });

    it('prevents driver from updating a trip they are not assigned to', async () => {
      const trip = {
        id: 'trip-1',
        tenantId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: 'assign-other',
      };
      prisma.__state.transportTrips = [trip];
      prisma.__state.transportDriverAssignments = [
        { id: 'assign-other', tenantId, staff: { userId: 'other-driver' } },
      ];

      await expect(
        transportController.markStudentBoarded(
          'trip-1',
          { studentId: 'stu-1' },
          driverActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Trip Lifecycle Integrity', () => {
    it('enforces boarding before dropping', async () => {
      const trip = {
        id: 'trip-1',
        tenantId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: 'assign-1',
      };
      const status = {
        id: 'status-1',
        tenantId,
        tripId: 'trip-1',
        studentId: 'stu-1',
        status: TransportStudentTripStatus.PENDING,
      };

      prisma.__state.transportTrips = [trip];
      prisma.__state.transportTripStudentStatuses = [status];
      prisma.__state.transportDriverAssignments = [
        { id: 'assign-1', tenantId, staff: { userId: 'driver-1' } },
      ];

      // Cannot drop if not boarded
      await expect(
        transportController.markStudentDropped(
          'trip-1',
          { studentId: 'stu-1' },
          driverActor,
        ),
      ).rejects.toThrow(ConflictException);

      // Board first
      await transportController.markStudentBoarded(
        'trip-1',
        { studentId: 'stu-1' },
        driverActor,
      );

      // Now can drop
      prisma.__state.transportTripStudentStatuses[0].status =
        TransportStudentTripStatus.BOARDED;
      await expect(
        transportController.markStudentDropped(
          'trip-1',
          { studentId: 'stu-1' },
          driverActor,
        ),
      ).resolves.toBeDefined();
    });

    it('prevents completion if students are still boarded without FORCE_COMPLETE', async () => {
      const trip = {
        id: 'trip-1',
        tenantId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: 'assign-1',
      };
      const status = {
        id: 'status-1',
        tenantId,
        tripId: 'trip-1',
        studentId: 'stu-1',
        status: TransportStudentTripStatus.BOARDED,
      };

      prisma.__state.transportTrips = [trip];
      prisma.__state.transportTripStudentStatuses = [status];
      prisma.__state.transportDriverAssignments = [
        { id: 'assign-1', tenantId, staff: { userId: 'driver-1' } },
      ];

      await expect(
        transportController.completeTrip('trip-1', {}, driverActor),
      ).rejects.toThrow(ConflictException);

      // Works with force complete note
      await expect(
        transportController.completeTrip(
          'trip-1',
          { notes: 'FORCE_COMPLETE' },
          driverActor,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('GPS Ingestion Validation', () => {
    it('rejects invalid coordinates', async () => {
      const trip = {
        id: 'trip-1',
        tenantId,
        status: TransportTripStatus.ACTIVE,
        driverAssignmentId: 'assign-1',
      };
      prisma.__state.transportTrips = [trip];
      prisma.__state.transportDriverAssignments = [
        { id: 'assign-1', tenantId, staff: { userId: 'driver-1' } },
      ];

      await expect(
        transportController.recordLocationPing(
          'trip-1',
          { latitude: 100, longitude: 50 },
          driverActor,
        ),
      ).rejects.toThrow(); // Latitude > 90
    });
  });

  describe('Parent Boundaries', () => {
    it('prevents parent from tracking a student they do not own', async () => {
      prisma.__state.studentGuardians = []; // No link

      await expect(
        transportController.getParentStudentActiveTrip('stu-1', parentActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows parent to track their own student', async () => {
      const student = {
        id: 'stu-1',
        tenantId,
        firstNameEn: 'Sita',
        lastNameEn: 'Student',
      };
      prisma.__state.students = [student];
      prisma.__state.studentGuardians = [
        {
          tenantId,
          studentId: 'stu-1',
          guardian: { userId: 'parent-1' },
          student,
        },
      ];

      // Also need a trip for it to return something interesting
      const route = { id: 'r-1', name: 'Route 1', code: 'R1' };
      const vehicle = {
        id: 'v-1',
        registrationNumber: 'BA 1 PA 1234',
        model: 'Bus',
      };
      const driverAssignment = {
        id: 'd-1',
        staff: {
          id: 'st-1',
          firstName: 'D',
          lastName: 'R',
          user: { phone: '123' },
        },
      };
      const trip = {
        id: 'trip-1',
        tenantId,
        status: TransportTripStatus.ACTIVE,
        direction: 'PICKUP',
        startedAt: new Date(),
        routeId: 'r-1',
        vehicleId: 'v-1',
        driverAssignmentId: 'd-1',
        route,
        vehicle,
        driverAssignment,
      };
      const stop = { id: 'stop-1', tenantId, name: 'Home', sequence: 1 };

      prisma.__state.transportTrips = [trip];
      prisma.__state.transportTripStudentStatuses = [
        {
          id: 'ts-1',
          tenantId,
          studentId: 'stu-1',
          tripId: 'trip-1',
          status: 'PENDING',
          stopId: 'stop-1',
          trip,
          stop,
        },
      ];
      prisma.__state.transportVehicles = [vehicle];
      prisma.__state.transportRoutes = [route];
      prisma.__state.transportDriverAssignments = [driverAssignment];

      const result = await transportController.getParentStudentActiveTrip(
        'stu-1',
        parentActor,
      );
      expect(result.student.id).toBe('stu-1');
      if (!result.trip) {
        throw new Error('Expected parent active trip result to include a trip');
      }
      expect(result.trip.id).toBe('trip-1');
    });
  });
});

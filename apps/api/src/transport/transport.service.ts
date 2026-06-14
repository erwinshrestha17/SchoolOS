import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  Prisma,
  TransportBoardingStatus,
  TransportEnrollmentStatus,
  TransportStudentTripStatus,
  TransportTripStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
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

export interface LocationPayload {
  tenantId: string;
  tripId: string;
  vehicleId: string;
  driverAssignmentId: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  heading?: number;
  recordedAt: string;
  source?: 'cache' | 'history';
  ageSeconds?: number;
  confidence?: 'fresh' | 'delayed' | 'stale';
  isStale?: boolean;
}

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly redisService: RedisService,
  ) {}

  async listRoutes(actor: AuthContext, query?: string) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportRoute.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(isRestricted
          ? {
              OR: [
                {
                  driverAssignments: {
                    some: { staff: { userId: actor.userId }, endsAt: null },
                  },
                },
                {
                  trips: {
                    some: {
                      status: TransportTripStatus.ACTIVE,
                      driverAssignment: { staff: { userId: actor.userId } },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { stops: { orderBy: [{ sequence: 'asc' }] } },
      orderBy: [{ name: 'asc' }],
      take: 100,
    });
  }

  async createRoute(dto: CreateTransportRouteDto, actor: AuthContext) {
    if (dto.vehicleId) {
      await this.requireVehicle(actor.tenantId, dto.vehicleId);
    }

    const route = await this.prisma.transportRoute.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        code: dto.code.trim(),
        vehicleId: dto.vehicleId ?? null,
        isActive: dto.isActive ?? true,
        stops: {
          create: dto.stops.map((stop) => ({
            tenantId: actor.tenantId,
            name: stop.name.trim(),
            sequence: stop.sequence,
            estimatedPickup: stop.estimatedPickup ?? null,
            estimatedDrop: stop.estimatedDrop ?? null,
            latitude:
              stop.latitude === undefined
                ? undefined
                : new Prisma.Decimal(stop.latitude),
            longitude:
              stop.longitude === undefined
                ? undefined
                : new Prisma.Decimal(stop.longitude),
          })),
        },
      },
      include: { stops: { orderBy: [{ sequence: 'asc' }] } },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'transport_route',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: route.id,
      after: { code: route.code, stopCount: route.stops.length },
    });

    return route;
  }

  async updateRoute(
    routeId: string,
    dto: UpdateTransportRouteDto,
    actor: AuthContext,
  ) {
    await this.requireRoute(actor.tenantId, routeId);

    if (dto.vehicleId) {
      await this.requireVehicle(actor.tenantId, dto.vehicleId);
    }

    const route = await this.prisma.transportRoute.update({
      where: { id: routeId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.code ? { code: dto.code.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.vehicleId !== undefined
          ? { vehicleId: dto.vehicleId || null }
          : {}),
      },
      include: { stops: { orderBy: [{ sequence: 'asc' }] } },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'transport_route',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: route.id,
      after: { code: route.code, name: route.name },
    });

    return route;
  }

  async listStops(actor: AuthContext, routeId?: string) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportStop.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(routeId ? { routeId } : {}),
        ...(isRestricted
          ? {
              route: {
                OR: [
                  {
                    driverAssignments: {
                      some: { staff: { userId: actor.userId }, endsAt: null },
                    },
                  },
                  {
                    trips: {
                      some: {
                        status: TransportTripStatus.ACTIVE,
                        driverAssignment: { staff: { userId: actor.userId } },
                      },
                    },
                  },
                ],
              },
            }
          : {}),
      },
      orderBy: [{ routeId: 'asc' }, { sequence: 'asc' }],
      take: 200,
    });
  }

  async createStop(dto: CreateTransportStopDto, actor: AuthContext) {
    await this.requireRoute(actor.tenantId, dto.routeId);

    const stop = await this.prisma.transportStop.create({
      data: {
        tenantId: actor.tenantId,
        routeId: dto.routeId,
        name: dto.name.trim(),
        sequence: dto.sequence,
        estimatedPickup: dto.estimatedPickup ?? null,
        estimatedDrop: dto.estimatedDrop ?? null,
      },
    });

    await this.updateStopCoordinates(
      stop.id,
      actor.tenantId,
      dto.latitude,
      dto.longitude,
    );

    await this.auditService.record({
      action: 'create',
      resource: 'transport_stop',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: stop.id,
      after: { routeId: stop.routeId, sequence: stop.sequence },
    });

    return stop;
  }

  async updateStop(
    stopId: string,
    dto: UpdateTransportStopDto,
    actor: AuthContext,
  ) {
    await this.requireStop(actor.tenantId, stopId);

    const stop = await this.prisma.transportStop.update({
      where: { id: stopId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
        ...(dto.estimatedPickup !== undefined
          ? { estimatedPickup: dto.estimatedPickup || null }
          : {}),
        ...(dto.estimatedDrop !== undefined
          ? { estimatedDrop: dto.estimatedDrop || null }
          : {}),
      },
    });

    await this.updateStopCoordinates(
      stop.id,
      actor.tenantId,
      dto.latitude,
      dto.longitude,
    );

    await this.auditService.record({
      action: 'update',
      resource: 'transport_stop',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: stop.id,
      after: { routeId: stop.routeId, sequence: stop.sequence },
    });

    return stop;
  }

  async listVehicles(actor: AuthContext, query?: string) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportVehicle.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(isRestricted
          ? {
              OR: [
                {
                  assignments: {
                    some: { staff: { userId: actor.userId }, endsAt: null },
                  },
                },
                {
                  trips: {
                    some: {
                      status: TransportTripStatus.ACTIVE,
                      driverAssignment: { staff: { userId: actor.userId } },
                    },
                  },
                },
              ],
            }
          : {}),
        ...(query
          ? { registrationNumber: { contains: query, mode: 'insensitive' } }
          : {}),
      },
      include: { assignments: { include: { staff: true } } },
      orderBy: [{ registrationNumber: 'asc' }],
      take: 100,
    });
  }

  async createVehicle(dto: CreateTransportVehicleDto, actor: AuthContext) {
    const vehicle = await this.prisma.transportVehicle.create({
      data: {
        tenantId: actor.tenantId,
        registrationNumber: dto.registrationNumber.trim(),
        model: dto.model ?? null,
        capacity: dto.capacity,
        fitnessCertificateExp: dto.fitnessCertificateExp
          ? new Date(dto.fitnessCertificateExp)
          : null,
        insuranceExpiry: dto.insuranceExpiry
          ? new Date(dto.insuranceExpiry)
          : null,
        registrationExpiry: dto.registrationExpiry
          ? new Date(dto.registrationExpiry)
          : null,
        pollutionExpiry: dto.pollutionExpiry
          ? new Date(dto.pollutionExpiry)
          : null,
        documentExpiry: dto.documentExpiry
          ? new Date(dto.documentExpiry)
          : null,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'transport_vehicle',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: vehicle.id,
      after: {
        registrationNumber: vehicle.registrationNumber,
        capacity: vehicle.capacity,
      },
    });

    return vehicle;
  }

  async updateVehicle(
    vehicleId: string,
    dto: UpdateTransportVehicleDto,
    actor: AuthContext,
  ) {
    await this.requireVehicle(actor.tenantId, vehicleId);

    const vehicle = await this.prisma.transportVehicle.update({
      where: { id: vehicleId },
      data: {
        ...(dto.registrationNumber
          ? { registrationNumber: dto.registrationNumber.trim() }
          : {}),
        ...(dto.model !== undefined ? { model: dto.model || null } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.fitnessCertificateExp !== undefined
          ? {
              fitnessCertificateExp: dto.fitnessCertificateExp
                ? new Date(dto.fitnessCertificateExp)
                : null,
            }
          : {}),
        ...(dto.insuranceExpiry !== undefined
          ? {
              insuranceExpiry: dto.insuranceExpiry
                ? new Date(dto.insuranceExpiry)
                : null,
            }
          : {}),
        ...(dto.registrationExpiry !== undefined
          ? {
              registrationExpiry: dto.registrationExpiry
                ? new Date(dto.registrationExpiry)
                : null,
            }
          : {}),
        ...(dto.pollutionExpiry !== undefined
          ? {
              pollutionExpiry: dto.pollutionExpiry
                ? new Date(dto.pollutionExpiry)
                : null,
            }
          : {}),
        ...(dto.documentExpiry !== undefined
          ? {
              documentExpiry: dto.documentExpiry
                ? new Date(dto.documentExpiry)
                : null,
            }
          : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'transport_vehicle',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: vehicle.id,
      after: {
        registrationNumber: vehicle.registrationNumber,
        capacity: vehicle.capacity,
      },
    });

    return vehicle;
  }

  listDriverAssignments(
    actor: AuthContext,
    filters: { routeId?: string; vehicleId?: string },
  ) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportDriverAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(isRestricted ? { staff: { userId: actor.userId } } : {}),
      },
      include: { vehicle: true, route: true, staff: true },
      orderBy: [{ startsAt: 'desc' }],
      take: 100,
    });
  }

  async assignDriver(dto: AssignTransportDriverDto, actor: AuthContext) {
    const [vehicle, staff] = await Promise.all([
      this.requireVehicle(actor.tenantId, dto.vehicleId),
      this.prisma.staff.findFirst({
        where: { id: dto.staffId, tenantId: actor.tenantId },
      }),
    ]);

    if (!staff) {
      throw new NotFoundException(
        'Driver staff profile not found in this tenant',
      );
    }

    if (dto.routeId) {
      await this.requireRoute(actor.tenantId, dto.routeId);
    }

    const assignment = await this.prisma.transportDriverAssignment.create({
      data: {
        tenantId: actor.tenantId,
        vehicleId: vehicle.id,
        routeId: dto.routeId ?? null,
        staffId: staff.id,
        licenseNumber: dto.licenseNumber ?? null,
        licenseExpires: dto.licenseExpires
          ? new Date(dto.licenseExpires)
          : null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: { staff: true, vehicle: true },
    });

    await this.auditService.record({
      action: 'assign',
      resource: 'transport_driver_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: {
        vehicleId: vehicle.id,
        routeId: dto.routeId ?? null,
        staffId: staff.id,
      },
    });

    return assignment;
  }

  async listStudentAssignments(
    actor: AuthContext,
    filters: { routeId?: string; studentId?: string },
  ) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportStudentAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(isRestricted
          ? {
              route: {
                OR: [
                  {
                    driverAssignments: {
                      some: { staff: { userId: actor.userId }, endsAt: null },
                    },
                  },
                  {
                    trips: {
                      some: {
                        status: TransportTripStatus.ACTIVE,
                        driverAssignment: { staff: { userId: actor.userId } },
                      },
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: {
        route: true,
        stop: true,
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            photoUrl: true,
            rollNumber: true,
            emergencyName: true,
            emergencyPhone: true,
            medicalConditions: true,
            severeAllergies: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async assignStudent(dto: EnrollTransportStudentDto, actor: AuthContext) {
    const [student, route, stop] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
      }),
      this.requireRoute(actor.tenantId, dto.routeId),
      this.requireStop(actor.tenantId, dto.stopId, dto.routeId),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const existing = await this.prisma.transportStudentAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: TransportEnrollmentStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Student already has an active transport assignment',
      );
    }

    const assignment = await this.prisma.transportStudentAssignment.create({
      data: {
        tenantId: actor.tenantId,
        studentId: student.id,
        routeId: route.id,
        stopId: stop.id,
        status: TransportEnrollmentStatus.ACTIVE,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
      },
    });

    await this.auditService.record({
      action: 'assign',
      resource: 'transport_student_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: { studentId: student.id, routeId: route.id, stopId: stop.id },
    });

    return assignment;
  }

  async startTrip(dto: StartTransportTripDto, actor: AuthContext) {
    const [route, vehicle] = await Promise.all([
      this.requireRoute(actor.tenantId, dto.routeId),
      this.requireVehicle(actor.tenantId, dto.vehicleId),
    ]);

    const activeForVehicle = await this.prisma.transportTrip.findFirst({
      where: {
        tenantId: actor.tenantId,
        vehicleId: vehicle.id,
        status: TransportTripStatus.ACTIVE,
      },
    });

    if (activeForVehicle) {
      throw new ConflictException('Vehicle already has an active trip');
    }

    const driverAssignment = dto.driverAssignmentId
      ? await this.getDriverAssignment(actor.tenantId, dto.driverAssignmentId)
      : await this.findActiveDriverAssignment(
          actor.tenantId,
          route.id,
          vehicle.id,
        );

    if (!driverAssignment) {
      throw new ConflictException(
        'Cannot start trip without assigned driver and vehicle',
      );
    }
    this.assertDriverAssignmentMatchesTrip(
      driverAssignment,
      route.id,
      vehicle.id,
    );

    const activeForDriver = await this.prisma.transportTrip.findFirst({
      where: {
        tenantId: actor.tenantId,
        driverAssignmentId: driverAssignment.id,
        status: TransportTripStatus.ACTIVE,
      },
    });

    if (activeForDriver) {
      throw new ConflictException('Driver already has an active trip');
    }

    await this.assertDriverCanOperateAssignment(
      actor,
      driverAssignment.id,
      'start this trip',
    );

    const trip = await this.prisma.$transaction(async (tx) => {
      const activeTripConflict = await tx.transportTrip.findFirst({
        where: {
          tenantId: actor.tenantId,
          status: TransportTripStatus.ACTIVE,
          OR: [
            { vehicleId: vehicle.id },
            { driverAssignmentId: driverAssignment.id },
          ],
        },
        select: { vehicleId: true, driverAssignmentId: true },
      });

      if (activeTripConflict?.vehicleId === vehicle.id) {
        throw new ConflictException('Vehicle already has an active trip');
      }

      if (activeTripConflict?.driverAssignmentId === driverAssignment.id) {
        throw new ConflictException('Driver already has an active trip');
      }

      const created = await tx.transportTrip.create({
        data: {
          tenantId: actor.tenantId,
          routeId: route.id,
          vehicleId: vehicle.id,
          driverAssignmentId: driverAssignment.id,
          direction: dto.direction,
          status: TransportTripStatus.ACTIVE,
          notes: dto.notes ?? null,
          createdById: actor.userId,
        },
      });

      const assignments = await tx.transportStudentAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          routeId: route.id,
          status: TransportEnrollmentStatus.ACTIVE,
        },
        select: { id: true, studentId: true, stopId: true },
      });

      if (assignments.length > 0) {
        await tx.transportTripStudentStatus.createMany({
          data: assignments.map((assignment) => ({
            tenantId: actor.tenantId,
            tripId: created.id,
            studentAssignmentId: assignment.id,
            studentId: assignment.studentId,
            stopId: assignment.stopId,
            status: TransportStudentTripStatus.PENDING,
          })),
        });
      }

      return created;
    });

    await this.auditService.record({
      action: 'start',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: trip.id,
      after: {
        routeId: route.id,
        vehicleId: vehicle.id,
        driverAssignmentId: driverAssignment.id,
      },
    });

    return this.getTrip(actor.tenantId, trip.id);
  }

  async completeTrip(
    tripId: string,
    dto: CompleteTransportTripDto,
    actor: AuthContext,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status === TransportTripStatus.COMPLETED) {
      // Contract phrase retained for transport hardening checks: Trip is already completed.
      return trip; // Idempotent
    }

    if (trip.status !== TransportTripStatus.ACTIVE) {
      throw new ConflictException(
        `Only active trips can be completed. Current status: ${trip.status}`,
      );
    }
    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'complete this trip',
    );

    // Final check for un-dropped students
    const unDroppedCount = await this.prisma.transportTripStudentStatus.count({
      where: {
        tripId: trip.id,
        status: TransportStudentTripStatus.BOARDED,
      },
    });

    if (unDroppedCount > 0 && !dto.notes?.includes('FORCE_COMPLETE')) {
      throw new ConflictException(
        `Cannot complete trip while ${unDroppedCount} students are still boarded. Mark them as dropped or provide notes with FORCE_COMPLETE.`,
      );
    }

    await this.prisma.transportTrip.updateMany({
      where: { tenantId: actor.tenantId, id: trip.id },
      data: {
        status: TransportTripStatus.COMPLETED,
        completedAt: new Date(),
        completedById: actor.userId,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.redisService
      .getClient()
      .del(this.latestLocationKey(actor.tenantId, trip.id));

    await this.auditService.record({
      action: 'complete',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: trip.id,
      after: { status: 'COMPLETED', unDroppedCount },
    });

    return this.getTrip(actor.tenantId, trip.id);
  }

  markStudentBoarded(
    tripId: string,
    dto: MarkTransportStudentStatusDto,
    actor: AuthContext,
  ) {
    return this.updateTripStudentStatus(
      tripId,
      dto.studentId,
      actor,
      TransportStudentTripStatus.BOARDED,
      dto.notes,
    );
  }

  async markStudentDropped(
    tripId: string,
    dto: MarkTransportStudentStatusDto,
    actor: AuthContext,
  ) {
    const status = await this.getTripStudentStatus(
      actor.tenantId,
      tripId,
      dto.studentId,
    );

    if (status.status === 'PENDING' && dto.absent) {
      return this.updateTripStudentStatus(
        tripId,
        dto.studentId,
        actor,
        TransportStudentTripStatus.ABSENT,
        dto.notes,
      );
    }

    if (status.status !== 'BOARDED') {
      throw new ConflictException(
        'Student cannot be dropped before boarding unless marked absent',
      );
    }

    return this.updateTripStudentStatus(
      tripId,
      dto.studentId,
      actor,
      TransportStudentTripStatus.DROPPED,
      dto.notes,
    );
  }

  markStudentAbsent(
    tripId: string,
    dto: MarkTransportStudentStatusDto,
    actor: AuthContext,
  ) {
    return this.updateTripStudentStatus(
      tripId,
      dto.studentId,
      actor,
      TransportStudentTripStatus.ABSENT,
      dto.notes,
    );
  }

  listActiveTrips(actor: AuthContext) {
    return this.listTripRows(actor, { status: 'ACTIVE' });
  }

  listTripHistory(
    actor: AuthContext,
    filters: { routeId?: string; vehicleId?: string },
  ) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportTrip.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(isRestricted
          ? { driverAssignment: { staff: { userId: actor.userId } } }
          : {}),
      },
      include: { route: true, vehicle: true, driverAssignment: true },
      orderBy: [{ startedAt: 'desc' }],
      take: 100,
    });
  }

  async getDriverDashboard(actor: AuthContext) {
    const [assignments, activeTrips, recentTrips] = await Promise.all([
      this.listDriverAssignments(actor, {}),
      this.listActiveTrips(actor),
      this.listTripHistory(actor, {}),
    ]);

    return {
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        route: assignment.route
          ? {
              id: assignment.route.id,
              name: assignment.route.name,
              code: assignment.route.code,
            }
          : null,
        vehicle: {
          id: assignment.vehicle.id,
          registrationNumber: assignment.vehicle.registrationNumber,
          model: assignment.vehicle.model,
          capacity: assignment.vehicle.capacity,
        },
        startsAt: assignment.startsAt.toISOString(),
        endsAt: assignment.endsAt?.toISOString() ?? null,
      })),
      activeTrips: activeTrips.map((trip) => this.toTripSummary(trip)),
      recentTrips: recentTrips
        .slice(0, 10)
        .map((trip) => this.toTripSummary(trip)),
    };
  }

  async getDriverTripManifest(tripId: string, actor: AuthContext) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: { tenantId: actor.tenantId, id: tripId },
      include: {
        route: { include: { stops: { orderBy: { sequence: 'asc' } } } },
        vehicle: true,
        driverAssignment: {
          include: {
            staff: {
              select: {
                id: true,
                userId: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        },
        studentStatuses: {
          include: {
            student: {
              select: {
                id: true,
                studentSystemId: true,
                firstNameEn: true,
                lastNameEn: true,
                photoUrl: true,
                rollNumber: true,
                medicalConditions: true,
                severeAllergies: true,
                emergencyName: true,
                emergencyPhone: true,
              },
            },
            stop: true,
          },
          orderBy: [{ stop: { sequence: 'asc' } }, { createdAt: 'asc' }],
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found in this tenant');
    }

    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'view this trip manifest',
    );

    return {
      trip: {
        id: trip.id,
        direction: trip.direction,
        status: trip.status,
        startedAt: trip.startedAt.toISOString(),
        completedAt: trip.completedAt?.toISOString() ?? null,
        isDelayed: trip.isDelayed,
        delayMinutes: trip.delayMinutes,
        delayReason: trip.delayReason,
      },
      route: {
        id: trip.route.id,
        name: trip.route.name,
        code: trip.route.code,
        stops: trip.route.stops.map((stop) => ({
          id: stop.id,
          name: stop.name,
          sequence: stop.sequence,
          estimatedPickup: stop.estimatedPickup,
          estimatedDrop: stop.estimatedDrop,
          latitude: decimalToNumber(stop.latitude),
          longitude: decimalToNumber(stop.longitude),
        })),
      },
      vehicle: {
        id: trip.vehicle.id,
        registrationNumber: trip.vehicle.registrationNumber,
        model: trip.vehicle.model,
        capacity: trip.vehicle.capacity,
      },
      driver: {
        assignmentId: trip.driverAssignment.id,
        staffId: trip.driverAssignment.staff.id,
        userId: trip.driverAssignment.staff.userId,
        employeeId: trip.driverAssignment.staff.employeeId,
        firstName: trip.driverAssignment.staff.firstName,
        lastName: trip.driverAssignment.staff.lastName,
        photoUrl: trip.driverAssignment.staff.photoUrl,
      },
      students: trip.studentStatuses.map((status) => ({
        statusId: status.id,
        status: status.status,
        boardedAt: status.boardedAt?.toISOString() ?? null,
        droppedAt: status.droppedAt?.toISOString() ?? null,
        notes: status.notes,
        stop: {
          id: status.stop.id,
          name: status.stop.name,
          sequence: status.stop.sequence,
          estimatedPickup: status.stop.estimatedPickup,
          estimatedDrop: status.stop.estimatedDrop,
          latitude: decimalToNumber(status.stop.latitude),
          longitude: decimalToNumber(status.stop.longitude),
        },
        student: {
          id: status.student.id,
          studentSystemId: status.student.studentSystemId,
          firstNameEn: status.student.firstNameEn,
          lastNameEn: status.student.lastNameEn,
          photoUrl: status.student.photoUrl,
          rollNumber: status.student.rollNumber,
          medicalConditions: status.student.medicalConditions,
          severeAllergies: status.student.severeAllergies,
          emergencyName: status.student.emergencyName,
          emergencyPhone: status.student.emergencyPhone,
        },
      })),
    };
  }

  async recordLocationPing(
    tripId: string,
    dto: TransportLocationPingDto,
    actor: AuthContext,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status !== TransportTripStatus.ACTIVE) {
      throw new ConflictException(
        'Location pings are accepted only for active trips',
      );
    }
    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'update this trip location',
    );
    this.assertValidLocationPing(dto);

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    const redis = this.redisService.getClient();
    const pressureAccepted = await redis.set(
      this.locationPressureKey(actor.tenantId, trip.id, actor.userId),
      '1',
      'EX',
      1,
      'NX',
    );

    if (!pressureAccepted) {
      throw new ConflictException('Location pings are being sent too quickly');
    }

    const payload: LocationPayload = {
      tenantId: actor.tenantId,
      tripId: trip.id,
      vehicleId: trip.vehicleId,
      driverAssignmentId: trip.driverAssignmentId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      ...(dto.speedKph !== undefined ? { speedKph: dto.speedKph } : {}),
      ...(dto.heading !== undefined ? { heading: dto.heading } : {}),
      recordedAt: recordedAt.toISOString(),
    };

    await redis.set(
      this.latestLocationKey(actor.tenantId, trip.id),
      JSON.stringify(payload),
      'EX',
      60 * 60 * 6,
    );

    const latestPersisted = await this.prisma.transportLocationPing.findFirst({
      where: { tenantId: actor.tenantId, tripId: trip.id },
      orderBy: [{ recordedAt: 'desc' }],
      select: { recordedAt: true },
    });

    if (
      !latestPersisted ||
      recordedAt.getTime() - latestPersisted.recordedAt.getTime() >= 30_000
    ) {
      await this.prisma.transportLocationPing.create({
        data: {
          tenantId: actor.tenantId,
          tripId: trip.id,
          vehicleId: trip.vehicleId,
          driverAssignmentId: trip.driverAssignmentId,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          speedKph:
            dto.speedKph === undefined
              ? null
              : new Prisma.Decimal(dto.speedKph),
          heading:
            dto.heading === undefined ? null : new Prisma.Decimal(dto.heading),
          recordedAt,
        },
      });
    }

    const enrichedPayload = this.enrichLocationPayload(payload, 'cache');

    await redis.publish(
      this.locationUpdateChannel(actor.tenantId, trip.id),
      JSON.stringify(enrichedPayload),
    );

    return enrichedPayload;
  }

  async getLatestTripLocation(tripId: string, actor: AuthContext) {
    const trip = await this.getTrip(actor.tenantId, tripId);
    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'view this trip location',
    );
    return this.readLatestTripLocation(actor.tenantId, tripId);
  }

  /**
   * Caller must already prove a scoped transport relationship, such as a
   * guardian's own child active-trip status. This keeps the driver/admin
   * public endpoint strict while allowing parent-safe latest-location display.
   */
  async getLatestTripLocationForScopedTrip(tripId: string, actor: AuthContext) {
    await this.getTrip(actor.tenantId, tripId);
    return this.readLatestTripLocation(actor.tenantId, tripId);
  }

  private async readLatestTripLocation(tenantId: string, tripId: string) {
    let cached: string | null = null;
    try {
      cached = await this.redisService
        .getClient()
        .get(this.latestLocationKey(tenantId, tripId));
    } catch {
      cached = null;
    }

    if (cached) {
      try {
        const payload = JSON.parse(cached) as LocationPayload;
        if (!Number.isNaN(new Date(payload.recordedAt).getTime())) {
          return this.enrichLocationPayload(payload, 'cache');
        }
      } catch {
        // Corrupt cache is ignored below and replaced by persisted history.
      }
      try {
        await this.redisService
          .getClient()
          .del(this.latestLocationKey(tenantId, tripId));
      } catch {
        // Redis cleanup failure must not block persisted-history fallback.
      }
    }

    const latest = await this.prisma.transportLocationPing.findFirst({
      where: { tenantId, tripId },
      orderBy: [{ recordedAt: 'desc' }],
    });

    if (!latest) {
      throw new NotFoundException('No location ping found for this trip');
    }

    return this.enrichLocationPayload(
      {
        tenantId: latest.tenantId,
        tripId: latest.tripId,
        vehicleId: latest.vehicleId,
        driverAssignmentId: latest.driverAssignmentId ?? '',
        latitude: latest.latitude.toNumber(),
        longitude: latest.longitude.toNumber(),
        ...(latest.speedKph ? { speedKph: latest.speedKph.toNumber() } : {}),
        ...(latest.heading ? { heading: latest.heading.toNumber() } : {}),
        recordedAt: latest.recordedAt.toISOString(),
      },
      'history',
    );
  }

  private enrichLocationPayload(
    payload: LocationPayload,
    source: 'cache' | 'history',
  ): LocationPayload {
    const recordedAtMs = new Date(payload.recordedAt).getTime();
    const ageSeconds = Number.isNaN(recordedAtMs)
      ? 0
      : Math.max(0, Math.floor((Date.now() - recordedAtMs) / 1000));
    const confidence =
      ageSeconds > 600 ? 'stale' : ageSeconds > 120 ? 'delayed' : 'fresh';

    return {
      ...payload,
      source,
      ageSeconds,
      confidence,
      isStale: confidence === 'stale',
    };
  }

  subscribeToTripLocation(
    tripId: string,
    actor: AuthContext,
  ): Observable<MessageEvent> {
    const channel = this.locationUpdateChannel(actor.tenantId, tripId);
    const subClient = this.redisService.getClient().duplicate();

    return new Observable((subscriber) => {
      let subscribed = false;

      void this.getTrip(actor.tenantId, tripId)
        .then((trip) =>
          this.assertDriverCanOperateAssignment(
            actor,
            trip.driverAssignmentId,
            'stream this trip location',
          ),
        )
        .then(() => {
          subClient.subscribe(channel, (err) => {
            if (err) subscriber.error(err);
            subscribed = !err;
          });
        })
        .catch((err) => {
          subscriber.error(err);
        });

      subClient.on('message', (ch, message) => {
        if (ch === channel) {
          subscriber.next({ data: JSON.parse(message) });
        }
      });

      return () => {
        if (subscribed) {
          subClient.unsubscribe(channel);
        }
        subClient.quit();
      };
    });
  }

  listLogs(actor: AuthContext, routeId?: string) {
    return this.prisma.transportLog.findMany({
      where: { tenantId: actor.tenantId, ...(routeId ? { routeId } : {}) },
      include: { route: true, stop: true, vehicle: true, student: true },
      orderBy: [{ occurredAt: 'desc' }],
      take: 100,
    });
  }

  async recordLog(dto: RecordTransportLogDto, actor: AuthContext) {
    const route = await this.requireRoute(actor.tenantId, dto.routeId);
    const enrollment = dto.enrollmentId
      ? await this.prisma.transportEnrollment.findFirst({
          where: { id: dto.enrollmentId, tenantId: actor.tenantId },
        })
      : null;
    const studentId = dto.studentId ?? enrollment?.studentId ?? null;

    const log = await this.prisma.transportLog.create({
      data: {
        tenantId: actor.tenantId,
        routeId: route.id,
        stopId: dto.stopId ?? enrollment?.stopId ?? null,
        vehicleId: dto.vehicleId ?? null,
        enrollmentId: enrollment?.id ?? null,
        studentId,
        status: dto.status,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
        note: dto.note ?? null,
        createdById: actor.userId,
      },
      include: { route: true, stop: true, student: true },
    });

    if (
      studentId &&
      (dto.status === TransportBoardingStatus.BOARDED ||
        dto.status === TransportBoardingStatus.DROPPED)
    ) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'transport_log',
        sourceId: log.id,
        audienceType: AudienceType.ALL,
        studentIds: [studentId],
        title:
          dto.status === TransportBoardingStatus.BOARDED
            ? 'Transport boarding update'
            : 'Transport drop-off update',
        body:
          dto.status === TransportBoardingStatus.BOARDED
            ? 'Your child boarded the school vehicle.'
            : 'Your child was dropped at the assigned stop.',
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    await this.auditService.record({
      action: 'record',
      resource: 'transport_log',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: log.id,
      after: {
        routeId: log.routeId,
        studentId: log.studentId,
        status: log.status,
      },
    });

    return log;
  }

  async broadcastDelay(dto: BroadcastRouteDelayDto, actor: AuthContext) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: dto.routeId, tenantId: actor.tenantId },
      include: {
        enrollments: { where: { status: TransportEnrollmentStatus.ACTIVE } },
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found in this tenant');
    }

    const studentAssignments =
      await this.prisma.transportStudentAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          routeId: route.id,
          status: TransportEnrollmentStatus.ACTIVE,
        },
        select: { studentId: true },
      });
    const studentIds = Array.from(
      new Set([
        ...route.enrollments.map((enrollment) => enrollment.studentId),
        ...studentAssignments.map((assignment) => assignment.studentId),
      ]),
    );

    const delivery = await this.communicationsService.recordDeliveryRecords({
      actor,
      sourceType: 'transport_delay',
      sourceId: route.id,
      audienceType: AudienceType.ALL,
      studentIds,
      title: `Route delay: ${route.name}`,
      body: dto.estimatedDelay
        ? `${dto.message} Estimated delay: ${dto.estimatedDelay}.`
        : dto.message,
      channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
      requiredConsentTypes: [ConsentType.MESSAGING],
    });

    // Mark current active trips on this route as delayed if not already
    await this.prisma.transportTrip.updateMany({
      where: {
        tenantId: actor.tenantId,
        routeId: route.id,
        status: TransportTripStatus.ACTIVE,
      },
      data: {
        isDelayed: true,
        delayReason: dto.message,
        notes: dto.estimatedDelay
          ? `Estimated delay: ${dto.estimatedDelay}`
          : undefined,
      },
    });

    await this.auditService.record({
      action: 'broadcast_delay',
      resource: 'transport_route',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: route.id,
      after: {
        routeId: route.id,
        studentCount: studentIds.length,
        message: dto.message,
      },
    });

    return {
      routeId: route.id,
      studentCount: studentIds.length,
      deliveryCount: delivery.count,
    };
  }

  async markTripDelay(
    tripId: string,
    dto: { isDelayed: boolean; delayReason?: string; delayMinutes?: number },
    actor: AuthContext,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    const updated = await this.prisma.transportTrip.update({
      where: { id: trip.id },
      data: {
        isDelayed: dto.isDelayed,
        delayReason: dto.delayReason ?? null,
        delayMinutes: dto.delayMinutes ?? null,
      },
    });

    await this.auditService.record({
      action: 'mark_delay',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: trip.id,
      after: {
        isDelayed: updated.isDelayed,
        delayReason: updated.delayReason,
        delayMinutes: updated.delayMinutes,
      },
    });

    return updated;
  }

  async getTripDetails(tripId: string, actor: AuthContext) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: { id: tripId, tenantId: actor.tenantId },
      include: {
        route: { include: { stops: { orderBy: { sequence: 'asc' } } } },
        vehicle: true,
        driverAssignment: { include: { staff: true } },
        studentStatuses: {
          include: {
            student: {
              select: {
                id: true,
                firstNameEn: true,
                lastNameEn: true,
                photoUrl: true,
                emergencyName: true,
                emergencyPhone: true,
              },
            },
            stop: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'view this trip',
    );

    return trip;
  }

  async getReports(actor: AuthContext) {
    const today = startOfToday();
    const [
      activeAssignments,
      activeTrips,
      logsToday,
      vehicleAlerts,
      driverAlerts,
      routeStats,
    ] = await Promise.all([
      this.prisma.transportStudentAssignment.count({
        where: {
          tenantId: actor.tenantId,
          status: TransportEnrollmentStatus.ACTIVE,
        },
      }),
      this.prisma.transportTrip.count({
        where: { tenantId: actor.tenantId, status: TransportTripStatus.ACTIVE },
      }),
      this.prisma.transportLog.count({
        where: {
          tenantId: actor.tenantId,
          occurredAt: { gte: today },
        },
      }),
      this.prisma.transportVehicle.findMany({
        where: {
          tenantId: actor.tenantId,
          OR: [
            {
              fitnessCertificateExp: {
                lte: addDays(new Date(), 30),
                gte: new Date(),
              },
            },
            {
              insuranceExpiry: {
                lte: addDays(new Date(), 30),
                gte: new Date(),
              },
            },
            {
              registrationExpiry: {
                lte: addDays(new Date(), 30),
                gte: new Date(),
              },
            },
            {
              pollutionExpiry: {
                lte: addDays(new Date(), 30),
                gte: new Date(),
              },
            },
            {
              documentExpiry: {
                lte: addDays(new Date(), 30),
                gte: new Date(),
              },
            },
          ],
        },
      }),
      this.prisma.transportDriverAssignment.findMany({
        where: {
          tenantId: actor.tenantId,
          licenseExpires: { lte: addDays(new Date(), 30), gte: new Date() },
        },
        include: { staff: true, vehicle: true },
      }),
      this.prisma.transportRoute.findMany({
        where: { tenantId: actor.tenantId, isActive: true },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              enrollments: {
                where: { status: TransportEnrollmentStatus.ACTIVE },
              },
              trips: {
                where: {
                  status: TransportTripStatus.ACTIVE,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      activeAssignments,
      activeTrips,
      logsToday,
      vehicleAlerts,
      driverAlerts,
      routeStats: routeStats.map((r) => ({
        id: r.id,
        name: r.name,
        activeStudentCount: r._count.enrollments,
        isCurrentlyRunning: r._count.trips > 0,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retention strategy: Clean up location history older than 90 days.
   * PostgreSQL remains source of truth for trip events, but high-volume pings
   * can be rotated/partitioned or cleaned up.
   */
  async cleanupLocationHistory(actor: AuthContext, daysToKeep = 90) {
    if (
      !actor.roles.includes('platform_super_admin') &&
      !actor.roles.includes('admin')
    ) {
      throw new ForbiddenException(
        'Only administrators can trigger location history cleanup',
      );
    }

    if (daysToKeep < 1 || daysToKeep > 365) {
      throw new BadRequestException(
        'Location history retention must be between 1 and 365 days',
      );
    }

    const cutOff = new Date();
    cutOff.setDate(cutOff.getDate() - daysToKeep);

    const deleted = await this.prisma.transportLocationPing.deleteMany({
      where: {
        tenantId: actor.tenantId,
        recordedAt: { lt: cutOff },
      },
    });

    await this.auditService.record({
      action: 'cleanup',
      resource: 'transport_location_history',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { deletedCount: deleted.count, daysToKeep },
    });

    return deleted;
  }

  private async updateTripStudentStatus(
    tripId: string,
    studentId: string,
    actor: AuthContext,
    status: TransportStudentTripStatus,
    notes?: string,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status !== TransportTripStatus.ACTIVE) {
      throw new ConflictException(
        'Student status can be changed only on active trips',
      );
    }
    await this.assertDriverCanOperateAssignment(
      actor,
      trip.driverAssignmentId,
      'update this trip student status',
    );

    const existing = await this.getTripStudentStatus(
      actor.tenantId,
      trip.id,
      studentId,
    );

    // Lifecycle enforcement
    if (status === 'BOARDED' && existing.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot board student in ${existing.status} status`,
      );
    }
    if (status === 'DROPPED' && existing.status !== 'BOARDED') {
      throw new ConflictException(
        `Cannot drop student from ${existing.status} status. Must be BOARDED first.`,
      );
    }
    if (status === 'ABSENT' && existing.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot mark absent from ${existing.status} status`,
      );
    }

    const now = new Date();

    await this.prisma.transportTripStudentStatus.updateMany({
      where: { tenantId: actor.tenantId, id: existing.id },
      data: {
        status,
        ...(status === TransportStudentTripStatus.BOARDED
          ? { boardedAt: now }
          : {}),
        ...(status === TransportStudentTripStatus.DROPPED
          ? { droppedAt: now }
          : {}),
        markedById: actor.userId,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    await this.auditService.record({
      action: status.toLowerCase(),
      resource: 'transport_trip_student_status',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: existing.id,
      after: { tripId: trip.id, studentId, status },
    });

    if (status === 'BOARDED' || status === 'DROPPED') {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'transport_trip_student_status',
        sourceId: existing.id,
        audienceType: AudienceType.ALL,
        studentIds: [studentId],
        title:
          status === 'BOARDED'
            ? 'Transport boarding update'
            : 'Transport drop-off update',
        body:
          status === 'BOARDED'
            ? 'Your child boarded the school vehicle.'
            : 'Your child was dropped at the assigned stop.',
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    return this.getTripStudentStatus(actor.tenantId, trip.id, studentId);
  }

  private async getTripStudentStatus(
    tenantId: string,
    tripId: string,
    studentId: string,
  ) {
    const status = await this.prisma.transportTripStudentStatus.findFirst({
      where: { tenantId, tripId, studentId },
      include: {
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            photoUrl: true,
            emergencyName: true,
            emergencyPhone: true,
          },
        },
      },
    });

    if (!status) {
      throw new NotFoundException('Student is not assigned to this trip route');
    }

    return status;
  }

  private listTripRows(
    actor: AuthContext,
    filters: { status?: 'ACTIVE'; routeId?: string; vehicleId?: string },
  ) {
    const isRestricted = !canOperateAnyTransportTrip(actor);

    return this.prisma.transportTrip.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.status ? { status: TransportTripStatus.ACTIVE } : {}),
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(isRestricted
          ? { driverAssignment: { staff: { userId: actor.userId } } }
          : {}),
      },
      include: {
        route: true,
        vehicle: true,
        driverAssignment: {
          include: {
            staff: {
              select: {
                id: true,
                userId: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 100,
    });
  }

  private toTripSummary(trip: {
    id: string;
    direction: unknown;
    status: unknown;
    startedAt: Date;
    completedAt?: Date | null;
    isDelayed?: boolean;
    delayMinutes?: number | null;
    delayReason?: string | null;
    route?: { id: string; name: string; code: string } | null;
    vehicle?: {
      id: string;
      registrationNumber: string;
      model?: string | null;
      capacity: number;
    } | null;
    driverAssignment?: { id: string } | null;
  }) {
    return {
      id: trip.id,
      direction: trip.direction,
      status: trip.status,
      startedAt: trip.startedAt.toISOString(),
      completedAt: trip.completedAt?.toISOString() ?? null,
      isDelayed: trip.isDelayed ?? false,
      delayMinutes: trip.delayMinutes ?? null,
      delayReason: trip.delayReason ?? null,
      route: trip.route
        ? {
            id: trip.route.id,
            name: trip.route.name,
            code: trip.route.code,
          }
        : null,
      vehicle: trip.vehicle
        ? {
            id: trip.vehicle.id,
            registrationNumber: trip.vehicle.registrationNumber,
            model: trip.vehicle.model ?? null,
            capacity: trip.vehicle.capacity,
          }
        : null,
      driverAssignmentId: trip.driverAssignment?.id ?? null,
    };
  }

  private async getTrip(tenantId: string, tripId: string) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: { tenantId, id: tripId },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found in this tenant');
    }

    return trip;
  }

  private async assertDriverCanOperateAssignment(
    actor: AuthContext,
    driverAssignmentId: string,
    action: string,
  ) {
    if (canOperateAnyTransportTrip(actor)) {
      return;
    }

    const assignment = await this.prisma.transportDriverAssignment.findFirst({
      where: {
        tenantId: actor.tenantId,
        id: driverAssignmentId,
      },
      include: {
        staff: {
          select: { userId: true },
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Driver assignment not found in this tenant');
    }

    if (assignment.staff.userId !== actor.userId) {
      throw new ForbiddenException(`Driver is not assigned to ${action}`);
    }
  }

  private assertValidLocationPing(dto: TransportLocationPingDto) {
    if (dto.latitude < -90 || dto.latitude > 90) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (dto.longitude < -180 || dto.longitude > 180) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (Number.isNaN(recordedAt.getTime())) {
      throw new BadRequestException('recordedAt must be a valid timestamp');
    }

    if (recordedAt.getTime() - Date.now() > 5 * 60 * 1000) {
      throw new BadRequestException(
        'recordedAt cannot be more than five minutes in the future',
      );
    }
  }

  private async getDriverAssignment(tenantId: string, assignmentId: string) {
    const assignment = await this.prisma.transportDriverAssignment.findFirst({
      where: { tenantId, id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException('Driver assignment not found in this tenant');
    }

    return assignment;
  }

  private assertDriverAssignmentMatchesTrip(
    assignment: {
      vehicleId: string;
      routeId: string | null;
      startsAt: Date;
      endsAt: Date | null;
    },
    routeId: string,
    vehicleId: string,
  ) {
    if (assignment.vehicleId !== vehicleId) {
      throw new ConflictException(
        'Driver assignment is not linked to this vehicle',
      );
    }

    if (assignment.routeId && assignment.routeId !== routeId) {
      throw new ConflictException(
        'Driver assignment is not linked to this route',
      );
    }

    const now = new Date();
    if (
      assignment.startsAt > now ||
      (assignment.endsAt && assignment.endsAt < now)
    ) {
      throw new ConflictException('Driver assignment is not active');
    }
  }

  private async findActiveDriverAssignment(
    tenantId: string,
    routeId: string,
    vehicleId: string,
  ) {
    const now = new Date();
    return this.prisma.transportDriverAssignment.findFirst({
      where: {
        tenantId,
        vehicleId,
        AND: [
          { OR: [{ routeId: null }, { routeId }] },
          { startsAt: { lte: now } },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ routeId: 'desc' }, { startsAt: 'desc' }],
    });
  }

  private async requireRoute(tenantId: string, routeId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: routeId, tenantId },
    });

    if (!route) {
      throw new NotFoundException('Route not found in this tenant');
    }

    return route;
  }

  private async requireStop(
    tenantId: string,
    stopId: string,
    routeId?: string,
  ) {
    const stop = await this.prisma.transportStop.findFirst({
      where: { id: stopId, tenantId, ...(routeId ? { routeId } : {}) },
    });

    if (!stop) {
      throw new NotFoundException('Stop not found in this tenant or route');
    }

    return stop;
  }

  private async requireVehicle(tenantId: string, vehicleId: string) {
    const vehicle = await this.prisma.transportVehicle.findFirst({
      where: { id: vehicleId, tenantId },
    });

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found in this tenant');
    }

    return vehicle;
  }

  private async updateStopCoordinates(
    stopId: string,
    tenantId: string,
    latitude?: number,
    longitude?: number,
  ) {
    if (latitude === undefined && longitude === undefined) {
      return;
    }

    await this.prisma.transportStop.updateMany({
      where: { tenantId, id: stopId },
      data: {
        ...(latitude !== undefined
          ? { latitude: new Prisma.Decimal(latitude) }
          : {}),
        ...(longitude !== undefined
          ? { longitude: new Prisma.Decimal(longitude) }
          : {}),
      },
    });
  }

  private latestLocationKey(tenantId: string, tripId: string) {
    return `transport:${tenantId}:trip:${tripId}:latest-location`;
  }

  private locationPressureKey(
    tenantId: string,
    tripId: string,
    userId: string,
  ) {
    return `transport:${tenantId}:trip:${tripId}:location-pressure:${userId}`;
  }

  private locationUpdateChannel(tenantId: string, tripId: string) {
    return `transport:${tenantId}:trip:${tripId}:location-updates`;
  }
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : value.toNumber();
}

function canOperateAnyTransportTrip(actor: AuthContext) {
  return (
    actor.roles.some((role) =>
      ['platform_super_admin', 'admin', 'principal'].includes(role),
    ) || actor.permissions.includes('transport:manage')
  );
}

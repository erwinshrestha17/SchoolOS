import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TransportEnrollmentStatus,
  TransportTripStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MapTransportFeeDto } from './dto/map-transport-fee.dto';
import { RecordTransportEmergencyContactDto } from './dto/record-transport-emergency-contact.dto';
import { ScheduleOneDayRouteChangeDto } from './dto/schedule-one-day-route-change.dto';
import { TransportLocationPingDto } from './dto/transport-location-ping.dto';
import { TransportService } from './transport.service';

type GpsLabel = 'fresh' | 'delayed' | 'stale' | 'missing';

type RedisCommandClient = {
  set(
    key: string,
    value: string,
    mode: 'EX',
    seconds: number,
  ): Promise<unknown>;
  lpush(key: string, value: string): Promise<unknown>;
  expire(key: string, seconds: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  incr?: (key: string) => Promise<unknown>;
  keys?: (pattern: string) => Promise<string[]>;
  get?: (key: string) => Promise<string | null>;
};

type OneDayRouteChangeRecord = {
  id: string;
  tenantId: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  routeCode: string;
  stopId: string;
  stopName: string;
  stopSequence: number;
  serviceDate: string;
  reason: string | null;
  createdById: string;
  createdAt: string;
  status: 'ACTIVE_ONE_DAY_CHANGE';
};

type MaintenanceReminderVehicle = {
  id: string;
  registrationNumber: string;
};

@Injectable()
export class TransportM8bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly transportService: TransportService,
  ) {}

  async getDriverGpsPingContract(actor: AuthContext) {
    const activeTrips = await this.prisma.transportTrip.findMany({
      where: {
        tenantId: actor.tenantId,
        status: TransportTripStatus.ACTIVE,
        ...(canOperateAnyTransportTrip(actor)
          ? {}
          : { driverAssignment: { staff: { userId: actor.userId } } }),
      },
      include: {
        route: true,
        vehicle: true,
        driverAssignment: { include: { staff: true } },
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 20,
    });

    const now = new Date();
    return {
      tenantId: actor.tenantId,
      generatedAt: now.toISOString(),
      strategy: 'POLLING_DEVICE_AUTH_CONTRACT',
      liveStreaming: {
        enabled: false,
        reason: 'NO_LIVE_MAP_SSE_WEBSOCKET_YET',
      },
      contract: {
        endpoint: '/transport/driver/trips/:id/gps-ping',
        method: 'POST',
        minIntervalSeconds: 15,
        pressureWindowSeconds: 1,
        staleAfterSeconds: 600,
        delayedAfterSeconds: 120,
        requiredFields: ['latitude', 'longitude'],
        optionalFields: ['speedKph', 'heading', 'recordedAt'],
      },
      trips: activeTrips.map((trip) => ({
        tripId: trip.id,
        route: {
          id: trip.route.id,
          name: trip.route.name,
          code: trip.route.code,
        },
        vehicle: {
          id: trip.vehicle.id,
          registrationNumber: trip.vehicle.registrationNumber,
        },
        startedAt: trip.startedAt.toISOString(),
        nextPingDueAt: now.toISOString(),
      })),
    };
  }

  async recordAutomatedDriverGpsPing(
    tripId: string,
    dto: TransportLocationPingDto,
    actor: AuthContext,
  ) {
    try {
      const location = await this.transportService.recordLocationPing(
        tripId,
        dto,
        actor,
      );
      await this.bumpGpsCounter(actor.tenantId, tripId, 'accepted');
      return {
        accepted: true,
        reason: 'ACCEPTED_ACTIVE_TRIP_DEVICE_CONTRACT',
        liveStreaming: false,
        location,
        timestamp: new Date().toISOString(),
        staleLabel: this.toGpsLabel(location.confidence ?? 'fresh'),
      };
    } catch (error) {
      await this.bumpGpsCounter(
        actor.tenantId,
        tripId,
        'rejected',
        classifyGpsRejection(error),
      );
      throw error;
    }
  }

  async getGpsAcceptRejectReport(
    actor: AuthContext,
    filters: { routeId?: string; vehicleId?: string } = {},
  ) {
    const since = addDays(new Date(), -1);
    const accepted = await this.prisma.transportLocationPing.findMany({
      where: {
        tenantId: actor.tenantId,
        recordedAt: { gte: since },
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.routeId ? { trip: { routeId: filters.routeId } } : {}),
      },
      include: { trip: { include: { route: true, vehicle: true } } },
      orderBy: [{ recordedAt: 'desc' }],
      take: 1000,
    });

    const acceptedByTrip = new Map<string, number>();
    for (const ping of accepted) {
      acceptedByTrip.set(
        ping.tripId,
        (acceptedByTrip.get(ping.tripId) ?? 0) + 1,
      );
    }

    const rejectionCounters = await this.readGpsRejectionCounters(
      actor.tenantId,
    );

    return {
      generatedAt: new Date().toISOString(),
      window: { since: since.toISOString(), until: new Date().toISOString() },
      totals: {
        acceptedPersisted: accepted.length,
        rejectedObserved: rejectionCounters.reduce(
          (sum, item) => sum + item.count,
          0,
        ),
      },
      acceptedByTrip: Array.from(acceptedByTrip.entries()).map(
        ([tripId, count]) => ({
          tripId,
          count,
        }),
      ),
      rejectedByTripAndReason: rejectionCounters,
      note: 'Accepted pings are persisted samples; rejected pings are Redis pressure/validation counters from the automated driver GPS ping endpoint.',
    };
  }

  async getStaleGpsReport(actor: AuthContext) {
    const activeTrips = await this.prisma.transportTrip.findMany({
      where: { tenantId: actor.tenantId, status: TransportTripStatus.ACTIVE },
      include: {
        route: true,
        vehicle: true,
        driverAssignment: { include: { staff: true } },
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 200,
    });

    const items = [] as Array<Record<string, unknown>>;
    for (const trip of activeTrips) {
      const latest = await this.transportService
        .getLatestTripLocation(trip.id, actor)
        .catch(() => null);
      const staleLabel = latest
        ? this.toGpsLabel(latest.confidence ?? 'fresh')
        : 'missing';
      items.push({
        tripId: trip.id,
        route: {
          id: trip.route.id,
          name: trip.route.name,
          code: trip.route.code,
        },
        vehicle: {
          id: trip.vehicle.id,
          registrationNumber: trip.vehicle.registrationNumber,
        },
        driver: {
          assignmentId: trip.driverAssignmentId,
          staffId: trip.driverAssignment.staffId,
          name: `${trip.driverAssignment.staff.firstName} ${trip.driverAssignment.staff.lastName}`,
        },
        startedAt: trip.startedAt.toISOString(),
        latestLocation: latest,
        timestamp: latest?.recordedAt ?? null,
        staleLabel,
        isStale: staleLabel === 'stale' || staleLabel === 'missing',
      });
    }

    return { generatedAt: new Date().toISOString(), items };
  }

  async scheduleOneDayRouteChange(
    dto: ScheduleOneDayRouteChangeDto,
    actor: AuthContext,
  ) {
    const serviceDate = dateOnly(dto.serviceDate);
    const [student, route, stop] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
        select: { id: true, firstNameEn: true, lastNameEn: true },
      }),
      this.prisma.transportRoute.findFirst({
        where: { id: dto.routeId, tenantId: actor.tenantId, isActive: true },
      }),
      this.prisma.transportStop.findFirst({
        where: {
          id: dto.stopId,
          tenantId: actor.tenantId,
          routeId: dto.routeId,
        },
      }),
    ]);

    if (!student)
      throw new NotFoundException('Student not found in this tenant');
    if (!route) throw new NotFoundException('Route not found in this tenant');
    if (!stop) throw new NotFoundException('Stop not found in this route');

    const record: OneDayRouteChangeRecord = {
      id: `${serviceDate}:${dto.studentId}`,
      tenantId: actor.tenantId,
      studentId: student.id,
      studentName: `${student.firstNameEn} ${student.lastNameEn}`,
      routeId: route.id,
      routeName: route.name,
      routeCode: route.code,
      stopId: stop.id,
      stopName: stop.name,
      stopSequence: stop.sequence,
      serviceDate,
      reason: dto.reason ?? null,
      createdById: actor.userId,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE_ONE_DAY_CHANGE',
    };

    const redis = this.redisService.getClient() as RedisCommandClient;
    await redis.set(
      this.oneDayRouteChangeKey(actor.tenantId, serviceDate, student.id),
      JSON.stringify(record),
      'EX',
      60 * 60 * 24 * 10,
    );
    await redis.lpush(
      this.oneDayRouteChangesListKey(actor.tenantId, serviceDate),
      JSON.stringify(record),
    );
    await redis.expire(
      this.oneDayRouteChangesListKey(actor.tenantId, serviceDate),
      60 * 60 * 24 * 10,
    );

    await this.auditService.record({
      action: 'schedule_one_day_route_change',
      resource: 'transport_one_day_route_change',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: record.id,
      after: record,
    });

    return record;
  }

  async listOneDayRouteChanges(actor: AuthContext, serviceDate?: string) {
    const date = dateOnly(serviceDate ?? new Date().toISOString());
    const redis = this.redisService.getClient() as RedisCommandClient;
    const rows = await redis.lrange(
      this.oneDayRouteChangesListKey(actor.tenantId, date),
      0,
      200,
    );

    const seen = new Set<string>();
    const items = rows
      .map((row) => safeJson(row))
      .filter(isOneDayRouteChangeRecord)
      .filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });

    return { generatedAt: new Date().toISOString(), serviceDate: date, items };
  }

  async getVehicleDocumentExpiryReport(actor: AuthContext, days = 30) {
    const normalizedDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const now = new Date();
    const until = addDays(now, normalizedDays);
    const vehicles = await this.prisma.transportVehicle.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ registrationNumber: 'asc' }],
      take: 500,
    });

    return {
      generatedAt: now.toISOString(),
      windowDays: normalizedDays,
      items: vehicles.map((vehicle) => ({
        vehicleId: vehicle.id,
        registrationNumber: vehicle.registrationNumber,
        status: vehicle.status,
        documents: {
          fitnessCertificateExp: documentState(
            vehicle.fitnessCertificateExp,
            now,
            until,
          ),
          insuranceExpiry: documentState(vehicle.insuranceExpiry, now, until),
          registrationExpiry: documentState(
            vehicle.registrationExpiry,
            now,
            until,
          ),
          pollutionExpiry: documentState(vehicle.pollutionExpiry, now, until),
          documentExpiry: documentState(vehicle.documentExpiry, now, until),
        },
      })),
    };
  }

  async getMaintenanceReminderReport(actor: AuthContext) {
    const trips = await this.prisma.transportTrip.findMany({
      where: { tenantId: actor.tenantId },
      include: { vehicle: true },
      orderBy: [{ startedAt: 'desc' }],
      take: 500,
    });

    const byVehicle = new Map<
      string,
      {
        vehicle: MaintenanceReminderVehicle;
        tripCount: number;
        latestTripAt: Date;
      }
    >();
    for (const trip of trips) {
      const current = byVehicle.get(trip.vehicleId);
      if (!current) {
        byVehicle.set(trip.vehicleId, {
          vehicle: trip.vehicle,
          tripCount: 1,
          latestTripAt: trip.startedAt,
        });
      } else {
        current.tripCount += 1;
        if (trip.startedAt > current.latestTripAt)
          current.latestTripAt = trip.startedAt;
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      strategy: 'TRIP_COUNT_AND_DOCUMENT_REMINDER_FOUNDATION',
      items: Array.from(byVehicle.values()).map((item) => ({
        vehicleId: item.vehicle.id,
        registrationNumber: item.vehicle.registrationNumber,
        recentTripCount: item.tripCount,
        latestTripAt: item.latestTripAt.toISOString(),
        reminderLevel: item.tripCount >= 30 ? 'SERVICE_REVIEW_DUE' : 'MONITOR',
      })),
    };
  }

  async getAssignmentDepthReport(actor: AuthContext) {
    const routes = await this.prisma.transportRoute.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        vehicle: true,
        driverAssignments: {
          include: { staff: true, vehicle: true },
          orderBy: [{ startsAt: 'desc' }],
        },
        studentAssignments: {
          where: { status: TransportEnrollmentStatus.ACTIVE },
        },
      },
      orderBy: [{ name: 'asc' }],
      take: 200,
    });

    return {
      generatedAt: new Date().toISOString(),
      items: routes.map((route) => ({
        routeId: route.id,
        routeName: route.name,
        routeCode: route.code,
        vehicle: route.vehicle
          ? {
              id: route.vehicle.id,
              registrationNumber: route.vehicle.registrationNumber,
            }
          : null,
        activeStudentAssignments: route.studentAssignments.length,
        driverAssignments: route.driverAssignments.map((assignment) => ({
          id: assignment.id,
          staffId: assignment.staffId,
          staffName: `${assignment.staff.firstName} ${assignment.staff.lastName}`,
          vehicleId: assignment.vehicleId,
          registrationNumber: assignment.vehicle.registrationNumber,
          startsAt: assignment.startsAt.toISOString(),
          endsAt: assignment.endsAt?.toISOString() ?? null,
          licenseExpires: assignment.licenseExpires?.toISOString() ?? null,
          isActiveNow:
            assignment.startsAt <= new Date() &&
            (!assignment.endsAt || assignment.endsAt >= new Date()),
        })),
        conductorAssignments: {
          supported: false,
          reason: 'CONDUCTOR_ASSIGNMENT_SCHEMA_NOT_PRESENT',
        },
      })),
    };
  }

  async mapTransportFee(
    assignmentId: string,
    dto: MapTransportFeeDto,
    actor: AuthContext,
  ) {
    const assignment = await this.prisma.transportStudentAssignment.findFirst({
      where: { id: assignmentId, tenantId: actor.tenantId },
    });
    if (!assignment) {
      throw new NotFoundException('Transport student assignment not found');
    }

    const feeAssignment = await this.prisma.studentFeeAssignment.findFirst({
      where: {
        id: dto.feeAssignmentId,
        tenantId: actor.tenantId,
        studentId: assignment.studentId,
        isActive: true,
      },
    });
    if (!feeAssignment) {
      throw new NotFoundException(
        'Active M3 student fee assignment not found for this student',
      );
    }

    const existing = await this.prisma.transportEnrollment.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: assignment.studentId,
        routeId: assignment.routeId,
        status: TransportEnrollmentStatus.ACTIVE,
      },
    });

    const data = {
      feeAssignmentId: feeAssignment.id,
      feeAmount: new Prisma.Decimal(dto.feeAmount),
    };

    const enrollment = existing
      ? await this.prisma.transportEnrollment.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.transportEnrollment.create({
          data: {
            tenantId: actor.tenantId,
            studentId: assignment.studentId,
            routeId: assignment.routeId,
            stopId: assignment.stopId,
            status: TransportEnrollmentStatus.ACTIVE,
            startedAt: assignment.startedAt,
            ...data,
          },
        });

    await this.auditService.record({
      action: 'map_transport_fee',
      resource: 'transport_enrollment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: enrollment.id,
      after: {
        studentId: assignment.studentId,
        routeId: assignment.routeId,
        feeAssignmentId: feeAssignment.id,
        feeAmount: dto.feeAmount,
        note: dto.note ?? null,
      },
    });

    return enrollment;
  }

  async getParentStudentStatus(studentId: string, actor: AuthContext) {
    const guardianLink = await this.prisma.studentGuardian.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        guardian: { userId: actor.userId },
      },
      include: { student: true },
    });
    if (!guardianLink) {
      throw new ForbiddenException('Student is outside guardian scope');
    }

    const status = await this.prisma.transportTripStudentStatus.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        trip: { status: TransportTripStatus.ACTIVE },
      },
      include: {
        stop: true,
        trip: {
          include: {
            route: true,
            vehicle: true,
            driverAssignment: { include: { staff: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!status) {
      return {
        timestamp: new Date().toISOString(),
        staleLabel: 'missing' satisfies GpsLabel,
        student: this.toStudentSummary(guardianLink.student),
        activeTrip: null,
      };
    }

    const latestLocation = await this.transportService
      .getLatestTripLocationForScopedTrip(status.tripId, actor)
      .catch(() => null);
    const staleLabel = latestLocation
      ? this.toGpsLabel(latestLocation.confidence ?? 'fresh')
      : 'missing';
    const oneDayChange = await this.readOneDayRouteChange(
      actor.tenantId,
      todayYmd(),
      studentId,
    );

    return {
      timestamp: new Date().toISOString(),
      staleLabel,
      student: this.toStudentSummary(guardianLink.student),
      trip: {
        id: status.trip.id,
        direction: status.trip.direction,
        status: status.trip.status,
        startedAt: status.trip.startedAt.toISOString(),
        isDelayed: status.trip.isDelayed,
        delayMinutes: status.trip.delayMinutes,
        delayReason: status.trip.delayReason,
      },
      childStatus: {
        status: status.status,
        boardedAt: status.boardedAt?.toISOString() ?? null,
        droppedAt: status.droppedAt?.toISOString() ?? null,
      },
      route: {
        id: status.trip.route.id,
        name: status.trip.route.name,
        code: status.trip.route.code,
      },
      oneDayRouteChange: oneDayChange,
      stop: {
        id: status.stop.id,
        name: status.stop.name,
        sequence: status.stop.sequence,
      },
      vehicle: {
        id: status.trip.vehicle.id,
        registrationNumber: status.trip.vehicle.registrationNumber,
        model: status.trip.vehicle.model,
      },
      driver: {
        staffId: status.trip.driverAssignment.staff.id,
        name: `${status.trip.driverAssignment.staff.firstName} ${status.trip.driverAssignment.staff.lastName}`,
      },
      latestLocation,
      liveStreaming: false,
    };
  }

  async recordEmergencyContactFlow(
    tripId: string,
    dto: RecordTransportEmergencyContactDto,
    actor: AuthContext,
  ) {
    const status = await this.prisma.transportTripStudentStatus.findFirst({
      where: {
        tenantId: actor.tenantId,
        tripId,
        studentId: dto.studentId,
        trip: { status: TransportTripStatus.ACTIVE },
      },
      include: {
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            emergencyName: true,
            emergencyPhone: true,
          },
        },
        trip: { include: { driverAssignment: { include: { staff: true } } } },
      },
    });
    if (!status) {
      throw new NotFoundException('Student is not on this active trip');
    }
    if (!canOperateAnyTransportTrip(actor)) {
      const driverUserId = status.trip.driverAssignment.staff.userId;
      if (driverUserId !== actor.userId) {
        throw new ForbiddenException('Driver is not assigned to this trip');
      }
    }

    const event = {
      tripId,
      studentId: status.student.id,
      studentName: `${status.student.firstNameEn} ${status.student.lastNameEn}`,
      emergencyName: status.student.emergencyName,
      emergencyPhone: status.student.emergencyPhone,
      channel: dto.channel ?? 'CALL',
      reason: dto.reason,
      recordedById: actor.userId,
      recordedAt: new Date().toISOString(),
    };

    await this.auditService.record({
      action: 'record_emergency_contact_flow',
      resource: 'transport_emergency_contact',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: `${tripId}:${dto.studentId}:${Date.now()}`,
      after: event,
    });

    return event;
  }

  private async bumpGpsCounter(
    tenantId: string,
    tripId: string,
    outcome: 'accepted' | 'rejected',
    reason = 'accepted',
  ) {
    const redis = this.redisService.getClient() as RedisCommandClient;
    const key = this.gpsCounterKey(tenantId, tripId, outcome, reason);
    if (typeof redis.incr === 'function') {
      await redis.incr(key);
      if (typeof redis.expire === 'function') {
        await redis.expire(key, 60 * 60 * 24);
      }
    }
  }

  private async readGpsRejectionCounters(tenantId: string) {
    const redis = this.redisService.getClient() as RedisCommandClient;
    if (typeof redis.keys !== 'function' || typeof redis.get !== 'function') {
      return [] as Array<{ tripId: string; reason: string; count: number }>;
    }
    const keys = (await redis.keys(
      `transport:${tenantId}:gps:rejected:*`,
    )) as string[];
    const rows = [] as Array<{ tripId: string; reason: string; count: number }>;
    for (const key of keys.slice(0, 500)) {
      const count = Number((await redis.get(key)) ?? 0);
      const [, , , , tripId, reason] = key.split(':');
      rows.push({ tripId, reason, count });
    }
    return rows;
  }

  private async readOneDayRouteChange(
    tenantId: string,
    serviceDate: string,
    studentId: string,
  ) {
    const redis = this.redisService.getClient() as RedisCommandClient;
    if (typeof redis.get !== 'function') return null;
    const value = await redis.get(
      this.oneDayRouteChangeKey(tenantId, serviceDate, studentId),
    );
    return value ? safeJson(value) : null;
  }

  private gpsCounterKey(
    tenantId: string,
    tripId: string,
    outcome: 'accepted' | 'rejected',
    reason: string,
  ) {
    return `transport:${tenantId}:gps:${outcome}:${tripId}:${reason}`;
  }

  private oneDayRouteChangeKey(
    tenantId: string,
    serviceDate: string,
    studentId: string,
  ) {
    return `transport:${tenantId}:route-change:${serviceDate}:${studentId}`;
  }

  private oneDayRouteChangesListKey(tenantId: string, serviceDate: string) {
    return `transport:${tenantId}:route-changes:${serviceDate}`;
  }

  private toGpsLabel(confidence: string): GpsLabel {
    if (
      confidence === 'fresh' ||
      confidence === 'delayed' ||
      confidence === 'stale'
    ) {
      return confidence;
    }
    return 'missing';
  }

  private toStudentSummary(student: {
    id: string;
    firstNameEn: string;
    lastNameEn?: string | null;
  }) {
    return {
      id: student.id,
      name: `${student.firstNameEn} ${student.lastNameEn ?? ''}`.trim(),
    };
  }
}

function canOperateAnyTransportTrip(actor: AuthContext) {
  return (
    actor.roles.some((role) =>
      ['platform_super_admin', 'admin', 'principal'].includes(role),
    ) || actor.permissions.includes('transport:manage')
  );
}

function classifyGpsRejection(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('too quickly')) return 'PRESSURE_WINDOW';
  if (message.includes('active trips')) return 'TRIP_NOT_ACTIVE';
  if (message.includes('Latitude')) return 'BAD_LATITUDE';
  if (message.includes('Longitude')) return 'BAD_LONGITUDE';
  if (message.includes('future')) return 'FUTURE_RECORDED_AT';
  if (message.includes('Driver is not assigned')) return 'DRIVER_SCOPE_DENIED';
  return 'VALIDATION_OR_SCOPE_REJECTED';
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isOneDayRouteChangeRecord(
  value: unknown,
): value is OneDayRouteChangeRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { id?: unknown };
  return typeof candidate.id === 'string';
}

function dateOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('serviceDate must be a valid date');
  }
  return date.toISOString().slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function documentState(value: Date | null, now: Date, until: Date) {
  if (!value) {
    return { status: 'MISSING', expiresAt: null, daysRemaining: null };
  }
  const daysRemaining = Math.ceil(
    (value.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
  );
  return {
    status: value < now ? 'EXPIRED' : value <= until ? 'DUE_SOON' : 'VALID',
    expiresAt: value.toISOString(),
    daysRemaining,
  };
}

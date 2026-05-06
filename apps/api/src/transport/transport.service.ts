import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  NotificationChannel,
  Prisma,
  TransportBoardingStatus,
  TransportEnrollmentStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
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

type DriverAssignmentRow = {
  id: string;
  tenantId: string;
  vehicleId: string;
  routeId: string | null;
  staffId: string;
  licenseNumber: string | null;
  startsAt: Date;
  endsAt: Date | null;
  registrationNumber?: string;
  routeName?: string | null;
  staffName?: string | null;
};

type TransportTripRow = {
  id: string;
  tenantId: string;
  routeId: string;
  vehicleId: string;
  driverAssignmentId: string;
  direction: 'PICKUP' | 'DROP';
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startedAt: Date;
  completedAt: Date | null;
  notes: string | null;
  routeName?: string;
  registrationNumber?: string;
};

type TripStudentRow = {
  id: string;
  tenantId: string;
  tripId: string;
  studentAssignmentId: string;
  studentId: string;
  stopId: string;
  status: 'PENDING' | 'BOARDED' | 'DROPPED' | 'ABSENT';
  boardedAt: Date | null;
  droppedAt: Date | null;
};

type LocationPayload = {
  tenantId: string;
  tripId: string;
  vehicleId: string;
  driverAssignmentId: string;
  latitude: number;
  longitude: number;
  speedKph?: number;
  heading?: number;
  recordedAt: string;
};

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly redisService: RedisService,
  ) {}

  listRoutes(actor: AuthContext, query?: string) {
    return this.prisma.transportRoute.findMany({
      where: {
        tenantId: actor.tenantId,
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
          })),
        },
      },
      include: { stops: { orderBy: [{ sequence: 'asc' }] } },
    });

    await Promise.all(
      route.stops.map((createdStop) => {
        const input = dto.stops.find(
          (stop) => stop.name.trim() === createdStop.name && stop.sequence === createdStop.sequence,
        );
        return input?.latitude !== undefined || input?.longitude !== undefined
          ? this.updateStopCoordinates(createdStop.id, actor.tenantId, input.latitude, input.longitude)
          : Promise.resolve();
      }),
    );

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

  async updateRoute(routeId: string, dto: UpdateTransportRouteDto, actor: AuthContext) {
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
        ...(dto.vehicleId !== undefined ? { vehicleId: dto.vehicleId || null } : {}),
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

  listStops(actor: AuthContext, routeId?: string) {
    return this.prisma.transportStop.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(routeId ? { routeId } : {}),
      },
      include: { route: true },
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

    await this.updateStopCoordinates(stop.id, actor.tenantId, dto.latitude, dto.longitude);

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

  async updateStop(stopId: string, dto: UpdateTransportStopDto, actor: AuthContext) {
    await this.requireStop(actor.tenantId, stopId);

    const stop = await this.prisma.transportStop.update({
      where: { id: stopId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.sequence !== undefined ? { sequence: dto.sequence } : {}),
        ...(dto.estimatedPickup !== undefined ? { estimatedPickup: dto.estimatedPickup || null } : {}),
        ...(dto.estimatedDrop !== undefined ? { estimatedDrop: dto.estimatedDrop || null } : {}),
      },
    });

    await this.updateStopCoordinates(stop.id, actor.tenantId, dto.latitude, dto.longitude);

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

  listVehicles(actor: AuthContext, query?: string) {
    return this.prisma.transportVehicle.findMany({
      where: {
        tenantId: actor.tenantId,
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
        capacity: dto.capacity,
        fitnessCertificateExp: dto.fitnessCertificateExp
          ? new Date(dto.fitnessCertificateExp)
          : null,
      },
    });

    await this.prisma.$executeRaw`
      UPDATE "TransportVehicle"
      SET "model" = ${dto.model ?? null}, "documentExpiry" = ${dto.documentExpiry ? new Date(dto.documentExpiry) : null}
      WHERE "tenantId" = ${actor.tenantId} AND "id" = ${vehicle.id}
    `;

    await this.auditService.record({
      action: 'create',
      resource: 'transport_vehicle',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: vehicle.id,
      after: { registrationNumber: vehicle.registrationNumber, capacity: vehicle.capacity },
    });

    return vehicle;
  }

  async updateVehicle(vehicleId: string, dto: UpdateTransportVehicleDto, actor: AuthContext) {
    await this.requireVehicle(actor.tenantId, vehicleId);

    const vehicle = await this.prisma.transportVehicle.update({
      where: { id: vehicleId },
      data: {
        ...(dto.registrationNumber ? { registrationNumber: dto.registrationNumber.trim() } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.fitnessCertificateExp !== undefined
          ? { fitnessCertificateExp: dto.fitnessCertificateExp ? new Date(dto.fitnessCertificateExp) : null }
          : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
      },
    });

    await this.prisma.$executeRaw`
      UPDATE "TransportVehicle"
      SET "model" = COALESCE(${dto.model ?? null}, "model"),
          "documentExpiry" = COALESCE(${dto.documentExpiry ? new Date(dto.documentExpiry) : null}, "documentExpiry")
      WHERE "tenantId" = ${actor.tenantId} AND "id" = ${vehicle.id}
    `;

    await this.auditService.record({
      action: 'update',
      resource: 'transport_vehicle',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: vehicle.id,
      after: { registrationNumber: vehicle.registrationNumber, capacity: vehicle.capacity },
    });

    return vehicle;
  }

  listDriverAssignments(
    actor: AuthContext,
    filters: { routeId?: string; vehicleId?: string },
  ) {
    const routeFilter = filters.routeId ? Prisma.sql`AND da."routeId" = ${filters.routeId}` : Prisma.empty;
    const vehicleFilter = filters.vehicleId ? Prisma.sql`AND da."vehicleId" = ${filters.vehicleId}` : Prisma.empty;

    return this.prisma.$queryRaw<DriverAssignmentRow[]>`
      SELECT da.*, v."registrationNumber", r."name" AS "routeName",
             CONCAT(s."firstName", ' ', s."lastName") AS "staffName"
      FROM "TransportDriverAssignment" da
      JOIN "TransportVehicle" v ON v."id" = da."vehicleId" AND v."tenantId" = da."tenantId"
      LEFT JOIN "TransportRoute" r ON r."id" = da."routeId" AND r."tenantId" = da."tenantId"
      JOIN "Staff" s ON s."id" = da."staffId" AND s."tenantId" = da."tenantId"
      WHERE da."tenantId" = ${actor.tenantId} ${routeFilter} ${vehicleFilter}
      ORDER BY da."startsAt" DESC
      LIMIT 100
    `;
  }

  async assignDriver(dto: AssignTransportDriverDto, actor: AuthContext) {
    const [vehicle, staff] = await Promise.all([
      this.requireVehicle(actor.tenantId, dto.vehicleId),
      this.prisma.staff.findFirst({ where: { id: dto.staffId, tenantId: actor.tenantId } }),
    ]);

    if (!staff) {
      throw new NotFoundException('Driver staff profile not found in this tenant');
    }

    if (dto.routeId) {
      await this.requireRoute(actor.tenantId, dto.routeId);
    }

    const assignment = await this.prisma.transportDriverAssignment.create({
      data: {
        tenantId: actor.tenantId,
        vehicleId: vehicle.id,
        staffId: staff.id,
        licenseNumber: dto.licenseNumber ?? null,
        licenseExpires: dto.licenseExpires ? new Date(dto.licenseExpires) : null,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: { staff: true, vehicle: true },
    });

    if (dto.routeId) {
      await this.prisma.$executeRaw`
        UPDATE "TransportDriverAssignment"
        SET "routeId" = ${dto.routeId}
        WHERE "tenantId" = ${actor.tenantId} AND "id" = ${assignment.id}
      `;
    }

    await this.auditService.record({
      action: 'assign',
      resource: 'transport_driver_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: { vehicleId: vehicle.id, routeId: dto.routeId ?? null, staffId: staff.id },
    });

    return assignment;
  }

  listStudentAssignments(
    actor: AuthContext,
    filters: { routeId?: string; studentId?: string },
  ) {
    const routeFilter = filters.routeId ? Prisma.sql`AND tsa."routeId" = ${filters.routeId}` : Prisma.empty;
    const studentFilter = filters.studentId ? Prisma.sql`AND tsa."studentId" = ${filters.studentId}` : Prisma.empty;

    return this.prisma.$queryRaw`
      SELECT tsa.*, r."name" AS "routeName", st."name" AS "stopName",
             CONCAT(s."firstNameEn", ' ', s."lastNameEn") AS "studentName"
      FROM "TransportStudentAssignment" tsa
      JOIN "TransportRoute" r ON r."id" = tsa."routeId" AND r."tenantId" = tsa."tenantId"
      JOIN "TransportStop" st ON st."id" = tsa."stopId" AND st."tenantId" = tsa."tenantId"
      JOIN "Student" s ON s."id" = tsa."studentId" AND s."tenantId" = tsa."tenantId"
      WHERE tsa."tenantId" = ${actor.tenantId} ${routeFilter} ${studentFilter}
      ORDER BY tsa."createdAt" DESC
      LIMIT 100
    `;
  }

  async assignStudent(dto: EnrollTransportStudentDto, actor: AuthContext) {
    const [student, route, stop] = await Promise.all([
      this.prisma.student.findFirst({ where: { id: dto.studentId, tenantId: actor.tenantId } }),
      this.requireRoute(actor.tenantId, dto.routeId),
      this.requireStop(actor.tenantId, dto.stopId, dto.routeId),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TransportStudentAssignment"
      WHERE "tenantId" = ${actor.tenantId} AND "studentId" = ${student.id} AND "status" = 'ACTIVE'
      LIMIT 1
    `;

    if (existing.length > 0) {
      throw new ConflictException('Student already has an active transport assignment');
    }

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "TransportStudentAssignment"
        ("id", "tenantId", "studentId", "routeId", "stopId", "status", "startedAt", "notes")
      VALUES
        (${id}, ${actor.tenantId}, ${student.id}, ${route.id}, ${stop.id}, 'ACTIVE', ${dto.startedAt ? new Date(dto.startedAt) : new Date()}, ${null})
    `;

    await this.auditService.record({
      action: 'assign',
      resource: 'transport_student_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      after: { studentId: student.id, routeId: route.id, stopId: stop.id },
    });

    return { id, tenantId: actor.tenantId, studentId: student.id, routeId: route.id, stopId: stop.id, status: 'ACTIVE' };
  }

  async startTrip(dto: StartTransportTripDto, actor: AuthContext) {
    const [route, vehicle] = await Promise.all([
      this.requireRoute(actor.tenantId, dto.routeId),
      this.requireVehicle(actor.tenantId, dto.vehicleId),
    ]);

    const activeForVehicle = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "TransportTrip"
      WHERE "tenantId" = ${actor.tenantId} AND "vehicleId" = ${vehicle.id} AND "status" = 'ACTIVE'
      LIMIT 1
    `;

    if (activeForVehicle.length > 0) {
      throw new ConflictException('Vehicle already has an active trip');
    }

    const driverAssignment = dto.driverAssignmentId
      ? await this.getDriverAssignment(actor.tenantId, dto.driverAssignmentId)
      : await this.findActiveDriverAssignment(actor.tenantId, route.id, vehicle.id);

    if (!driverAssignment) {
      throw new ConflictException('Cannot start trip without assigned driver and vehicle');
    }

    const tripId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "TransportTrip"
          ("id", "tenantId", "routeId", "vehicleId", "driverAssignmentId", "direction", "status", "startedAt", "notes", "createdById")
        VALUES
          (${tripId}, ${actor.tenantId}, ${route.id}, ${vehicle.id}, ${driverAssignment.id}, ${dto.direction}::"TransportTripDirection", 'ACTIVE', ${new Date()}, ${dto.notes ?? null}, ${actor.userId})
      `;

      await tx.$executeRaw`
        INSERT INTO "TransportTripStudentStatus"
          ("id", "tenantId", "tripId", "studentAssignmentId", "studentId", "stopId", "status")
        SELECT gen_random_uuid(), "tenantId", ${tripId}, "id", "studentId", "stopId", 'PENDING'
        FROM "TransportStudentAssignment"
        WHERE "tenantId" = ${actor.tenantId} AND "routeId" = ${route.id} AND "status" = 'ACTIVE'
      `;
    });

    await this.auditService.record({
      action: 'start',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: tripId,
      after: { routeId: route.id, vehicleId: vehicle.id, driverAssignmentId: driverAssignment.id },
    });

    return this.getTrip(actor.tenantId, tripId);
  }

  async completeTrip(tripId: string, dto: CompleteTransportTripDto, actor: AuthContext) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status === 'COMPLETED') {
      throw new ConflictException('Trip is already completed');
    }

    await this.prisma.$executeRaw`
      UPDATE "TransportTrip"
      SET "status" = 'COMPLETED', "completedAt" = ${new Date()}, "completedById" = ${actor.userId}, "notes" = COALESCE(${dto.notes ?? null}, "notes"), "updatedAt" = ${new Date()}
      WHERE "tenantId" = ${actor.tenantId} AND "id" = ${trip.id}
    `;

    await this.redisService.getClient().del(this.latestLocationKey(actor.tenantId, trip.id));

    await this.auditService.record({
      action: 'complete',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: trip.id,
      after: { status: 'COMPLETED' },
    });

    return this.getTrip(actor.tenantId, trip.id);
  }

  markStudentBoarded(
    tripId: string,
    dto: MarkTransportStudentStatusDto,
    actor: AuthContext,
  ) {
    return this.updateTripStudentStatus(tripId, dto.studentId, actor, 'BOARDED', dto.notes);
  }

  async markStudentDropped(
    tripId: string,
    dto: MarkTransportStudentStatusDto,
    actor: AuthContext,
  ) {
    const status = await this.getTripStudentStatus(actor.tenantId, tripId, dto.studentId);

    if (status.status === 'PENDING' && dto.absent) {
      return this.updateTripStudentStatus(tripId, dto.studentId, actor, 'ABSENT', dto.notes);
    }

    if (status.status !== 'BOARDED') {
      throw new ConflictException('Student cannot be dropped before boarding unless marked absent');
    }

    return this.updateTripStudentStatus(tripId, dto.studentId, actor, 'DROPPED', dto.notes);
  }

  listActiveTrips(actor: AuthContext) {
    return this.listTripRows(actor.tenantId, { status: 'ACTIVE' });
  }

  listTripHistory(
    actor: AuthContext,
    filters: { routeId?: string; vehicleId?: string },
  ) {
    return this.listTripRows(actor.tenantId, filters);
  }

  async recordLocationPing(
    tripId: string,
    dto: TransportLocationPingDto,
    actor: AuthContext,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status !== 'ACTIVE') {
      throw new ConflictException('Location pings are accepted only for active trips');
    }

    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
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

    await this.redisService.getClient().set(
      this.latestLocationKey(actor.tenantId, trip.id),
      JSON.stringify(payload),
      'EX',
      60 * 60 * 6,
    );

    await this.prisma.$executeRaw`
      INSERT INTO "TransportLocationPing"
        ("id", "tenantId", "tripId", "vehicleId", "driverAssignmentId", "latitude", "longitude", "speedKph", "heading", "recordedAt")
      VALUES
        (${randomUUID()}, ${actor.tenantId}, ${trip.id}, ${trip.vehicleId}, ${trip.driverAssignmentId}, ${dto.latitude}, ${dto.longitude}, ${dto.speedKph ?? null}, ${dto.heading ?? null}, ${recordedAt})
    `;

    return payload;
  }

  async getLatestTripLocation(tripId: string, actor: AuthContext) {
    await this.getTrip(actor.tenantId, tripId);
    const cached = await this.redisService
      .getClient()
      .get(this.latestLocationKey(actor.tenantId, tripId));

    if (cached) {
      return JSON.parse(cached) as LocationPayload;
    }

    const [latest] = await this.prisma.$queryRaw<LocationPayload[]>`
      SELECT "tenantId", "tripId", "vehicleId", "driverAssignmentId", "latitude"::float AS "latitude", "longitude"::float AS "longitude", "speedKph"::float AS "speedKph", "heading"::float AS "heading", "recordedAt"
      FROM "TransportLocationPing"
      WHERE "tenantId" = ${actor.tenantId} AND "tripId" = ${tripId}
      ORDER BY "recordedAt" DESC
      LIMIT 1
    `;

    if (!latest) {
      throw new NotFoundException('No location ping found for this trip');
    }

    return latest;
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
      (dto.status === TransportBoardingStatus.BOARDED || dto.status === TransportBoardingStatus.DROPPED)
    ) {
      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'transport_log',
        sourceId: log.id,
        audienceType: AudienceType.ALL,
        studentIds: [studentId],
        title: dto.status === TransportBoardingStatus.BOARDED ? 'Transport boarding update' : 'Transport drop-off update',
        body: dto.status === TransportBoardingStatus.BOARDED ? 'Your child boarded the school vehicle.' : 'Your child was dropped at the assigned stop.',
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
      after: { routeId: log.routeId, studentId: log.studentId, status: log.status },
    });

    return log;
  }

  async broadcastDelay(dto: BroadcastRouteDelayDto, actor: AuthContext) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: dto.routeId, tenantId: actor.tenantId },
      include: { enrollments: { where: { status: TransportEnrollmentStatus.ACTIVE } } },
    });

    if (!route) {
      throw new NotFoundException('Route not found in this tenant');
    }

    const studentAssignments = await this.prisma.$queryRaw<{ studentId: string }[]>`
      SELECT "studentId" FROM "TransportStudentAssignment"
      WHERE "tenantId" = ${actor.tenantId} AND "routeId" = ${route.id} AND "status" = 'ACTIVE'
    `;
    const studentIds = Array.from(new Set([
      ...route.enrollments.map((enrollment) => enrollment.studentId),
      ...studentAssignments.map((assignment) => assignment.studentId),
    ]));

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

    await this.auditService.record({
      action: 'broadcast_delay',
      resource: 'transport_route',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: route.id,
      after: { routeId: route.id, studentCount: studentIds.length },
    });

    return { routeId: route.id, studentCount: studentIds.length, deliveryCount: delivery.count };
  }

  async getReports(actor: AuthContext) {
    const [activeAssignments, activeTrips, logsToday, vehicleAlerts, driverAlerts] =
      await Promise.all([
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM "TransportStudentAssignment"
          WHERE "tenantId" = ${actor.tenantId} AND "status" = 'ACTIVE'
        `,
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint AS count FROM "TransportTrip"
          WHERE "tenantId" = ${actor.tenantId} AND "status" = 'ACTIVE'
        `,
        this.prisma.transportLog.count({
          where: { tenantId: actor.tenantId, occurredAt: { gte: startOfToday() } },
        }),
        this.prisma.transportVehicle.findMany({
          where: {
            tenantId: actor.tenantId,
            fitnessCertificateExp: { lte: addDays(new Date(), 30), gte: new Date() },
          },
        }),
        this.prisma.transportDriverAssignment.findMany({
          where: {
            tenantId: actor.tenantId,
            licenseExpires: { lte: addDays(new Date(), 30), gte: new Date() },
          },
          include: { staff: true, vehicle: true },
        }),
      ]);

    return {
      activeAssignments: Number(activeAssignments[0]?.count ?? 0),
      activeTrips: Number(activeTrips[0]?.count ?? 0),
      logsToday,
      vehicleFitnessAlerts: vehicleAlerts,
      driverLicenseAlerts: driverAlerts,
    };
  }

  private async updateTripStudentStatus(
    tripId: string,
    studentId: string,
    actor: AuthContext,
    status: 'BOARDED' | 'DROPPED' | 'ABSENT',
    notes?: string,
  ) {
    const trip = await this.getTrip(actor.tenantId, tripId);

    if (trip.status !== 'ACTIVE') {
      throw new ConflictException('Student status can be changed only on active trips');
    }

    const existing = await this.getTripStudentStatus(actor.tenantId, trip.id, studentId);
    const now = new Date();

    await this.prisma.$executeRaw`
      UPDATE "TransportTripStudentStatus"
      SET "status" = ${status}::"TransportStudentTripStatus",
          "boardedAt" = CASE WHEN ${status} = 'BOARDED' THEN ${now} ELSE "boardedAt" END,
          "droppedAt" = CASE WHEN ${status} = 'DROPPED' THEN ${now} ELSE "droppedAt" END,
          "markedById" = ${actor.userId},
          "notes" = COALESCE(${notes ?? null}, "notes"),
          "updatedAt" = ${now}
      WHERE "tenantId" = ${actor.tenantId} AND "id" = ${existing.id}
    `;

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
        title: status === 'BOARDED' ? 'Transport boarding update' : 'Transport drop-off update',
        body: status === 'BOARDED' ? 'Your child boarded the school vehicle.' : 'Your child was dropped at the assigned stop.',
        channels: [NotificationChannel.PUSH],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
    }

    return this.getTripStudentStatus(actor.tenantId, trip.id, studentId);
  }

  private async getTripStudentStatus(tenantId: string, tripId: string, studentId: string) {
    const [status] = await this.prisma.$queryRaw<TripStudentRow[]>`
      SELECT * FROM "TransportTripStudentStatus"
      WHERE "tenantId" = ${tenantId} AND "tripId" = ${tripId} AND "studentId" = ${studentId}
      LIMIT 1
    `;

    if (!status) {
      throw new NotFoundException('Student is not assigned to this trip route');
    }

    return status;
  }

  private listTripRows(
    tenantId: string,
    filters: { status?: 'ACTIVE'; routeId?: string; vehicleId?: string },
  ) {
    const statusFilter = filters.status ? Prisma.sql`AND t."status" = ${filters.status}::"TransportTripStatus"` : Prisma.empty;
    const routeFilter = filters.routeId ? Prisma.sql`AND t."routeId" = ${filters.routeId}` : Prisma.empty;
    const vehicleFilter = filters.vehicleId ? Prisma.sql`AND t."vehicleId" = ${filters.vehicleId}` : Prisma.empty;

    return this.prisma.$queryRaw<TransportTripRow[]>`
      SELECT t.*, r."name" AS "routeName", v."registrationNumber"
      FROM "TransportTrip" t
      JOIN "TransportRoute" r ON r."id" = t."routeId" AND r."tenantId" = t."tenantId"
      JOIN "TransportVehicle" v ON v."id" = t."vehicleId" AND v."tenantId" = t."tenantId"
      WHERE t."tenantId" = ${tenantId} ${statusFilter} ${routeFilter} ${vehicleFilter}
      ORDER BY t."startedAt" DESC
      LIMIT 100
    `;
  }

  private async getTrip(tenantId: string, tripId: string) {
    const [trip] = await this.prisma.$queryRaw<TransportTripRow[]>`
      SELECT * FROM "TransportTrip"
      WHERE "tenantId" = ${tenantId} AND "id" = ${tripId}
      LIMIT 1
    `;

    if (!trip) {
      throw new NotFoundException('Trip not found in this tenant');
    }

    return trip;
  }

  private async getDriverAssignment(tenantId: string, assignmentId: string) {
    const [assignment] = await this.prisma.$queryRaw<DriverAssignmentRow[]>`
      SELECT * FROM "TransportDriverAssignment"
      WHERE "tenantId" = ${tenantId} AND "id" = ${assignmentId}
      LIMIT 1
    `;

    if (!assignment) {
      throw new NotFoundException('Driver assignment not found in this tenant');
    }

    return assignment;
  }

  private async findActiveDriverAssignment(tenantId: string, routeId: string, vehicleId: string) {
    const [assignment] = await this.prisma.$queryRaw<DriverAssignmentRow[]>`
      SELECT * FROM "TransportDriverAssignment"
      WHERE "tenantId" = ${tenantId}
        AND "vehicleId" = ${vehicleId}
        AND ("routeId" IS NULL OR "routeId" = ${routeId})
        AND "startsAt" <= ${new Date()}
        AND ("endsAt" IS NULL OR "endsAt" >= ${new Date()})
      ORDER BY "routeId" NULLS LAST, "startsAt" DESC
      LIMIT 1
    `;

    return assignment ?? null;
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

  private async requireStop(tenantId: string, stopId: string, routeId?: string) {
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

    await this.prisma.$executeRaw`
      UPDATE "TransportStop"
      SET "latitude" = COALESCE(${latitude ?? null}, "latitude"),
          "longitude" = COALESCE(${longitude ?? null}, "longitude")
      WHERE "tenantId" = ${tenantId} AND "id" = ${stopId}
    `;
  }

  private latestLocationKey(tenantId: string, tripId: string) {
    return `transport:${tenantId}:trip:${tripId}:latest-location`;
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

import {
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
import { CancelTransportTripDto } from './dto/cancel-transport-trip.dto';
import { TransportService } from './transport.service';

@Injectable()
export class TransportHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly transportService: TransportService,
  ) {}

  async cancelTrip(
    tripId: string,
    dto: CancelTransportTripDto,
    actor: AuthContext,
  ) {
    const trip = await this.prisma.transportTrip.findFirst({
      where: { id: tripId, tenantId: actor.tenantId },
    });

    if (!trip) {
      throw new NotFoundException('Transport trip not found in this tenant');
    }

    if (trip.status !== TransportTripStatus.ACTIVE) {
      throw new ForbiddenException(
        'Only active transport trips can be cancelled',
      );
    }

    const updated = await this.prisma.transportTrip.update({
      where: { id: trip.id },
      data: {
        status: TransportTripStatus.CANCELLED,
        completedAt: new Date(),
        completedById: actor.userId,
        notes: dto.reason,
      },
    });

    await this.redisService
      .getClient()
      .del(`transport:latest-location:${actor.tenantId}:${trip.id}`);

    await this.auditService.record({
      action: 'cancel',
      resource: 'transport_trip',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: trip.id,
      before: { status: trip.status },
      after: { status: updated.status, reason: dto.reason },
    });

    return updated;
  }

  async pauseStudentAssignment(assignmentId: string, actor: AuthContext) {
    return this.transitionStudentAssignment(
      assignmentId,
      TransportEnrollmentStatus.PAUSED,
      actor,
      'pause',
    );
  }

  async endStudentAssignment(assignmentId: string, actor: AuthContext) {
    return this.transitionStudentAssignment(
      assignmentId,
      TransportEnrollmentStatus.ENDED,
      actor,
      'end',
    );
  }

  async getParentStudentActiveTrip(studentId: string, actor: AuthContext) {
    const guardianLink = await this.prisma.studentGuardian.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId,
        guardian: { userId: actor.userId },
      },
      include: {
        student: true,
      },
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
            driverAssignment: {
              include: { staff: { include: { user: true } } },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (!status) {
      throw new NotFoundException(
        'No active transport trip found for this child',
      );
    }

    const latestLocation = await this.transportService
      .getLatestTripLocation(status.tripId, actor)
      .catch(() => null);

    return {
      student: {
        id: guardianLink.student.id,
        name: `${guardianLink.student.firstNameEn} ${guardianLink.student.lastNameEn}`,
      },
      trip: {
        id: status.trip.id,
        direction: status.trip.direction,
        status: status.trip.status,
        startedAt: status.trip.startedAt,
      },
      route: {
        id: status.trip.route.id,
        name: status.trip.route.name,
        code: status.trip.route.code,
      },
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
        id: status.trip.driverAssignment.staff.id,
        name: `${status.trip.driverAssignment.staff.firstName} ${status.trip.driverAssignment.staff.lastName}`,
        phone: status.trip.driverAssignment.staff.user.phone,
      },
      childStatus: {
        status: status.status,
        boardedAt: status.boardedAt,
        droppedAt: status.droppedAt,
      },
      latestLocation,
      eta: {
        strategy: 'STOP_SEQUENCE_FOUNDATION',
        stopSequence: status.stop.sequence,
        message:
          'ETA foundation available; GPS/distance ETA can be added later.',
      },
    };
  }

  async getTripHistoryReport(
    actor: AuthContext,
    filters: {
      routeId?: string;
      vehicleId?: string;
      driverAssignmentId?: string;
    } = {},
  ) {
    const items = await this.prisma.transportTrip.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.routeId ? { routeId: filters.routeId } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverAssignmentId
          ? { driverAssignmentId: filters.driverAssignmentId }
          : {}),
      },
      include: {
        route: true,
        vehicle: true,
        driverAssignment: { include: { staff: { include: { user: true } } } },
        studentStatuses: true,
      },
      orderBy: [{ startedAt: 'desc' }],
      take: 500,
    });

    return { items, meta: { total: items.length } };
  }

  async getBoardingReport(
    actor: AuthContext,
    filters: { tripId?: string; studentId?: string } = {},
  ) {
    const items = await this.prisma.transportTripStudentStatus.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.tripId ? { tripId: filters.tripId } : {}),
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
      },
      include: {
        trip: { include: { route: true, vehicle: true } },
        student: true,
        stop: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
    });

    return { items, meta: { total: items.length } };
  }

  async exportTripHistoryCsv(actor: AuthContext) {
    const report = await this.getTripHistoryReport(actor);
    const rows = [
      [
        'Trip ID',
        'Route',
        'Vehicle',
        'Driver',
        'Direction',
        'Status',
        'Started At',
        'Completed At',
      ],
      ...report.items.map((trip) => [
        trip.id,
        trip.route.name,
        trip.vehicle.registrationNumber,
        `${trip.driverAssignment.staff.firstName} ${trip.driverAssignment.staff.lastName} (${trip.driverAssignment.staff.user.phone ?? 'N/A'})`,
        trip.direction,
        trip.status,
        trip.startedAt.toISOString(),
        trip.completedAt?.toISOString() ?? '',
      ]),
    ];

    await this.auditService.record({
      action: 'export',
      resource: 'transport_trip_history_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: report.items.length },
    });

    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }

  private async transitionStudentAssignment(
    assignmentId: string,
    status: TransportEnrollmentStatus,
    actor: AuthContext,
    action: string,
  ) {
    const assignment = await this.prisma.transportStudentAssignment.findFirst({
      where: { id: assignmentId, tenantId: actor.tenantId },
    });

    if (!assignment) {
      throw new NotFoundException(
        'Transport student assignment not found in this tenant',
      );
    }

    const updated = await this.prisma.transportStudentAssignment.update({
      where: { id: assignment.id },
      data: {
        status,
        endedAt:
          status === TransportEnrollmentStatus.ENDED
            ? new Date()
            : assignment.endedAt,
      },
    });

    await this.auditService.record({
      action,
      resource: 'transport_student_assignment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      before: { status: assignment.status },
      after: { status: updated.status },
    });

    return updated;
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

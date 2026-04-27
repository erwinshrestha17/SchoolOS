import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  FeeFrequency,
  NotificationChannel,
  Prisma,
  TransportBoardingStatus,
  TransportEnrollmentStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssignTransportDriverDto } from './dto/assign-transport-driver.dto';
import { BroadcastRouteDelayDto } from './dto/broadcast-route-delay.dto';
import { CreateTransportRouteDto } from './dto/create-transport-route.dto';
import { CreateTransportVehicleDto } from './dto/create-transport-vehicle.dto';
import { EnrollTransportStudentDto } from './dto/enroll-transport-student.dto';
import { RecordTransportLogDto } from './dto/record-transport-log.dto';

@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  listRoutes(actor: AuthContext) {
    return this.prisma.transportRoute.findMany({
      where: { tenantId: actor.tenantId },
      include: { stops: { orderBy: [{ sequence: 'asc' }] } },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createRoute(dto: CreateTransportRouteDto, actor: AuthContext) {
    const route = await this.prisma.transportRoute.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        code: dto.code,
        vehicleId: dto.vehicleId ?? null,
        isActive: dto.isActive ?? true,
        stops: {
          create: dto.stops.map((stop) => ({
            tenantId: actor.tenantId,
            name: stop.name,
            sequence: stop.sequence,
            estimatedPickup: stop.estimatedPickup ?? null,
            estimatedDrop: stop.estimatedDrop ?? null,
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

  listVehicles(actor: AuthContext) {
    return this.prisma.transportVehicle.findMany({
      where: { tenantId: actor.tenantId },
      include: { assignments: { include: { staff: true } } },
      orderBy: [{ registrationNumber: 'asc' }],
    });
  }

  async createVehicle(dto: CreateTransportVehicleDto, actor: AuthContext) {
    const vehicle = await this.prisma.transportVehicle.create({
      data: {
        tenantId: actor.tenantId,
        registrationNumber: dto.registrationNumber,
        capacity: dto.capacity,
        fitnessCertificateExp: dto.fitnessCertificateExp
          ? new Date(dto.fitnessCertificateExp)
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

  async assignDriver(dto: AssignTransportDriverDto, actor: AuthContext) {
    const [vehicle, staff] = await Promise.all([
      this.prisma.transportVehicle.findFirst({
        where: { id: dto.vehicleId, tenantId: actor.tenantId },
      }),
      this.prisma.staff.findFirst({
        where: { id: dto.staffId, tenantId: actor.tenantId },
      }),
    ]);

    if (!vehicle) {
      throw new NotFoundException('Vehicle not found in this tenant');
    }

    if (!staff) {
      throw new NotFoundException(
        'Driver staff profile not found in this tenant',
      );
    }

    const assignment = await this.prisma.transportDriverAssignment.create({
      data: {
        tenantId: actor.tenantId,
        vehicleId: vehicle.id,
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
      resource: 'transport_driver',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: assignment.id,
      after: { vehicleId: vehicle.id, staffId: staff.id },
    });

    return assignment;
  }

  async listEnrollments(actor: AuthContext, routeId?: string) {
    let allowedRouteIds: string[] | undefined = undefined;

    if (actor.roles.includes('driver') && !actor.roles.includes('super_admin') && !actor.roles.includes('admin')) {
      const staff = await this.prisma.staff.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId },
      });

      if (!staff) {
        throw new ForbiddenException('Driver profile not found.');
      }

      const assignments = await this.prisma.transportDriverAssignment.findMany({
        where: { tenantId: actor.tenantId, staffId: staff.id },
      });

      const vehicleIds = assignments.map(a => a.vehicleId);

      const routes = await this.prisma.transportRoute.findMany({
        where: { tenantId: actor.tenantId, vehicleId: { in: vehicleIds } },
      });

      allowedRouteIds = routes.map(r => r.id);

      if (routeId && !allowedRouteIds.includes(routeId)) {
        throw new ForbiddenException('You are not authorized to view the manifest for this route.');
      }
    }

    return this.prisma.transportEnrollment.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(routeId ? { routeId } : {}),
        ...(allowedRouteIds ? { routeId: { in: allowedRouteIds } } : {}),
      },
      include: { student: true, route: true, stop: true, feeAssignment: true },
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
  }

  async enrollStudent(dto: EnrollTransportStudentDto, actor: AuthContext) {
    const [student, route, stop] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, tenantId: actor.tenantId },
        include: {
          enrollments: { orderBy: [{ createdAt: 'desc' }], take: 1 },
        },
      }),
      this.prisma.transportRoute.findFirst({
        where: { id: dto.routeId, tenantId: actor.tenantId },
      }),
      this.prisma.transportStop.findFirst({
        where: {
          id: dto.stopId,
          tenantId: actor.tenantId,
          routeId: dto.routeId,
        },
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    if (!route || !stop) {
      throw new NotFoundException('Route or stop not found in this tenant');
    }

    const active = await this.prisma.transportEnrollment.findFirst({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: TransportEnrollmentStatus.ACTIVE,
      },
    });

    if (active) {
      throw new ConflictException(
        'Student already has an active transport enrollment',
      );
    }

    const enrollment = await this.prisma.$transaction(async (tx) => {
      const feeAssignmentId =
        dto.feeAmount && dto.feeAmount > 0
          ? await this.ensureTransportFeeAssignment(tx, {
              actor,
              studentId: student.id,
              academicYearId:
                student.enrollments[0]?.academicYearId ??
                (await this.resolveCurrentAcademicYearId(tx, actor.tenantId)),
              amount: new Prisma.Decimal(dto.feeAmount),
            })
          : null;

      return tx.transportEnrollment.create({
        data: {
          tenantId: actor.tenantId,
          studentId: student.id,
          routeId: route.id,
          stopId: stop.id,
          feeAmount: new Prisma.Decimal(dto.feeAmount ?? 0),
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          feeAssignmentId,
        },
        include: {
          student: true,
          route: true,
          stop: true,
          feeAssignment: true,
        },
      });
    });

    await this.auditService.record({
      action: 'enroll',
      resource: 'transport_enrollment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: enrollment.id,
      after: {
        studentId: student.id,
        routeId: route.id,
        stopId: stop.id,
        feeAmount: enrollment.feeAmount,
      },
    });

    return enrollment;
  }

  listLogs(actor: AuthContext, routeId?: string) {
    return this.prisma.transportLog.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(routeId ? { routeId } : {}),
      },
      include: { route: true, stop: true, vehicle: true, student: true },
      orderBy: [{ occurredAt: 'desc' }],
      take: 100,
    });
  }

  async recordLog(dto: RecordTransportLogDto, actor: AuthContext) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: dto.routeId, tenantId: actor.tenantId },
    });

    if (!route) {
      throw new NotFoundException('Route not found in this tenant');
    }

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
        enrollments: {
          where: { status: TransportEnrollmentStatus.ACTIVE },
        },
      },
    });

    if (!route) {
      throw new NotFoundException('Route not found in this tenant');
    }

    const studentIds = route.enrollments.map(
      (enrollment) => enrollment.studentId,
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

    await this.auditService.record({
      action: 'broadcast_delay',
      resource: 'transport_route',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: route.id,
      after: { routeId: route.id, studentCount: studentIds.length },
    });

    return {
      routeId: route.id,
      studentCount: studentIds.length,
      deliveryCount: delivery.count,
    };
  }

  async getReports(actor: AuthContext) {
    const [activeEnrollments, logsToday, vehicleAlerts, driverAlerts] =
      await Promise.all([
        this.prisma.transportEnrollment.count({
          where: {
            tenantId: actor.tenantId,
            status: TransportEnrollmentStatus.ACTIVE,
          },
        }),
        this.prisma.transportLog.count({
          where: {
            tenantId: actor.tenantId,
            occurredAt: { gte: startOfToday() },
          },
        }),
        this.prisma.transportVehicle.findMany({
          where: {
            tenantId: actor.tenantId,
            fitnessCertificateExp: {
              lte: addDays(new Date(), 30),
              gte: new Date(),
            },
          },
        }),
        this.prisma.transportDriverAssignment.findMany({
          where: {
            tenantId: actor.tenantId,
            licenseExpires: {
              lte: addDays(new Date(), 30),
              gte: new Date(),
            },
          },
          include: { staff: true, vehicle: true },
        }),
      ]);

    return {
      activeEnrollments,
      logsToday,
      vehicleFitnessAlerts: vehicleAlerts,
      driverLicenseAlerts: driverAlerts,
    };
  }

  private async ensureTransportFeeAssignment(
    tx: Prisma.TransactionClient,
    input: {
      actor: AuthContext;
      studentId: string;
      academicYearId: string;
      amount: Prisma.Decimal;
    },
  ) {
    const feeHead = await tx.feeHead.upsert({
      where: {
        tenantId_code: { tenantId: input.actor.tenantId, code: 'TRANSPORT' },
      },
      update: {},
      create: {
        tenantId: input.actor.tenantId,
        code: 'TRANSPORT',
        name: 'Transport Fee',
        frequency: FeeFrequency.MONTHLY,
        defaultAmount: input.amount,
        vatApplicable: true,
      },
    });
    const feePlan = await tx.feePlan.upsert({
      where: {
        tenantId_code: {
          tenantId: input.actor.tenantId,
          code: 'TRANSPORT-MONTHLY',
        },
      },
      update: {},
      create: {
        tenantId: input.actor.tenantId,
        academicYearId: input.academicYearId,
        code: 'TRANSPORT-MONTHLY',
        name: 'Monthly transport plan',
        items: {
          create: {
            tenantId: input.actor.tenantId,
            feeHeadId: feeHead.id,
            amount: input.amount,
          },
        },
      },
    });
    const assignment = await tx.studentFeeAssignment.upsert({
      where: {
        studentId_feePlanId_academicYearId: {
          studentId: input.studentId,
          feePlanId: feePlan.id,
          academicYearId: input.academicYearId,
        },
      },
      update: { isActive: true },
      create: {
        tenantId: input.actor.tenantId,
        studentId: input.studentId,
        feePlanId: feePlan.id,
        academicYearId: input.academicYearId,
      },
    });

    return assignment.id;
  }

  private async resolveCurrentAcademicYearId(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    const academicYear = await tx.academicYear.findFirst({
      where: { tenantId, isCurrent: true },
    });

    if (!academicYear) {
      throw new NotFoundException(
        'Current academic year is required for transport fee assignment',
      );
    }

    return academicYear.id;
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

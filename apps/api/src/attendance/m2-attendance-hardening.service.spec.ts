import {
  AttendanceConflictStatus,
  AttendanceStatus,
  AuthMethod,
  EnrollmentStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { M2AttendanceHardeningService } from './m2-attendance-hardening.service';

const actor: AuthContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'admin-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['attendance:read', 'attendance:manage_all'],
};

describe('M2AttendanceHardeningService', () => {
  it('labels Nepal calendar dates without UTC day drift and treats only Saturday as the default weekend', async () => {
    const prisma = buildPrisma();
    prisma.schoolCalendarDay.findMany.mockResolvedValue([]);
    const { service } = buildService(prisma);

    const result = await service.getCalendarPolicy(
      { fromDate: '2026-07-11', toDate: '2026-07-12' },
      actor,
    );

    expect(result.items).toEqual([
      expect.objectContaining({
        date: '2026-07-11',
        isWorkingDay: false,
        holidayType: 'WEEKEND',
      }),
      expect.objectContaining({
        date: '2026-07-12',
        isWorkingDay: true,
        holidayType: null,
      }),
    ]);
  });

  it('calculates hardened anomalies with tenant-scoped roster, calendar, exam-day, and absence checks', async () => {
    const prisma = buildPrisma();
    const { service, auditService } = buildService(prisma);

    const result = await service.getHardeningAnomalies(
      {
        fromDate: '2026-04-14',
        toDate: '2026-04-14',
        classId: 'class-1',
        sectionId: 'section-1',
      },
      actor,
    );

    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        attendanceDate: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
        classId: 'class-1',
        sectionId: 'section-1',
      },
      include: { records: true, class: true, section: true },
      orderBy: [{ attendanceDate: 'desc' }],
      take: 250,
    });
    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        status: EnrollmentStatus.ACTIVE,
      },
    });
    expect(prisma.schoolCalendarDay.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        calendarDate: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      },
    });

    expect(result.total).toBe(5);
    expect(result.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NOT_MARKED_SESSION',
          severity: 'HIGH',
        }),
        expect.objectContaining({
          code: 'MISSING_ROSTER_RECORDS',
          expectedRosterCount: 4,
          actualRecordCount: 0,
        }),
        expect.objectContaining({
          code: 'NON_WORKING_DAY_MARKED',
          calendarLabel: 'Terminal exam',
          holidayType: 'EXAM_DAY',
        }),
        expect.objectContaining({
          code: 'EXAM_DAY_HOLIDAY_STATUS',
          affectedRecordCount: 1,
        }),
        expect.objectContaining({
          code: 'HIGH_ABSENCE_RATE',
          totals: expect.objectContaining({ absent: 2.5, halfDay: 1 }),
        }),
      ]),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'm2_anomaly_hardening_review',
        resource: 'attendance_session',
        tenantId: actor.tenantId,
        after: expect.objectContaining({ anomalyCount: 5 }),
      }),
    );
  });

  it('creates locked not-marked sessions during cutoff automation for missing active roster scopes', async () => {
    const prisma = buildPrisma();
    prisma.academicYear.findFirst.mockResolvedValue({
      id: 'year-1',
      tenantId: actor.tenantId,
      isCurrent: true,
    });
    prisma.schoolCalendarDay.findMany.mockResolvedValue([]);
    prisma.enrollment.findMany.mockResolvedValue([
      {
        id: 'enrollment-1',
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { name: 'Class 1' },
        section: { name: 'A' },
      },
      {
        id: 'enrollment-2',
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        class: { name: 'Class 1' },
        section: { name: 'A' },
      },
    ]);
    prisma.attendanceSession.findFirst.mockResolvedValue(null);

    const { service, auditService } = buildService(prisma);

    const result = await service.runAttendanceCutoff(
      {
        attendanceDate: '2026-04-15',
        dryRun: false,
      },
      actor,
    );
    const attendanceDate = result.attendanceDate;
    const cutoffAt = result.cutoffAt;

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        status: EnrollmentStatus.ACTIVE,
      },
      include: { class: true, section: true },
      take: 3000,
    });
    expect(prisma.attendanceSession.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        attendanceDate,
        classId: 'class-1',
        sectionId: 'section-1',
      },
    });
    expect(prisma.attendanceSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate,
        lockAt: cutoffAt,
        conflictStatus: AttendanceConflictStatus.FLAGGED,
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({
        dryRun: false,
        created: 1,
        missingScopes: [
          expect.objectContaining({
            classId: 'class-1',
            sectionId: 'section-1',
            rosterCount: 2,
            virtualStatus: 'NOT_MARKED',
            action: 'created_locked_unmarked_session',
          }),
        ],
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'm2_cutoff_run',
        resource: 'attendance_session',
        tenantId: actor.tenantId,
        after: expect.objectContaining({
          missingScopeCount: 1,
          created: 1,
        }),
      }),
    );
  });

  it('suppresses duplicate repeated absence follow-up notifications on retry', async () => {
    const prisma = buildPrisma();
    prisma.notificationDelivery.findFirst.mockResolvedValue({
      id: 'delivery-existing',
    });
    const { service, communicationsService, auditService } =
      buildService(prisma);
    jest.spyOn(service, 'getFollowUpQueue').mockResolvedValue({
      fromDate: new Date('2026-04-01T00:00:00.000Z'),
      toDate: new Date('2026-04-30T00:00:00.000Z'),
      threshold: 3,
      total: 1,
      items: [
        {
          studentId: 'student-1',
          studentSystemId: 'SCH-2026-0001',
          fullNameEn: 'Asha Tamang',
          className: 'Class 1',
          sectionName: 'A',
          guardianCount: 1,
          absences: 4,
          lates: 0,
          consecutiveAbsences: 4,
          threshold: 3,
          needsFollowUp: true,
          recommendedChannels: [],
        },
      ],
    });

    const result = await service.runFollowUpAutomation(
      {
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        dryRun: false,
      },
      actor,
    );

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        sourceType: 'attendance_repeated_absence_follow_up',
        sourceId: expect.stringMatching(/^\d{4}-\d{2}-\d{2}:student-1:4:4$/),
      },
    });
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
    expect(result.deliveryCount).toBe(0);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'm2_follow_up_dispatch',
        after: expect.objectContaining({
          queueCount: 1,
          deliveryCount: 0,
          dryRun: false,
        }),
      }),
    );
  });
});

function buildService(prisma = buildPrisma()) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const communicationsService = {
    recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 0 }),
  };
  const service = new M2AttendanceHardeningService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    communicationsService as unknown as CommunicationsService,
  );

  return { service, auditService, communicationsService };
}

function buildPrisma() {
  const attendanceDate = new Date('2026-04-14T00:00:00.000Z');
  return {
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
    },
    attendanceSession: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'session-empty',
          tenantId: actor.tenantId,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate,
          class: { name: 'Class 1' },
          section: { name: 'A' },
          records: [],
        },
        {
          id: 'session-exam',
          tenantId: actor.tenantId,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate,
          class: { name: 'Class 1' },
          section: { name: 'A' },
          records: [
            { status: AttendanceStatus.ABSENT },
            { status: AttendanceStatus.ABSENT },
            { status: AttendanceStatus.HOLIDAY },
            { status: AttendanceStatus.PRESENT },
          ],
        },
      ]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'session-cutoff-created',
        tenantId: actor.tenantId,
      }),
    },
    enrollment: {
      count: jest.fn().mockResolvedValue(4),
      findMany: jest.fn().mockResolvedValue([]),
    },
    academicYear: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    schoolCalendarDay: {
      findMany: jest.fn().mockResolvedValue([
        {
          tenantId: actor.tenantId,
          calendarDate: attendanceDate,
          isWorkingDay: false,
          holidayType: 'EXAM_DAY',
          label: 'Terminal exam',
        },
      ]),
    },
    notificationDelivery: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

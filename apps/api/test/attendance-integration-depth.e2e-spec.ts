import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceConflictStatus,
  AttendanceStatus,
  EnrollmentStatus,
} from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { AuthContext } from '../src/auth/auth.types';
import { CommunicationsService } from '../src/communications/communications.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SettingsService } from '../src/settings/settings.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { createAuthContextMock } from './test-helpers';

type AttendanceStudent = {
  id: string;
  tenantId: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  rollNumber: string;
  classId: string;
  sectionId: string | null;
  enrollments: Array<{
    tenantId: string;
    academicYearId: string;
    classId: string;
    sectionId: string | null;
    status: EnrollmentStatus;
  }>;
};

type AttendanceRecord = {
  id: string;
  tenantId: string;
  attendanceSessionId: string;
  studentId: string;
  status: AttendanceStatus;
  remark: string | null;
  lateAt: Date | null;
};

type AttendanceSession = {
  id: string;
  tenantId: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  attendanceDate: Date;
  submittedById: string;
  submittedAt: Date | null;
  lockAt: Date;
  conflictStatus: AttendanceConflictStatus;
  records: AttendanceRecord[];
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
  submittedBy?: { email: string } | null;
};

type AttendanceState = {
  students: AttendanceStudent[];
  staff: Array<{ id: string; tenantId: string; userId: string }>;
  subjectTeacherAssignments: Array<{
    id: string;
    tenantId: string;
    staffId: string;
    classId: string;
    sectionId: string | null;
  }>;
  sections: Array<{
    id: string;
    tenantId: string;
    classId: string;
    name: string;
    classTeacherId?: string;
  }>;
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
  conflicts: Record<string, unknown>[];
  syncSubmissions: Record<string, unknown>[];
  calendarDays: Array<{
    id: string;
    tenantId: string;
    calendarDate: Date;
    isWorkingDay: boolean;
    label?: string;
  }>;
  guardians: Array<{
    id: string;
    tenantId: string;
    userId: string;
    studentLinks: Array<{ studentId: string }>;
  }>;
  auditLogs: Record<string, unknown>[];
};

type AttendancePrismaMock = ReturnType<typeof buildPrismaMock>;

describe('Attendance Reliability + Reports Integration Depth (E2E)', () => {
  const tenantId = 'tenant-attendance-depth';
  const otherTenantId = 'tenant-attendance-other';
  const academicYearId = 'year-2081';
  const classId = 'class-1';
  const sectionId = 'section-1';

  const adminActor = createActor({
    tenantId,
    userId: 'admin-user',
    roles: ['admin'],
    permissions: [
      'attendance:read',
      'attendance:read_all',
      'attendance:mark',
      'attendance:review_conflicts',
    ],
  });
  const assignedTeacherActor = createActor({
    tenantId,
    userId: 'teacher-user',
    roles: ['teacher'],
    permissions: ['attendance:read', 'attendance:mark'],
  });
  const unrelatedTeacherActor = createActor({
    tenantId,
    userId: 'unrelated-teacher-user',
    roles: ['teacher'],
    permissions: ['attendance:read', 'attendance:mark'],
  });
  const parentActor = createActor({
    tenantId,
    userId: 'guardian-user-1',
    roles: ['parent'],
    permissions: ['attendance:read'],
  });

  let prisma: AttendancePrismaMock;
  let auditService: { record: jest.Mock };
  let eventEmitter: { emit: jest.Mock };
  let attendanceService: AttendanceService;

  beforeEach(() => {
    prisma = buildPrismaMock({
      tenantId,
      otherTenantId,
      academicYearId,
      classId,
      sectionId,
    });
    auditService = {
      record: jest.fn(async (entry: Record<string, unknown>) => {
        prisma.__state.auditLogs.push({
          id: `audit-${prisma.__state.auditLogs.length + 1}`,
          ...entry,
          createdAt: new Date(),
        });
      }),
    };
    eventEmitter = { emit: jest.fn() };

    attendanceService = new AttendanceService(
      prisma as unknown as PrismaService,
      { recordDeliveryRecords: jest.fn() } as unknown as CommunicationsService,
      auditService as unknown as AuditService,
      eventEmitter as unknown as EventEmitter2,
      {
        getSetting: jest.fn().mockResolvedValue(true),
      } as unknown as SettingsService,
    );
  });

  it('allows assigned teachers to submit attendance, excludes inactive roster rows, emits absence events, and rejects unrelated teachers', async () => {
    const result = await attendanceService.submitAttendance(
      {
        academicYearId,
        classId,
        sectionId,
        attendanceDate: '2026-05-10',
        exceptions: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
            remark: 'Absent without notice',
          },
        ],
      },
      assignedTeacherActor,
    );

    expect(result).toEqual(
      expect.objectContaining({
        className: 'Class 1',
        sectionName: 'A',
        totals: expect.objectContaining({
          total: 2,
          absent: 1,
          present: 1,
        }),
      }),
    );
    expect(prisma.__state.records.map((record) => record.studentId)).toEqual([
      'student-1',
      'student-2',
    ]);
    expect(prisma.__state.records).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ studentId: 'student-inactive' }),
      ]),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'attendance.student.absent',
      expect.objectContaining({
        tenantId,
        studentId: 'student-1',
        status: AttendanceStatus.ABSENT,
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'submit',
        resource: 'attendance_session',
        tenantId,
        userId: assignedTeacherActor.userId,
      }),
    );

    await expect(
      attendanceService.submitAttendance(
        {
          academicYearId,
          classId,
          sectionId,
          attendanceDate: '2026-05-11',
          exceptions: [],
        },
        unrelatedTeacherActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('tracks resubmission as a conflict instead of creating a duplicate session and replays offline sync idempotently', async () => {
    await attendanceService.submitAttendance(
      {
        academicYearId,
        classId,
        sectionId,
        attendanceDate: '2026-05-10',
        exceptions: [
          { studentId: 'student-1', status: AttendanceStatus.ABSENT },
        ],
      },
      assignedTeacherActor,
    );

    const second = await attendanceService.submitAttendance(
      {
        academicYearId,
        classId,
        sectionId,
        attendanceDate: '2026-05-10',
        exceptions: [{ studentId: 'student-1', status: AttendanceStatus.LATE }],
      },
      assignedTeacherActor,
    );

    expect(second.conflictStatus).toBe(AttendanceConflictStatus.FLAGGED);
    expect(prisma.__state.sessions).toHaveLength(1);
    expect(prisma.__state.conflicts).toHaveLength(1);
    expect(prisma.__state.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: 'student-1',
          status: AttendanceStatus.LATE,
        }),
      ]),
    );

    const sync = await attendanceService.syncAttendance(
      {
        clientSubmissionId: 'client-sync-1',
        academicYearId,
        classId,
        sectionId,
        attendanceDate: '2026-05-12',
        deviceTimestamp: new Date().toISOString(),
        deviceId: 'teacher-phone-1',
        exceptions: [
          { studentId: 'student-2', status: AttendanceStatus.ABSENT },
        ],
      },
      assignedTeacherActor,
    );
    const replay = await attendanceService.syncAttendance(
      {
        clientSubmissionId: 'client-sync-1',
        academicYearId,
        classId,
        sectionId,
        attendanceDate: '2026-05-12',
        deviceTimestamp: new Date().toISOString(),
        deviceId: 'teacher-phone-1',
        exceptions: [
          { studentId: 'student-2', status: AttendanceStatus.ABSENT },
        ],
      },
      assignedTeacherActor,
    );

    expect(sync.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(prisma.__state.syncSubmissions).toHaveLength(1);
    expect(prisma.__state.syncSubmissions[0]).toEqual(
      expect.objectContaining({ syncAttemptCount: 2 }),
    );
  });

  it('generates tenant-scoped monthly register and CSV export from backend attendance records', async () => {
    seedSession(prisma.__state, {
      id: 'session-2026-05-01',
      attendanceDate: new Date('2026-05-01T00:00:00.000Z'),
      records: [
        { studentId: 'student-1', status: AttendanceStatus.PRESENT },
        { studentId: 'student-2', status: AttendanceStatus.ABSENT },
      ],
    });
    seedSession(prisma.__state, {
      id: 'session-2026-05-02',
      attendanceDate: new Date('2026-05-02T00:00:00.000Z'),
      records: [
        { studentId: 'student-1', status: AttendanceStatus.LATE },
        { studentId: 'student-2', status: AttendanceStatus.PRESENT },
      ],
    });
    prisma.__state.calendarDays.push({
      id: 'holiday-1',
      tenantId,
      calendarDate: new Date('2026-05-03T00:00:00.000Z'),
      isWorkingDay: false,
      label: 'School holiday',
    });

    const register = await attendanceService.getMonthlyRegister(
      { academicYearId, classId, sectionId, month: 5, year: 2026 },
      adminActor,
    );

    expect(register.matrix).toHaveLength(2);
    expect(register.matrix[0]).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        totals: expect.objectContaining({ PRESENT: 1, LATE: 1, HOLIDAY: 1 }),
      }),
    );
    expect(register.matrix[1]).toEqual(
      expect.objectContaining({
        studentId: 'student-2',
        totals: expect.objectContaining({ PRESENT: 1, ABSENT: 1, HOLIDAY: 1 }),
      }),
    );

    const csv = await attendanceService.exportMonthlyRegister(
      { academicYearId, classId, sectionId, month: 5, year: 2026 },
      adminActor,
    );

    expect(csv).toContain('student-1');
    expect(csv).toContain('student-2');
    expect(csv).toContain('PRESENT');
    expect(csv).toContain('ABSENT');
  });

  it('enforces parent own-child scope for student attendance history and parent summary', async () => {
    seedSession(prisma.__state, {
      id: 'session-parent-1',
      attendanceDate: new Date('2026-05-01T00:00:00.000Z'),
      submittedById: 'teacher-user',
      records: [
        { studentId: 'student-1', status: AttendanceStatus.ABSENT },
        { studentId: 'student-2', status: AttendanceStatus.PRESENT },
      ],
    });

    const history = await attendanceService.getStudentHistory(
      'student-1',
      { startDate: '2026-05-01', endDate: '2026-05-31' },
      parentActor,
    );

    expect(history).toEqual([
      expect.objectContaining({
        status: AttendanceStatus.ABSENT,
        sessionId: 'session-parent-1',
      }),
    ]);

    await expect(
      attendanceService.getStudentHistory(
        'student-2',
        { startDate: '2026-05-01', endDate: '2026-05-31' },
        parentActor,
      ),
    ).rejects.toThrow(ForbiddenException);

    const summary = await attendanceService.getParentSummary(
      'student-1',
      parentActor,
    );
    expect(summary).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        totals: expect.objectContaining({ absent: 1, present: 0 }),
      }),
    );

    await expect(
      attendanceService.getParentSummary('student-2', parentActor),
    ).rejects.toThrow(ForbiddenException);
  });
});

function createActor(overrides: Partial<AuthContext>) {
  return createAuthContextMock({
    tenantSlug: 'attendance-depth',
    email: `${overrides.userId ?? 'user'}@schoolos.test`,
    ...overrides,
  });
}

function buildPrismaMock(input: {
  tenantId: string;
  otherTenantId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
}) {
  const state: AttendanceState = {
    students: [
      createStudent(input, 'student-1', 'Aarav', 'Shrestha', '1', true),
      createStudent(input, 'student-2', 'Sita', 'Thapa', '2', true),
      createStudent(
        input,
        'student-inactive',
        'Inactive',
        'Student',
        '3',
        false,
      ),
    ],
    staff: [
      {
        id: 'staff-teacher-1',
        tenantId: input.tenantId,
        userId: 'teacher-user',
      },
      {
        id: 'staff-teacher-2',
        tenantId: input.tenantId,
        userId: 'unrelated-teacher-user',
      },
    ],
    subjectTeacherAssignments: [
      {
        id: 'assignment-1',
        tenantId: input.tenantId,
        staffId: 'staff-teacher-1',
        classId: input.classId,
        sectionId: input.sectionId,
      },
    ],
    sections: [
      {
        id: input.sectionId,
        tenantId: input.tenantId,
        classId: input.classId,
        name: 'A',
      },
    ],
    sessions: [],
    records: [],
    conflicts: [],
    syncSubmissions: [],
    calendarDays: [],
    guardians: [
      {
        id: 'guardian-1',
        tenantId: input.tenantId,
        userId: 'guardian-user-1',
        studentLinks: [{ studentId: 'student-1' }],
      },
    ],
    auditLogs: [],
  };

  const prisma = {
    __state: state,
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(prisma),
    ),
    staff: {
      findUnique: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.staff.find((staff) => staff.userId === q.where?.userId) ?? null,
      ),
    },
    subjectTeacherAssignment: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) =>
        state.subjectTeacherAssignments.filter(
          (assignment) =>
            assignment.tenantId === q.where?.tenantId &&
            assignment.staffId === q.where?.staffId,
        ),
      ),
    },
    section: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) =>
        state.sections.filter(
          (section) =>
            section.tenantId === q.where?.tenantId &&
            (!q.where?.classTeacherId ||
              section.classTeacherId === q.where.classTeacherId),
        ),
      ),
    },
    student: {
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        const idIn = (where.id as { in?: string[] } | undefined)?.in;
        const requiresActiveEnrollment = Boolean(where.enrollments);
        return state.students.filter(
          (student) =>
            student.tenantId === where.tenantId &&
            (!where.classId || student.classId === where.classId) &&
            (!where.sectionId || student.sectionId === where.sectionId) &&
            (!idIn || idIn.includes(student.id)) &&
            (!requiresActiveEnrollment ||
              student.enrollments.some(
                (enrollment) =>
                  enrollment.tenantId === student.tenantId &&
                  enrollment.academicYearId === input.academicYearId &&
                  enrollment.classId === input.classId &&
                  enrollment.sectionId === input.sectionId &&
                  enrollment.status === EnrollmentStatus.ACTIVE,
              )),
        );
      }),
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.students.find(
            (student) =>
              student.tenantId === q.where?.tenantId &&
              (student.id === q.where?.id ||
                student.id === q.where?.studentId ||
                student.id === q.where?.userId),
          ) ?? null,
      ),
    },
    guardian: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.guardians.find(
            (guardian) =>
              guardian.tenantId === q.where?.tenantId &&
              guardian.userId === q.where?.userId,
          ) ?? null,
      ),
    },
    schoolCalendarDay: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          findCalendarDay(state, q.where) ?? null,
      ),
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) =>
        state.calendarDays.filter((day) => day.tenantId === q.where?.tenantId),
      ),
    },
    attendanceSession: {
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          findSession(state, q.where) ?? null,
      ),
      create: jest.fn(async (q: { data: Record<string, unknown> }) => {
        const session = createSession(input, q.data);
        state.sessions.push(session);
        return session;
      }),
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          const session = state.sessions.find((item) => item.id === q.where.id);
          if (!session) {
            throw new Error('Attendance session not found');
          }
          Object.assign(session, q.data);
          return session;
        },
      ),
      findUniqueOrThrow: jest.fn(async (q: { where: { id: string } }) => {
        const session = state.sessions.find((item) => item.id === q.where.id);
        if (!session) {
          throw new Error('Attendance session not found');
        }
        return hydrateSession(state, session);
      }),
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        return state.sessions
          .filter(
            (session) =>
              session.tenantId === where.tenantId &&
              (!where.classId || session.classId === where.classId) &&
              (!where.sectionId || session.sectionId === where.sectionId) &&
              inDateRange(session.attendanceDate, where.attendanceDate),
          )
          .map((session) => hydrateSession(state, session));
      }),
    },
    attendanceRecord: {
      deleteMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const before = state.records.length;
        state.records = state.records.filter(
          (record) =>
            record.attendanceSessionId !== q.where?.attendanceSessionId,
        );
        const session = state.sessions.find(
          (item) => item.id === q.where?.attendanceSessionId,
        );
        if (session) {
          session.records = [];
        }
        return { count: before - state.records.length };
      }),
      createMany: jest.fn(async (q: { data: Record<string, unknown>[] }) => {
        const created = q.data.map((item, index) => ({
          id: `record-${state.records.length + index + 1}`,
          remark: null,
          lateAt: null,
          ...item,
        })) as AttendanceRecord[];
        state.records.push(...created);
        for (const session of state.sessions) {
          session.records = state.records.filter(
            (record) => record.attendanceSessionId === session.id,
          );
        }
        return { count: created.length };
      }),
      findMany: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const where = q.where ?? {};
        const dateFilter = (
          where.attendanceSession as { attendanceDate?: unknown } | undefined
        )?.attendanceDate;
        return state.records
          .filter(
            (record) =>
              record.tenantId === where.tenantId &&
              record.studentId === where.studentId,
          )
          .filter((record) => {
            const session = state.sessions.find(
              (item) => item.id === record.attendanceSessionId,
            );
            return session
              ? inDateRange(session.attendanceDate, dateFilter)
              : false;
          })
          .map((record) => ({
            ...record,
            attendanceSession: {
              ...state.sessions.find(
                (item) => item.id === record.attendanceSessionId,
              ),
              submittedBy: { email: 'teacher@schoolos.test' },
            },
          }));
      }),
    },
    attendanceConflict: {
      create: jest.fn(async (q: { data: Record<string, unknown> }) => {
        const conflict = {
          id: `conflict-${state.conflicts.length + 1}`,
          status: AttendanceConflictStatus.FLAGGED,
          createdAt: new Date(),
          ...q.data,
        };
        state.conflicts.push(conflict);
        return conflict;
      }),
      findFirst: jest.fn(
        async (q: { where?: Record<string, unknown> }) =>
          state.conflicts.find(
            (conflict) =>
              conflict.tenantId === q.where?.tenantId &&
              conflict.attendanceSessionId === q.where?.attendanceSessionId,
          ) ?? null,
      ),
    },
    attendanceSyncSubmission: {
      findUnique: jest.fn(async (q: { where?: Record<string, unknown> }) => {
        const key = q.where?.tenantId_clientSubmissionId as
          | { tenantId?: string; clientSubmissionId?: string }
          | undefined;
        return (
          state.syncSubmissions.find(
            (submission) =>
              submission.tenantId === key?.tenantId &&
              submission.clientSubmissionId === key?.clientSubmissionId,
          ) ?? null
        );
      }),
      update: jest.fn(
        async (q: { where: { id: string }; data: Record<string, unknown> }) => {
          const sync = state.syncSubmissions.find(
            (item) => item.id === q.where.id,
          );
          if (!sync) {
            throw new Error('Sync submission not found');
          }
          sync.syncAttemptCount = Number(sync.syncAttemptCount ?? 0) + 1;
          return sync;
        },
      ),
      create: jest.fn(async (q: { data: Record<string, unknown> }) => {
        const sync = {
          id: `sync-${state.syncSubmissions.length + 1}`,
          syncAttemptCount: 1,
          ...q.data,
        };
        state.syncSubmissions.push(sync);
        return sync;
      }),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
  };

  return prisma;
}

function createStudent(
  input: {
    tenantId: string;
    academicYearId: string;
    classId: string;
    sectionId: string;
  },
  id: string,
  firstNameEn: string,
  lastNameEn: string,
  rollNumber: string,
  activeEnrollment: boolean,
): AttendanceStudent {
  return {
    id,
    tenantId: input.tenantId,
    studentSystemId: id.toUpperCase(),
    firstNameEn,
    lastNameEn,
    rollNumber,
    classId: input.classId,
    sectionId: input.sectionId,
    enrollments: activeEnrollment
      ? [
          {
            tenantId: input.tenantId,
            academicYearId: input.academicYearId,
            classId: input.classId,
            sectionId: input.sectionId,
            status: EnrollmentStatus.ACTIVE,
          },
        ]
      : [
          {
            tenantId: input.tenantId,
            academicYearId: input.academicYearId,
            classId: input.classId,
            sectionId: input.sectionId,
            status: EnrollmentStatus.INACTIVE,
          },
        ],
  };
}

function createSession(
  input: { tenantId: string; classId: string; sectionId: string },
  data: Record<string, unknown>,
): AttendanceSession {
  return {
    id: `session-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId,
    academicYearId: data.academicYearId as string,
    classId: data.classId as string,
    sectionId: (data.sectionId as string | null) ?? null,
    attendanceDate: data.attendanceDate as Date,
    submittedById: data.submittedById as string,
    submittedAt: data.submittedAt as Date,
    lockAt: data.lockAt as Date,
    conflictStatus: data.conflictStatus as AttendanceConflictStatus,
    records: [],
    class: { id: input.classId, name: 'Class 1' },
    section: { id: input.sectionId, name: 'A' },
    submittedBy: { email: 'teacher@schoolos.test' },
  };
}

function seedSession(
  state: AttendanceState,
  input: {
    id: string;
    attendanceDate: Date;
    submittedById?: string;
    records: Array<{ studentId: string; status: AttendanceStatus }>;
  },
) {
  const session: AttendanceSession = {
    id: input.id,
    tenantId: 'tenant-attendance-depth',
    academicYearId: 'year-2081',
    classId: 'class-1',
    sectionId: 'section-1',
    attendanceDate: input.attendanceDate,
    submittedById: input.submittedById ?? 'admin-user',
    submittedAt: new Date(),
    lockAt: new Date('2099-01-01T00:00:00.000Z'),
    conflictStatus: AttendanceConflictStatus.NONE,
    records: [],
    class: { id: 'class-1', name: 'Class 1' },
    section: { id: 'section-1', name: 'A' },
    submittedBy: { email: 'teacher@schoolos.test' },
  };
  const records = input.records.map((record, index) => ({
    id: `${input.id}-record-${index + 1}`,
    tenantId: session.tenantId,
    attendanceSessionId: session.id,
    studentId: record.studentId,
    status: record.status,
    remark: null,
    lateAt: null,
  }));
  session.records = records;
  state.sessions.push(session);
  state.records.push(...records);
  return session;
}

function hydrateSession(state: AttendanceState, session: AttendanceSession) {
  return {
    ...session,
    records: state.records.filter(
      (record) => record.attendanceSessionId === session.id,
    ),
    class: { id: session.classId, name: 'Class 1' },
    section: session.sectionId ? { id: session.sectionId, name: 'A' } : null,
  };
}

function findSession(state: AttendanceState, where?: Record<string, unknown>) {
  return state.sessions
    .filter((session) => session.tenantId === where?.tenantId)
    .find(
      (session) =>
        (!where?.id || session.id === where.id) &&
        (!where?.classId || session.classId === where.classId) &&
        (!where?.sectionId || session.sectionId === where.sectionId) &&
        (!where?.attendanceDate ||
          sameDate(session.attendanceDate, where.attendanceDate as Date)),
    );
}

function findCalendarDay(
  state: AttendanceState,
  where?: Record<string, unknown>,
) {
  return state.calendarDays.find(
    (day) =>
      day.tenantId === where?.tenantId &&
      sameDate(day.calendarDate, where?.calendarDate as Date),
  );
}

function inDateRange(date: Date, range: unknown) {
  if (!range || typeof range !== 'object') {
    return true;
  }
  const filters = range as { gte?: Date; lte?: Date };
  return (
    (!filters.gte || date >= filters.gte) &&
    (!filters.lte || date <= filters.lte)
  );
}

function sameDate(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

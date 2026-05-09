import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceConflictDecision,
  AttendanceConflictStatus,
  AttendanceSyncRejectionReason,
  AttendanceSyncStatus,
  AttendanceStatus,
  AuthMethod,
  EnrollmentStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { AttendanceConflictReviewDecision } from './dto/review-attendance-conflict.dto';

const adminActor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: [
    'attendance:mark',
    'attendance:read',
    'attendance:review_conflicts',
  ],
};

const teacherActor = {
  ...adminActor,
  roles: ['teacher'],
};

describe('attendance production hardening', () => {
  it('loads roster from active tenant enrollment scope and defaults students present', async () => {
    const student = buildStudent({
      rollNumber: 3,
      guardianLinks: [],
      severeAllergies: null,
      medicalConditions: null,
      specialNeeds: null,
    });
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [student],
    });

    const roster = await service.getRoster(
      adminActor,
      'ay-1',
      'class-1',
      'section-1',
      '2026-04-28',
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
        classId: 'class-1',
        sectionId: 'section-1',
        enrollments: {
          some: {
            tenantId: adminActor.tenantId,
            academicYearId: 'ay-1',
            classId: 'class-1',
            sectionId: 'section-1',
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
      include: {
        guardianLinks: {
          include: {
            guardian: true,
          },
        },
      },
      orderBy: [{ rollNumber: 'asc' }, { firstNameEn: 'asc' }],
    });
    expect(roster.students[0]).toEqual(
      expect.objectContaining({
        id: 'student-1',
        status: AttendanceStatus.PRESENT,
      }),
    );
  });

  it('rejects section and class mismatches before attendance writes', async () => {
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'other-class' },
    });

    await expect(
      service.submitAttendance(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-04-28',
          exceptions: [],
        },
        adminActor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects exception students outside the selected tenant roster', async () => {
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [buildStudent({ id: 'student-1' })],
    });

    await expect(
      service.submitAttendance(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-04-28',
          exceptions: [
            {
              studentId: 'student-other',
              status: AttendanceStatus.ABSENT,
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('emits attendance domain events for M10 notification workflows', async () => {
    const finalSession = buildAttendanceSession({
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          remark: null,
          lateAt: null,
        },
      ],
    });
    const { service, eventEmitter } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [buildStudent({ id: 'student-1' })],
      finalSession,
    });

    await service.submitAttendance(
      {
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: '2026-04-28',
        exceptions: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
          },
        ],
      },
      adminActor,
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'attendance.student.absent',
      expect.objectContaining({
        tenantId: adminActor.tenantId,
        studentId: 'student-1',
        status: AttendanceStatus.ABSENT,
      }),
    );
  });

  it('returns class daily and student monthly attendance summary', async () => {
    const dailySession = buildAttendanceSession({
      records: [
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.LATE },
      ],
    });
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      studentFindFirst: buildStudent({ id: 'student-1' }),
      attendanceSession: dailySession,
      attendanceRecords: [
        { status: AttendanceStatus.PRESENT },
        { status: AttendanceStatus.ABSENT },
        { status: AttendanceStatus.LATE },
      ],
    });

    const summary = await service.getSummary(
      {
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: '2026-04-28',
        studentId: 'student-1',
        month: 4,
        year: 2026,
      },
      adminActor,
    );

    expect(prisma.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'student-1',
        tenantId: adminActor.tenantId,
        classId: 'class-1',
        sectionId: 'section-1',
        enrollments: {
          some: {
            tenantId: adminActor.tenantId,
            academicYearId: 'ay-1',
            classId: 'class-1',
            sectionId: 'section-1',
            status: EnrollmentStatus.ACTIVE,
          },
        },
      },
    });
    expect(summary.classDaily.totals).toEqual(
      expect.objectContaining({
        totalStudents: 3,
        present: 1,
        absent: 1,
        late: 1,
      }),
    );
    expect(summary.studentMonthly).toEqual(
      expect.objectContaining({
        studentId: 'student-1',
        attendancePercent: 66.67,
      }),
    );
  });

  it('replays duplicate sync submissions with a stable envelope and incremented attempts', async () => {
    const existingSync = buildSyncSubmission({
      syncAttemptCount: 1,
    });
    const updatedSync = buildSyncSubmission({
      syncAttemptCount: 2,
    });
    const { service, prisma } = buildService({
      attendanceSyncFindUnique: existingSync,
      attendanceSyncUpdated: updatedSync,
    });

    const result = await service.syncAttendance(
      {
        academicYearId: 'ay-1',
        classId: 'class-1',
        attendanceDate: '2026-04-28',
        exceptions: [],
        clientSubmissionId: 'sync-1',
        deviceTimestamp: '2026-04-28T08:00:00.000Z',
      },
      adminActor,
    );

    expect(prisma.attendanceSyncSubmission.update).toHaveBeenCalledWith({
      where: { id: existingSync.id },
      data: {
        syncAttemptCount: {
          increment: 1,
        },
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: updatedSync.id,
        clientSubmissionId: 'sync-1',
        replayed: true,
        syncAttemptCount: 2,
      }),
    );
  });

  it('classifies non-working day sync rejections as validation errors', async () => {
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1' },
      calendarDay: {
        calendarDate: new Date('2026-04-26T00:00:00.000Z'),
        isWorkingDay: false,
        label: 'Holiday',
        holidayType: 'PUBLIC',
      },
      attendanceSyncCreated: buildSyncSubmission({
        syncStatus: AttendanceSyncStatus.REJECTED,
        rejectionReason: AttendanceSyncRejectionReason.VALIDATION_ERROR,
      }),
    });

    await expect(
      service.syncAttendance(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          attendanceDate: '2026-04-26',
          exceptions: [],
          clientSubmissionId: 'sync-2',
          deviceTimestamp: '2026-04-26T08:00:00.000Z',
        },
        adminActor,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.attendanceSyncSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          syncStatus: AttendanceSyncStatus.REJECTED,
          rejectionReason: AttendanceSyncRejectionReason.VALIDATION_ERROR,
        }),
      }),
    );
  });

  it('flags different device fingerprints in sync conflict metadata', async () => {
    const existingSession = {
      id: 'session-1',
      submittedAt: new Date('2026-04-28T08:00:00.000Z'),
      lockAt: new Date('2099-04-28T16:00:00.000Z'),
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.PRESENT,
          remark: null,
        },
      ],
    };
    const finalSession = buildAttendanceSession({
      id: 'session-1',
      conflictStatus: AttendanceConflictStatus.FLAGGED,
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          remark: 'Unwell',
        },
      ],
    });
    const { service, prisma, tx } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      students: [buildStudent()],
      attendanceSession: existingSession,
      priorSyncSubmission: buildSyncSubmission({
        id: 'prior-sync',
        deviceId: 'device-a',
        sessionFingerprint: 'fp-a',
      }),
      conflictRecord: {
        id: 'conflict-1',
      },
      attendanceSyncCreated: buildSyncSubmission({
        attendanceSessionId: 'session-1',
        conflictId: 'conflict-1',
        syncStatus: AttendanceSyncStatus.CONFLICTED,
      }),
      finalSession,
    });

    await service.syncAttendance(
      {
        academicYearId: 'ay-1',
        classId: 'class-1',
        attendanceDate: '2026-04-28',
        exceptions: [
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
            remark: 'Unwell',
          },
        ],
        clientSubmissionId: 'sync-3',
        deviceTimestamp: '2026-04-28T08:15:00.000Z',
        deviceId: 'device-b',
        sessionFingerprint: 'fp-b',
      },
      adminActor,
    );

    expect(tx.attendanceConflict.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incomingPayload: expect.objectContaining({
            submissionContext: expect.objectContaining({
              trustMetadata: expect.objectContaining({
                flagged: true,
                flagReason: 'device_fingerprint_mismatch',
                priorSubmissionId: 'prior-sync',
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('restricts conflict review to principal, admin, or super_admin', async () => {
    const { service } = buildService({});

    await expect(
      service.reviewConflict(
        'conflict-1',
        {
          decision: AttendanceConflictReviewDecision.REVIEWED_WITHOUT_CHANGE,
        },
        teacherActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('marks rejected resubmissions and updates linked sync records', async () => {
    const conflict = {
      id: 'conflict-1',
      attendanceSessionId: 'session-1',
    };
    const updatedConflict = {
      ...conflict,
      status: AttendanceConflictStatus.REVIEWED,
      decision: AttendanceConflictDecision.REJECTED_RESUBMISSION,
      resolutionNote: 'Teacher resubmission rejected',
      reviewedById: adminActor.userId,
      reviewedAt: new Date('2026-04-28T09:00:00.000Z'),
    };
    const { service, prisma } = buildService({
      attendanceConflict: conflict,
      updatedConflict,
      updatedSyncCount: 2,
    });

    const result = await service.reviewConflict(
      'conflict-1',
      {
        decision: AttendanceConflictReviewDecision.REJECTED_RESUBMISSION,
        resolutionNote: 'Teacher resubmission rejected',
      },
      adminActor,
    );

    expect(prisma.attendanceSyncSubmission.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
        conflictId: 'conflict-1',
      },
      data: {
        syncStatus: AttendanceSyncStatus.REJECTED,
        rejectionReason: AttendanceSyncRejectionReason.ROSTER_MISMATCH,
      },
    });
    expect(result).toEqual(
      expect.objectContaining({
        decision: AttendanceConflictDecision.REJECTED_RESUBMISSION,
        affectedSyncSubmissionCount: 2,
      }),
    );
  });

  it('blocks staff attendance submission on non-working days', async () => {
    const { service } = buildService({
      calendarDay: {
        calendarDate: new Date('2026-04-26T00:00:00.000Z'),
        isWorkingDay: false,
        label: 'Holiday',
        holidayType: 'PUBLIC',
      },
    });

    await expect(
      service.submitStaffAttendance(
        {
          attendanceDate: '2026-04-26',
          records: [
            {
              staffId: 'staff-1',
              status: AttendanceStatus.PRESENT,
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('prevents leave approval from creating a negative balance', async () => {
    const leaveRequest = {
      id: 'leave-1',
      tenantId: adminActor.tenantId,
      staffId: 'staff-1',
      leaveType: 'SICK',
      isPaid: true,
      startsOn: new Date('2026-04-28T00:00:00.000Z'),
      endsOn: new Date('2026-04-29T00:00:00.000Z'),
      days: new Prisma.Decimal(2),
      status: 'PENDING',
    };
    const reviewedLeave = {
      ...leaveRequest,
      status: 'APPROVED',
      reviewedById: adminActor.userId,
      reviewedAt: new Date('2026-04-28T09:00:00.000Z'),
      reviewNote: null,
    };
    const { service } = buildService({
      leaveRequest,
      reviewedLeave,
      leaveBalance: {
        allocated: new Prisma.Decimal(1),
        carried: new Prisma.Decimal(0),
        used: new Prisma.Decimal(0),
      },
    });

    await expect(
      service.reviewLeaveRequest(
        'leave-1',
        {
          status: 'APPROVED',
        },
        adminActor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows paid leave approval with sufficient balance', async () => {
    const leaveRequest = {
      id: 'leave-1',
      tenantId: adminActor.tenantId,
      staffId: 'staff-1',
      leaveType: 'SICK',
      isPaid: true,
      startsOn: new Date('2026-04-28T00:00:00.000Z'),
      endsOn: new Date('2026-04-29T00:00:00.000Z'),
      days: new Prisma.Decimal(2),
      status: 'PENDING',
    };
    const reviewedLeave = {
      ...leaveRequest,
      status: 'APPROVED',
      reviewedById: adminActor.userId,
      reviewedAt: new Date('2026-04-28T09:00:00.000Z'),
      reviewNote: null,
    };
    const { service, tx } = buildService({
      leaveRequest,
      reviewedLeave,
      leaveBalance: {
        allocated: new Prisma.Decimal(10),
        carried: new Prisma.Decimal(0),
        used: new Prisma.Decimal(0),
      },
    });

    const result = await service.reviewLeaveRequest(
      'leave-1',
      {
        status: 'APPROVED',
      },
      adminActor,
    );

    expect(result.status).toBe('APPROVED');
    expect(tx.staffLeaveBalance.upsert).toHaveBeenCalled();
  });

  it('allows unpaid leave approval without balance checks', async () => {
    const leaveRequest = {
      id: 'leave-1',
      tenantId: adminActor.tenantId,
      staffId: 'staff-1',
      leaveType: 'UNPAID',
      isPaid: false,
      startsOn: new Date('2026-04-28T00:00:00.000Z'),
      endsOn: new Date('2026-04-29T00:00:00.000Z'),
      days: new Prisma.Decimal(2),
      status: 'PENDING',
    };
    const reviewedLeave = {
      ...leaveRequest,
      status: 'APPROVED',
      reviewedById: adminActor.userId,
      reviewedAt: new Date('2026-04-28T09:00:00.000Z'),
      reviewNote: null,
    };
    const { service, tx } = buildService({
      leaveRequest,
      reviewedLeave,
      leaveBalance: null, // No balance record
    });

    const result = await service.reviewLeaveRequest(
      'leave-1',
      {
        status: 'APPROVED',
      },
      adminActor,
    );

    expect(result.status).toBe('APPROVED');
    expect(tx.staffLeaveBalance.upsert).not.toHaveBeenCalled();
  });

  it('does not deduct balance for rejected leave requests', async () => {
    const leaveRequest = {
      id: 'leave-1',
      tenantId: adminActor.tenantId,
      staffId: 'staff-1',
      leaveType: 'SICK',
      isPaid: true,
      startsOn: new Date('2026-04-28T00:00:00.000Z'),
      endsOn: new Date('2026-04-29T00:00:00.000Z'),
      days: new Prisma.Decimal(2),
      status: 'PENDING',
    };
    const reviewedLeave = {
      ...leaveRequest,
      status: 'REJECTED',
      reviewedById: adminActor.userId,
      reviewedAt: new Date('2026-04-28T09:00:00.000Z'),
      reviewNote: 'Rejected',
    };
    const { service, tx } = buildService({
      leaveRequest,
      reviewedLeave,
      leaveBalance: {
        allocated: new Prisma.Decimal(10),
        carried: new Prisma.Decimal(0),
        used: new Prisma.Decimal(0),
      },
    });

    const result = await service.reviewLeaveRequest(
      'leave-1',
      {
        status: 'REJECTED',
        reviewNote: 'Rejected',
      },
      adminActor,
    );

    expect(result.status).toBe('REJECTED');
    expect(tx.staffLeaveBalance.upsert).not.toHaveBeenCalled();
  });

  it('deduplicates daily escalation warnings by source type and source id', async () => {
    const sessionA = buildAttendanceSession({
      id: 'session-a',
      attendanceDate: new Date('2026-04-28T00:00:00.000Z'),
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          student: buildStudent(),
        },
      ],
    });
    const sessionB = buildAttendanceSession({
      id: 'session-b',
      attendanceDate: new Date('2026-04-27T00:00:00.000Z'),
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          student: buildStudent(),
        },
      ],
    });
    const sessionC = buildAttendanceSession({
      id: 'session-c',
      attendanceDate: new Date('2026-04-26T00:00:00.000Z'),
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          student: buildStudent(),
        },
      ],
    });
    const { service, prisma, communicationsService } = buildService({
      attendanceSessions: [sessionA, sessionB, sessionC],
      notificationDeliveryFindFirstQueue: [
        { id: 'existing-consecutive' },
        null,
      ],
    });

    const result = await service.processDailyEscalationWarnings(
      adminActor,
      new Date('2026-04-28T12:00:00.000Z'),
    );

    expect(result.warningCount).toBe(1);
    expect(result.warnings[0]).toEqual(
      expect.objectContaining({
        type: 'below_threshold',
      }),
    );
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledTimes(
      1,
    );
    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns monthly staff attendance summaries with overlap anomalies', async () => {
    const { service } = buildService({
      staffAttendanceRows: [
        {
          staffId: 'staff-1',
          attendanceDate: new Date('2026-04-10T00:00:00.000Z'),
          status: AttendanceStatus.PRESENT,
          staff: {
            firstName: 'Asha',
            lastName: 'Teacher',
            employeeId: 'EMP-1',
          },
        },
      ],
      approvedLeaveRequests: [
        {
          staffId: 'staff-1',
          startsOn: new Date('2026-04-10T00:00:00.000Z'),
          endsOn: new Date('2026-04-11T00:00:00.000Z'),
          staff: {
            firstName: 'Asha',
            lastName: 'Teacher',
            employeeId: 'EMP-1',
          },
        },
      ],
    });

    const result = await service.listStaffAttendanceSummary(
      { month: 4, year: 2026 },
      adminActor,
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        employeeId: 'EMP-1',
        presentDays: 1,
        approvedLeaveDays: 2,
        unresolvedOverlapAnomalies: 1,
      }),
    );
  });
});

function buildService(options: {
  academicYear?: unknown;
  classroom?: unknown;
  section?: unknown;
  calendarDay?: unknown;
  students?: unknown[];
  attendanceSession?: unknown;
  attendanceRecords?: unknown[];
  finalSession?: unknown;
  attendanceSessions?: unknown[];
  priorSyncSubmission?: unknown;
  attendanceSyncFindUnique?: unknown;
  attendanceSyncUpdated?: unknown;
  attendanceSyncCreated?: unknown;
  conflictRecord?: unknown;
  attendanceConflict?: unknown;
  updatedConflict?: unknown;
  updatedSyncCount?: number;
  leaveRequest?: unknown;
  reviewedLeave?: unknown;
  leaveBalance?: unknown;
  notificationDeliveryFindFirstQueue?: unknown[];
  staffAttendanceRows?: unknown[];
  approvedLeaveRequests?: unknown[];
  studentFindFirst?: unknown;
}) {
  const tx = {
    attendanceConflict: {
      create: jest.fn().mockResolvedValue({ id: 'tx-conflict' }),
    },
    attendanceSession: {
      update: jest.fn().mockResolvedValue(options.finalSession ?? null),
      create: jest.fn().mockResolvedValue(options.finalSession ?? null),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(options.finalSession ?? null),
    },
    attendanceRecord: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    staffLeaveRequest: {
      update: jest.fn().mockResolvedValue(options.reviewedLeave ?? null),
    },
    staffLeaveBalance: {
      findUnique: jest.fn().mockResolvedValue(options.leaveBalance ?? null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    staffAttendance: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const notificationDeliveryFindFirstQueue = [
    ...(options.notificationDeliveryFindFirstQueue ?? []),
  ];

  const prisma = {
    academicYear: {
      findFirst: jest.fn().mockResolvedValue(options.academicYear ?? null),
    },
    class: {
      findFirst: jest.fn().mockResolvedValue(options.classroom ?? null),
    },
    section: {
      findFirst: jest.fn().mockResolvedValue(options.section ?? null),
    },
    schoolCalendarDay: {
      findFirst: jest.fn().mockResolvedValue(options.calendarDay ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.calendarDay ? [options.calendarDay] : []),
    },
    attendanceSession: {
      findFirst: jest.fn().mockResolvedValue(options.attendanceSession ?? null),
      findMany: jest.fn().mockResolvedValue(options.attendanceSessions ?? []),
      update: jest.fn().mockResolvedValue(options.attendanceSession ?? {}),
    },
    student: {
      findMany: jest.fn().mockResolvedValue(options.students ?? []),
      findFirst: jest.fn().mockResolvedValue(options.studentFindFirst ?? null),
      findUnique: jest.fn().mockResolvedValue(options.studentFindFirst ?? null),
    },
    attendanceSyncSubmission: {
      findUnique: jest
        .fn()
        .mockResolvedValue(options.attendanceSyncFindUnique ?? null),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.priorSyncSubmission ?? null),
      update: jest
        .fn()
        .mockResolvedValue(options.attendanceSyncUpdated ?? null),
      create: jest
        .fn()
        .mockResolvedValue(options.attendanceSyncCreated ?? null),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.updatedSyncCount ?? 0 }),
    },
    attendanceConflict: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.conflictRecord ?? options.attendanceConflict ?? null,
        ),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(options.updatedConflict ?? null),
    },
    attendanceRecord: {
      findMany: jest.fn().mockResolvedValue(options.attendanceRecords ?? []),
    },
    notificationDelivery: {
      findFirst: jest.fn().mockImplementation(async () => {
        if (notificationDeliveryFindFirstQueue.length === 0) {
          return null;
        }

        return notificationDeliveryFindFirstQueue.shift();
      }),
    },
    staff: {
      count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    staffAttendance: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue(options.staffAttendanceRows ?? []),
    },
    staffLeaveRequest: {
      findFirst: jest.fn().mockResolvedValue(options.leaveRequest ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.approvedLeaveRequests ?? []),
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return (input as (tx: any) => unknown)(tx);
    }),
  };
  const communicationsService = {
    recordDeliveryRecords: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const settingsService = {
    getSetting: jest.fn().mockImplementation((tid, key) => {
      if (key === 'attendance_lock_hours') return 24;
      if (key === 'allow_teacher_correction_request') return true;
      return true;
    }),
  };
  const auditService = {
    record: jest.fn(),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };

  return {
    service: new AttendanceService(
      prisma as never,
      communicationsService as never,
      auditService as never,
      eventEmitter as never,
      settingsService as never,
    ),
    prisma,
    tx,
    communicationsService,
    auditService,
    eventEmitter,
    settingsService,
  };
}

function buildStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-1',
    studentSystemId: 'SCH-2026-0001',
    firstNameEn: 'Erwin',
    lastNameEn: 'Shrestha',
    ...overrides,
  };
}

function buildAttendanceSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    attendanceDate: new Date('2026-04-28T00:00:00.000Z'),
    class: { name: 'Grade 1' },
    section: { name: 'A' },
    classId: 'class-1',
    sectionId: 'section-1',
    submittedAt: new Date('2026-04-28T08:00:00.000Z'),
    lockAt: new Date('2026-04-28T14:00:00.000Z'),
    conflictStatus: AttendanceConflictStatus.NONE,
    records: [],
    ...overrides,
  };
}

function buildSyncSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sync-1',
    clientSubmissionId: 'sync-1',
    attendanceSessionId: 'session-1',
    conflictId: null,
    syncStatus: AttendanceSyncStatus.ACCEPTED,
    attendanceDate: new Date('2026-04-28T00:00:00.000Z'),
    deviceId: null,
    deviceLabel: null,
    deviceTimestamp: new Date('2026-04-28T08:00:00.000Z'),
    sessionFingerprint: null,
    syncAttemptCount: 1,
    serverReceivedAt: new Date('2026-04-28T08:00:01.000Z'),
    rejectionReason: null,
    createdAt: new Date('2026-04-28T08:00:01.000Z'),
    ...overrides,
  };
}

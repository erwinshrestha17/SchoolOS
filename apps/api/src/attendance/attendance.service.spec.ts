import {
  BadRequestException,
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
  AudienceType,
  AuthMethod,
  ConsentType,
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
  permissions: ['attendance:mark', 'attendance:read'],
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

  it('resolves the tenant current academic year when none is provided', async () => {
    const student = buildStudent({
      rollNumber: 1,
      guardianLinks: [],
      severeAllergies: null,
      medicalConditions: null,
      specialNeeds: null,
    });
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-current' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [student],
    });

    await service.getRoster(
      teacherActor,
      undefined,
      'class-1',
      'section-1',
      '2026-04-28',
    );

    expect(prisma.academicYear.findFirst).toHaveBeenCalledWith({
      where: { tenantId: teacherActor.tenantId, isCurrent: true },
      select: { id: true },
    });
    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          enrollments: {
            some: expect.objectContaining({ academicYearId: 'ay-current' }),
          },
        }),
      }),
    );
  });

  it('rejects an omitted academic year when no current year is set', async () => {
    const { service, prisma } = buildService({
      academicYear: null,
      classroom: { id: 'class-1', name: 'Grade 1' },
      students: [],
    });

    await expect(
      service.getRoster(teacherActor, undefined, 'class-1'),
    ).rejects.toThrow('No current academic year is set for this school');
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('builds the school-facing monthly register from a BS month boundary', async () => {
    const { service, prisma } = buildService({
      classroom: { id: 'class-1', name: 'Grade 1' },
      students: [],
      attendanceSessions: [],
    });

    await expect(
      service.getMonthlyRegister(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          bsMonth: 1,
          bsYear: 2081,
        },
        adminActor,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        calendar: 'BS',
        month: 1,
        year: 2081,
        periodLabel: 'Baisakh 2081 BS',
        daysCount: 31,
      }),
    );

    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          attendanceDate: {
            gte: new Date('2024-04-12T18:15:00.000Z'),
            lt: new Date('2024-05-13T18:15:00.000Z'),
          },
        }),
      }),
    );
  });

  it('rejects an incomplete BS monthly register period', async () => {
    const { service } = buildService({
      classroom: { id: 'class-1', name: 'Grade 1' },
    });

    await expect(
      service.getMonthlyRegister(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          bsMonth: 1,
        },
        adminActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns no mobile teacher classes when the signed-in user is not tenant staff', async () => {
    const { service, prisma } = buildService({
      staffFindFirst: null,
      teacherAssignments: [
        {
          id: 'assign-hidden',
          academicYearId: 'ay-other',
          classId: 'class-other',
          sectionId: 'section-other',
        },
      ],
      classTeacherSections: [
        {
          id: 'section-other',
          classId: 'class-other',
        },
      ],
    });

    await expect(
      service.listTeacherMobileClassSections(teacherActor),
    ).resolves.toEqual({ items: [] });

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { userId: teacherActor.userId, tenantId: teacherActor.tenantId },
      select: { id: true },
    });
    expect(prisma.subjectTeacherAssignment.findMany).not.toHaveBeenCalled();
    expect(prisma.section.findMany).not.toHaveBeenCalled();
  });

  it('lists deduped tenant-scoped mobile teacher classes from subject and class-teacher assignments', async () => {
    const { service, prisma } = buildService({
      staffFindFirst: { id: 'staff-1' },
      academicYear: { id: 'ay-current', name: '2082' },
      teacherAssignments: [
        {
          id: 'assign-1',
          academicYearId: 'ay-current',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { id: 'ay-current', name: '2082' },
          class: { id: 'class-1', name: 'Grade 3' },
          section: { id: 'section-1', name: 'A' },
          subject: { name: 'Math' },
        },
        {
          id: 'assign-2',
          academicYearId: 'ay-current',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { id: 'ay-current', name: '2082' },
          class: { id: 'class-1', name: 'Grade 3' },
          section: { id: 'section-1', name: 'A' },
          subject: { name: 'Science' },
        },
      ],
      classTeacherSections: [
        {
          id: 'section-1',
          classId: 'class-1',
          name: 'A',
          class: { id: 'class-1', name: 'Grade 3', level: 3 },
        },
      ],
    });

    await expect(
      service.listTeacherMobileClassSections(teacherActor),
    ).resolves.toEqual({
      items: [
        {
          id: 'ay-current:class-1:section-1',
          academicYearId: 'ay-current',
          academicYearName: '2082',
          classId: 'class-1',
          sectionId: 'section-1',
          name: 'Grade 3 - A',
          subject: 'Math, Science, Class teacher',
        },
      ],
    });

    expect(prisma.subjectTeacherAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: teacherActor.tenantId,
          staffId: 'staff-1',
          academicYearId: 'ay-current',
        },
      }),
    );
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: teacherActor.tenantId, classTeacherId: 'staff-1' },
      }),
    );
  });

  it('builds a tenant and teacher scoped today board from current assignments', async () => {
    const today = new Date();
    const dateInput = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const expectedIsoWeekday = today.getDay() === 0 ? 7 : today.getDay();
    const { service, prisma } = buildService({
      staffFindFirst: { id: 'staff-1' },
      academicYear: { id: 'ay-current', name: '2082' },
      teacherAssignments: [
        {
          id: 'assign-1',
          academicYearId: 'ay-current',
          classId: 'class-1',
          sectionId: 'section-1',
          academicYear: { id: 'ay-current', name: '2082' },
          class: { id: 'class-1', name: 'Grade 3' },
          section: { id: 'section-1', name: 'A' },
          subject: { name: 'Math' },
        },
      ],
      attendanceSessions: [],
      timetableSlots: [
        {
          id: 'slot-1',
          academicYearId: 'ay-current',
          classId: 'class-1',
          sectionId: 'section-1',
          startsAt: '09:00',
          endsAt: '09:45',
          class: { name: 'Grade 3' },
          section: { name: 'A' },
          subject: { name: 'Math' },
        },
      ],
    });

    const result = await service.getTeacherMobileToday(teacherActor, dateInput);

    expect(result.pendingAttendanceCount).toBe(1);
    expect(result.periods).toEqual([
      expect.objectContaining({
        id: 'slot-1',
        className: 'Grade 3 - A',
        subjectName: 'Math',
      }),
    ]);
    expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: teacherActor.tenantId,
          staffId: 'staff-1',
          academicYearId: 'ay-current',
          dayOfWeek: expectedIsoWeekday,
        }),
      }),
    );
  });

  it('returns a bounded teacher-scoped mobile student summary', async () => {
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1', name: '2083' },
      classroom: { id: 'class-1', name: 'Grade 4' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      staffFindFirst: { id: 'staff-1' },
      studentFindFirst: {
        id: 'student-1',
        studentSystemId: 'SCH-2026-001',
        firstNameEn: 'Asha',
        lastNameEn: 'Rai',
        rollNumber: 7,
        lifecycleStatus: 'ACTIVE',
        guardianLinks: [{ guardian: { primaryPhone: 'hidden' } }],
      },
      attendanceRecords: [
        {
          status: AttendanceStatus.PRESENT,
          remark: null,
          attendanceSession: {
            attendanceDate: new Date('2026-06-01T00:00:00.000Z'),
          },
        },
        {
          status: AttendanceStatus.ABSENT,
          remark: 'Sick note pending',
          attendanceSession: {
            attendanceDate: new Date('2026-06-02T00:00:00.000Z'),
          },
        },
      ],
    });

    const result = await service.getTeacherMobileStudentSummary(teacherActor, {
      studentId: 'student-1',
      academicYearId: 'ay-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'student-1',
          tenantId: teacherActor.tenantId,
          classId: 'class-1',
          sectionId: 'section-1',
        }),
      }),
    );
    expect(result).toEqual({
      student: {
        id: 'student-1',
        name: 'Asha Rai',
        studentSystemId: 'SCH-2026-001',
        rollNumber: 7,
        lifecycleStatus: 'ACTIVE',
        academicYearId: 'ay-1',
        academicYearName: '2083',
        classId: 'class-1',
        className: 'Grade 4',
        sectionId: 'section-1',
        sectionName: 'A',
      },
      scope: {
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        access: 'teacher_assigned',
      },
      attendance: {
        recentWindow: 2,
        present: 1,
        absent: 1,
        late: 0,
        leave: 0,
        lastStatus: AttendanceStatus.ABSENT,
        lastRemark: 'Sick note pending',
        lastRecordedAt: '2026-06-02T00:00:00.000Z',
      },
    });
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  it('rejects mobile teacher roster access for unassigned class sections', async () => {
    const scopeSection = { id: 'section-1', name: 'A', classId: 'class-1' };
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: scopeSection,
      staffFindFirst: { id: 'staff-1' },
    });
    prisma.section.findFirst
      .mockResolvedValueOnce(scopeSection)
      .mockResolvedValueOnce(null);
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.getRoster(
        teacherActor,
        'ay-1',
        'class-1',
        'section-1',
        '2026-04-28',
      ),
    ).rejects.toThrow(
      'You are not assigned as Class Teacher or Subject Teacher for this section',
    );
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('rejects mobile teacher attendance submission for unassigned class sections', async () => {
    const scopeSection = { id: 'section-1', name: 'A', classId: 'class-1' };
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: scopeSection,
      staffFindFirst: { id: 'staff-1' },
    });
    prisma.section.findFirst
      .mockResolvedValueOnce(scopeSection)
      .mockResolvedValueOnce(null);
    prisma.subjectTeacherAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.submitAttendance(
        {
          academicYearId: 'ay-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-04-28',
          exceptions: [],
        },
        teacherActor,
      ),
    ).rejects.toThrow(
      'You are not assigned as Class Teacher or Subject Teacher for this section',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  it('requires a correction instead of silently editing submitted attendance', async () => {
    const { service, prisma } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      attendanceSession: buildAttendanceSession({
        submittedAt: new Date('2026-04-28T04:00:00.000Z'),
        lockAt: new Date('2099-04-29T04:00:00.000Z'),
      }),
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
    ).rejects.toThrow(
      'Attendance is already submitted. Please request a correction instead of editing it.',
    );
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires a non-blank correction reason before any correction lookup', async () => {
    const { service, prisma } = buildService({});

    await expect(
      service.createCorrectionRequest(
        {
          studentId: 'student-1',
          attendanceDate: '2026-04-28',
          requestedStatus: AttendanceStatus.ABSENT,
          reason: '   ',
        },
        teacherActor,
      ),
    ).rejects.toThrow('Attendance correction requires a reason.');
    expect(prisma.attendanceCorrectionRequest.findFirst).not.toHaveBeenCalled();
  });

  it('preserves the official previous status when correction uses session and student scope', async () => {
    const request = {
      id: 'correction-1',
      previousStatus: AttendanceStatus.LATE,
      requestedStatus: AttendanceStatus.PRESENT,
      status: 'PENDING',
    };
    const { service, prisma } = buildService({
      studentFindFirst: {
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
      },
      attendanceSession: {
        id: 'session-1',
        attendanceDate: new Date('2026-04-27T18:15:00.000Z'),
        classId: 'class-1',
        sectionId: 'section-1',
        submittedAt: new Date('2026-04-28T04:00:00.000Z'),
      },
      attendanceRecord: {
        id: 'record-1',
        attendanceSessionId: 'session-1',
        status: AttendanceStatus.LATE,
      },
      correctionUpdated: request,
    });

    await expect(
      service.createCorrectionRequest(
        {
          attendanceSessionId: 'session-1',
          studentId: 'student-1',
          attendanceDate: '2026-04-28',
          requestedStatus: AttendanceStatus.PRESENT,
          reason: 'Teacher selected late by mistake',
        },
        teacherActor,
      ),
    ).resolves.toEqual(request);
    expect(prisma.attendanceCorrectionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attendanceRecordId: 'record-1',
          previousStatus: AttendanceStatus.LATE,
          requestedStatus: AttendanceStatus.PRESENT,
          reason: 'Teacher selected late by mistake',
        }),
      }),
    );
  });

  it('submits a saved draft through replay-safe attendance submission and deletes it after success', async () => {
    const draft = {
      id: 'draft-1',
      tenantId: adminActor.tenantId,
      userId: adminActor.userId,
      academicYearId: 'ay-1',
      classId: 'class-1',
      sectionId: 'section-1',
      attendanceDate: new Date('2026-04-28T00:00:00.000Z'),
      payload: {
        exceptions: [
          { studentId: 'student-1', status: AttendanceStatus.ABSENT },
        ],
      },
    };
    const { service, prisma } = buildService({ attendanceDraft: draft });
    const submitSpy = jest
      .spyOn(service, 'submitAttendance')
      .mockResolvedValue({ sessionId: 'session-1' } as never);

    await expect(service.submitDraft(draft.id, adminActor)).resolves.toEqual({
      sessionId: 'session-1',
    });
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        academicYearId: 'ay-1',
        classId: 'class-1',
        sectionId: 'section-1',
        exceptions: draft.payload.exceptions,
      }),
      adminActor,
      expect.objectContaining({
        source: 'sync_submission',
        clientSubmissionId: 'draft-draft-1',
      }),
    );
    expect(prisma.attendanceDraft.delete).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
    });
  });

  it('emits attendance domain events and records child-scoped parent notifications', async () => {
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
    const { service, eventEmitter, communicationsService, auditService } =
      buildService({
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
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'attendance_parent_absence_notification',
        sourceId: 'session-1:student-1:ABSENT',
        audienceType: AudienceType.ALL,
        studentIds: ['student-1'],
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
        communicationCategory: 'ESSENTIAL',
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'parent_status_notifications',
        resource: 'attendance_session',
        tenantId: adminActor.tenantId,
        resourceId: 'session-1',
      }),
    );
  });

  it('honors tenant M2 parent notification channels and message templates', async () => {
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
    const { service, communicationsService } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [buildStudent({ id: 'student-1' })],
      finalSession,
      m2Policy: {
        parentNotificationChannels: [NotificationChannel.EMAIL],
        absenceMessageTemplate:
          '{studentName} has one absence mark. Please review with school.',
      },
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

    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'attendance_parent_absence_notification',
        body: 'Your child has one absence mark. Please review with school.',
        channels: [NotificationChannel.EMAIL],
      }),
    );
  });

  it('suppresses duplicate parent absence notifications on retry by stable source id', async () => {
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
    const { service, prisma, communicationsService, auditService } =
      buildService({
        academicYear: { id: 'ay-1' },
        classroom: { id: 'class-1', name: 'Grade 1' },
        section: { id: 'section-1', name: 'A', classId: 'class-1' },
        students: [buildStudent({ id: 'student-1' })],
        finalSession,
        notificationDeliveryFindFirstQueue: [{ id: 'delivery-existing' }],
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

    expect(prisma.notificationDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
        sourceType: 'attendance_parent_absence_notification',
        sourceId: 'session-1:student-1:ABSENT',
      },
    });
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'parent_status_notifications',
        after: expect.objectContaining({
          notifiedRecords: 1,
          deliveryCount: 0,
        }),
      }),
    );
  });

  it('keeps attendance events but skips disabled parent absence notifications', async () => {
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
    const { service, eventEmitter, communicationsService } = buildService({
      academicYear: { id: 'ay-1' },
      classroom: { id: 'class-1', name: 'Grade 1' },
      section: { id: 'section-1', name: 'A', classId: 'class-1' },
      students: [buildStudent({ id: 'student-1' })],
      finalSession,
      m2Policy: {
        notifyParentsForAbsence: false,
      },
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
      }),
    );
    expect(communicationsService.recordDeliveryRecords).not.toHaveBeenCalled();
  });

  it('returns a repeated absence and late follow-up queue', async () => {
    const { service } = buildService({});
    jest.spyOn(service, 'getAttendanceAnomalies').mockResolvedValue({
      absenceStreaks: [
        {
          studentId: 'student-1',
          studentName: 'Asha Tamang',
          className: 'Grade 1',
          sectionName: 'A',
          streakCount: 5,
        },
      ],
      repeatedLates: [
        {
          studentId: 'student-2',
          studentName: 'Bimal Rai',
          className: 'Grade 2',
          sectionName: null,
          lateCount: 3,
        },
      ],
      anomalies: {
        rosterDivergences: [],
        lateSubmissions: [],
        attendanceDrops: [],
        unsubmittedWorkingDays: [],
      },
    });

    const result = await service.getFollowUpQueue(adminActor);

    expect(result.total).toBe(2);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        type: 'consecutive_absence',
        studentId: 'student-1',
        priority: 'high',
        count: 5,
      }),
    );
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        type: 'repeated_late',
        studentId: 'student-2',
        priority: 'medium',
        count: 3,
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

  it('restricts correction review to attendance reviewers', async () => {
    const { service, prisma } = buildService({});

    await expect(
      service.approveCorrectionRequest(
        'correction-1',
        {
          status: 'APPROVED',
          reviewNote: 'Correcting teacher-submitted mistake',
        },
        teacherActor,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.attendanceCorrectionRequest.findFirst).not.toHaveBeenCalled();
  });

  it('returns not found for cross-tenant correction review lookups', async () => {
    const { service, prisma } = buildService({ correctionRequest: null });

    await expect(
      service.approveCorrectionRequest(
        'correction-foreign',
        {
          status: 'APPROVED',
          reviewNote: 'Approved after checking class register',
        },
        adminActor,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.attendanceCorrectionRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'correction-foreign', tenantId: adminActor.tenantId },
      }),
    );
  });

  it('enforces tenant M2 correction review minimum reason length before lookup', async () => {
    const { service, prisma } = buildService({
      m2Policy: {
        correctionReviewMinReasonLength: 12,
      },
    });

    await expect(
      service.approveCorrectionRequest(
        'correction-1',
        {
          status: 'APPROVED',
          reviewReason: 'Too short',
        },
        adminActor,
      ),
    ).rejects.toThrow(
      'Attendance correction review requires a reason of at least 12 characters.',
    );
    expect(prisma.attendanceCorrectionRequest.findFirst).not.toHaveBeenCalled();
  });

  it('records rejected correction reasons without mutating attendance records', async () => {
    const rejectedCorrection = {
      id: 'correction-1',
      status: 'REJECTED',
      reviewedById: adminActor.userId,
      reviewReason: 'Register already matches the submitted status',
    };
    const { service, prisma } = buildService({
      correctionRequest: {
        id: 'correction-1',
        status: 'PENDING',
        attendanceRecordId: 'record-1',
        studentId: 'student-1',
        requestedStatus: AttendanceStatus.ABSENT,
        previousStatus: AttendanceStatus.PRESENT,
        reason: 'Marked by mistake',
      },
      correctionUpdated: rejectedCorrection,
    });

    const result = await service.approveCorrectionRequest(
      'correction-1',
      {
        status: 'REJECTED',
        reviewNote: 'Register already matches the submitted status',
      },
      adminActor,
    );

    expect(result).toBe(rejectedCorrection);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.attendanceCorrectionRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'REJECTED',
          reviewReason: 'Register already matches the submitted status',
          reviewNote: 'Register already matches the submitted status',
        }),
      }),
    );
  });

  it('denies parent attendance summaries for students outside guardian links', async () => {
    const parentActor = {
      ...teacherActor,
      userId: 'parent-1',
      roles: ['parent'],
      permissions: ['attendance:read'],
    };
    const { service, prisma } = buildService({
      studentFindFirst: {
        id: 'student-2',
        classId: 'class-1',
        sectionId: null,
      },
      guardianFindFirst: {
        id: 'guardian-1',
        studentLinks: [{ studentId: 'student-1' }],
      },
    });

    await expect(
      service.getParentSummary('student-2', parentActor),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.attendanceRecord.findFirst).not.toHaveBeenCalled();
    expect(prisma.attendanceRecord.findMany).not.toHaveBeenCalled();
  });

  it('enforces tenant M2 locked-session override minimum reason length before mutating records', async () => {
    const session = buildAttendanceSession({
      records: [
        {
          studentId: 'student-1',
          status: AttendanceStatus.ABSENT,
          remark: null,
        },
      ],
    });
    const { service, prisma, tx } = buildService({
      attendanceSession: session,
      m2Policy: {
        lockOverrideMinReasonLength: 10,
      },
    });

    await expect(
      service.overrideLockedSession(
        'session-1',
        {
          reason: 'Short',
          exceptions: [
            {
              studentId: 'student-1',
              status: AttendanceStatus.PRESENT,
            },
          ],
        },
        adminActor,
      ),
    ).rejects.toThrow(
      'Attendance lock override requires a reason of at least 10 characters.',
    );
    expect(prisma.attendanceSession.findFirst).not.toHaveBeenCalled();
    expect(tx.attendanceRecord.update).not.toHaveBeenCalled();
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

  it('returns retained monthly register export jobs with protected file metadata only', async () => {
    const createdAt = new Date('2026-05-01T08:00:00.000Z');
    const completedAt = new Date('2026-05-01T08:00:05.000Z');
    const { service, prisma } = buildService({
      reportExports: [
        {
          id: 'export-1',
          tenantId: adminActor.tenantId,
          reportKey: 'attendance_monthly_register',
          format: 'csv',
          filters: {
            academicYearId: 'year-1',
            classId: 'class-1',
            bsYear: 2083,
            bsMonth: 1,
          },
          status: 'COMPLETED',
          fileAssetId: 'file-1',
          requestedBy: adminActor.userId,
          errorSummary: null,
          createdAt,
          completedAt,
        },
      ],
      reportExportCount: 1,
      fileAssets: [
        {
          id: 'file-1',
          originalFilename: 'attendance-register.csv',
          mimeType: 'text/csv',
          sizeBytes: BigInt(128),
          status: 'UPLOADED',
          objectKey: 'private/tenant-1/attendance-register.csv',
        },
      ],
    });

    const result = await service.listMonthlyRegisterExports(adminActor, {
      page: '1',
      limit: '10',
    });

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
        reportKey: 'attendance_monthly_register',
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: 0,
      take: 10,
    });
    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: adminActor.tenantId,
        id: { in: ['file-1'] },
        module: 'attendance',
        softDeletedAt: null,
        deletedAt: null,
      },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
      },
    });
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: 'export-1',
          reportKey: 'attendance_monthly_register',
          status: 'COMPLETED',
          file: {
            fileAssetId: 'file-1',
            fileName: 'attendance-register.csv',
            mimeType: 'text/csv',
            sizeBytes: 128,
            status: 'UPLOADED',
          },
        }),
      ],
      total: 1,
      page: 1,
      limit: 10,
      hasNextPage: false,
    });
    expect(JSON.stringify(result)).not.toContain('objectKey');
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
  attendanceRecord?: unknown;
  finalSession?: unknown;
  attendanceSessions?: unknown[];
  priorSyncSubmission?: unknown;
  attendanceSyncFindUnique?: unknown;
  attendanceSyncUpdated?: unknown;
  attendanceSyncCreated?: unknown;
  conflictRecord?: unknown;
  attendanceConflict?: unknown;
  updatedConflict?: unknown;
  correctionRequest?: unknown;
  correctionUpdated?: unknown;
  updatedSyncCount?: number;
  leaveRequest?: unknown;
  reviewedLeave?: unknown;
  leaveBalance?: unknown;
  notificationDeliveryFindFirstQueue?: unknown[];
  staffAttendanceRows?: unknown[];
  approvedLeaveRequests?: unknown[];
  studentFindFirst?: unknown;
  staffFindFirst?: unknown;
  teacherAssignments?: unknown[];
  classTeacherSections?: unknown[];
  timetableSlots?: unknown[];
  guardianFindFirst?: unknown;
  m2Policy?: unknown;
  reportExports?: unknown[];
  reportExportCount?: number;
  fileAssets?: unknown[];
  attendanceDraft?: unknown;
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
      findMany: jest.fn().mockResolvedValue(options.classTeacherSections ?? []),
    },
    schoolCalendarDay: {
      findFirst: jest.fn().mockResolvedValue(options.calendarDay ?? null),
      findMany: jest
        .fn()
        .mockResolvedValue(options.calendarDay ? [options.calendarDay] : []),
    },
    tenantSetting: {
      findUnique: jest.fn().mockResolvedValue(
        options.m2Policy === undefined
          ? null
          : {
              value: options.m2Policy,
            },
      ),
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
      findFirst: jest.fn().mockResolvedValue(options.attendanceRecord ?? null),
      findMany: jest.fn().mockResolvedValue(options.attendanceRecords ?? []),
    },
    attendanceCorrectionRequest: {
      findFirst: jest.fn().mockResolvedValue(options.correctionRequest ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue(options.correctionUpdated ?? null),
      create: jest.fn().mockResolvedValue(options.correctionUpdated ?? null),
    },
    attendanceDraft: {
      findFirst: jest.fn().mockResolvedValue(options.attendanceDraft ?? null),
      delete: jest.fn().mockResolvedValue(options.attendanceDraft ?? null),
    },
    reportExport: {
      findMany: jest.fn().mockResolvedValue(options.reportExports ?? []),
      count: jest.fn().mockResolvedValue(options.reportExportCount ?? 0),
      create: jest.fn().mockResolvedValue({ id: 'export-1' }),
    },
    fileAsset: {
      findMany: jest.fn().mockResolvedValue(options.fileAssets ?? []),
    },
    guardian: {
      findFirst: jest.fn().mockResolvedValue(options.guardianFindFirst ?? null),
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
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'staff-1', userId: 'user-1' }),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.staffFindFirst === undefined
            ? { id: 'staff-1', userId: 'user-1' }
            : options.staffFindFirst,
        ),
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
    subjectTeacherAssignment: {
      findFirst: jest.fn().mockResolvedValue({ id: 'assign-1' }),
      findMany: jest.fn().mockResolvedValue(options.teacherAssignments ?? []),
    },
    timetableSlot: {
      findMany: jest.fn().mockResolvedValue(options.timetableSlots ?? []),
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

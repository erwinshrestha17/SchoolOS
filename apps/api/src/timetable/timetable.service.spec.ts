import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  AuthMethod,
  TeacherAssignmentType,
  TimetableVersionStatus,
} from '@prisma/client';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import {
  minutesBetween,
  TimetableService,
  timesOverlap,
} from './timetable.service';

describe('timesOverlap', () => {
  it('detects overlapping class and teacher timetable slots', () => {
    expect(timesOverlap('09:00', '09:45', '09:30', '10:15')).toBe(true);
    expect(timesOverlap('09:00', '09:45', '09:45', '10:30')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:00', '10:00')).toBe(false);
    expect(timesOverlap('10:00', '10:45', '09:30', '10:15')).toBe(true);
  });

  it('calculates weekly workload minutes from HH:mm slot strings', () => {
    expect(minutesBetween('09:00', '09:45')).toBe(45);
    expect(minutesBetween('10:15', '11:30')).toBe(75);
    expect(minutesBetween('11:30', '10:15')).toBe(0);
  });
});

describe('TimetableService lifecycle behavior', () => {
  it('returns only the purpose-limited published timetable projection for support', async () => {
    const prisma = {
      timetableSlot: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new TimetableService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.listSupportPublishedTimetable(
      {
        tenantId: 'tenant-1',
        userId: 'platform-operator-1',
        roles: [],
        permissions: ['timetable:read_published'],
        authMethod: AuthMethod.PASSWORD,
        isSupportOverride: true,
        supportOverrideScopes: ['HOMEWORK_TIMETABLE'],
      } as never,
      { page: 1, limit: 25 },
    );

    const where = prisma.timetableSlot.findMany.mock.calls[0]?.[0].where;
    expect(where).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        AND: [
          {
            OR: [
              { versionId: null },
              {
                version: {
                  status: {
                    in: [
                      TimetableVersionStatus.PUBLISHED,
                      TimetableVersionStatus.LOCKED,
                    ],
                  },
                },
              },
            ],
          },
        ],
      }),
    );
    expect(prisma.timetableSlot.count).toHaveBeenCalledWith({ where });
    expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          dayOfWeek: true,
          startsAt: true,
          endsAt: true,
          room: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
          staff: { select: { firstName: true, lastName: true } },
          roomRef: { select: { name: true } },
        },
      }),
    );
    const supportSelect = prisma.timetableSlot.findMany.mock.calls[0][0].select;
    expect(JSON.stringify(supportSelect)).not.toContain('employeeId');
    expect(JSON.stringify(supportSelect)).not.toContain('version');
  });

  it('denies the general timetable service path to support overrides', async () => {
    const prisma = {
      timetableSlot: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const service = new TimetableService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.listTimetable(
        {
          tenantId: 'tenant-1',
          userId: 'platform-operator-1',
          roles: [],
          permissions: ['timetable:read_published'],
          authMethod: AuthMethod.PASSWORD,
          isSupportOverride: true,
        } as never,
        {},
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.timetableSlot.findMany).not.toHaveBeenCalled();
  });

  it('blocks archiving locked timetable versions through the service path', async () => {
    const prisma = {
      timetableVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-locked',
          tenantId: 'tenant-1',
          status: TimetableVersionStatus.LOCKED,
          slots: [],
        }),
        update: jest.fn(),
      },
    };
    const lifecycleService = {
      assertCanArchive: jest.fn(() => {
        throw new ConflictException(
          'Locked timetable versions cannot be archived without an explicit elevated workflow',
        );
      }),
    };
    const service = new TimetableService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      lifecycleService as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.archiveVersion('version-locked', {
        tenantId: 'tenant-1',
        userId: 'admin-1',
      } as never),
    ).rejects.toThrow(
      'Locked timetable versions cannot be archived without an explicit elevated workflow',
    );

    expect(lifecycleService.assertCanArchive).toHaveBeenCalledWith(
      TimetableVersionStatus.LOCKED,
    );
    expect(prisma.timetableVersion.update).not.toHaveBeenCalled();
  });

  it('uses canonical exact-section scope for a teacher class timetable read', async () => {
    const teacherScope = {
      requireActorAccess: jest.fn().mockResolvedValue({}),
      requireActorAccessAnySectionOfClass: jest.fn().mockResolvedValue({}),
    };
    const service = new TimetableService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      teacherScope as never,
    );
    const actor = {
      tenantId: 'tenant-1',
      userId: 'teacher-user-1',
      roles: ['teacher'],
      permissions: ['timetable:read'],
      authMethod: AuthMethod.PASSWORD,
    } as never;

    await (
      service as unknown as {
        ensureClassSectionReadableByTeacher(
          actorInput: typeof actor,
          classId: string,
          sectionId: string | null,
        ): Promise<void>;
      }
    ).ensureClassSectionReadableByTeacher(actor, 'class-1', 'section-1');

    expect(teacherScope.requireActorAccess).toHaveBeenCalledWith(
      {
        classId: 'class-1',
        sectionId: 'section-1',
        capability: TeacherCapability.CLASS_ROSTER_READ,
      },
      actor,
    );
  });

  it('builds weekly-requirement scope from active canonical subject assignments', async () => {
    const teacherScope = {
      listActiveAssignments: jest.fn().mockResolvedValue([
        {
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        },
        {
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        },
      ]),
    };
    const service = new TimetableService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      teacherScope as never,
    );

    await expect(
      (
        service as unknown as {
          getTeacherTimetableScope(
            actorInput: object,
          ): Promise<Array<Record<string, string>>>;
        }
      ).getTeacherTimetableScope({} as never),
    ).resolves.toEqual([
      {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
      },
    ]);
  });
});

describe('TimetableService teacher mobile timetable', () => {
  const actor = {
    tenantId: 'tenant-1',
    userId: 'teacher-user-1',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: [],
  } as never;

  const version = {
    effectiveFrom: new Date('2020-01-01T00:00:00.000Z'),
    effectiveTo: null,
  };

  function slotRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'slot-1',
      dayOfWeek: 1,
      academicYearId: 'ay-1',
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
      startsAt: '09:00',
      endsAt: '09:45',
      class: { name: 'Class 9' },
      section: { name: 'B' },
      subject: { name: 'Science' },
      roomRef: { name: 'Lab 1' },
      version,
      ...overrides,
    };
  }

  function makeService(prisma: Record<string, unknown>) {
    return new TimetableService(
      prisma as never,
      {} as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function basePrisma() {
    return {
      staff: {
        findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      timetableSlot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      timetableSubstitution: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
  }

  it('skips substitution side-lookups entirely when there are none', async () => {
    const prisma = basePrisma();
    prisma.timetableSlot.findMany.mockResolvedValue([slotRow()]);

    const result = await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    expect(result.substitutions).toEqual([]);
    // The ordinary daily case: no extra Staff or slot batch queries.
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
    expect(prisma.timetableSlot.findMany).toHaveBeenCalledTimes(1);
  });

  it('never selects the full Staff row for substitution teacher names', async () => {
    const prisma = basePrisma();
    prisma.timetableSubstitution.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        date: new Date('2026-08-03T00:00:00.000Z'),
        status: 'ASSIGNED',
        reason: 'Sick leave',
        timetableSlotId: 'slot-1',
        absentTeacherId: 'staff-2',
        substituteTeacherId: 'staff-1',
      },
    ]);
    prisma.timetableSlot.findMany.mockResolvedValue([slotRow()]);
    prisma.staff.findMany.mockResolvedValue([
      { id: 'staff-1', firstName: 'Asha', lastName: 'Rai' },
      { id: 'staff-2', firstName: 'Bikash', lastName: 'Thapa' },
    ]);

    await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    // PAN, bank account and citizenship number must never be fetched to render
    // a display name.
    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', id: { in: ['staff-1', 'staff-2'] } },
      select: { id: true, firstName: true, lastName: true },
    });
  });

  it('resolves substitution slot detail from the already-loaded slots', async () => {
    const prisma = basePrisma();
    prisma.timetableSlot.findMany.mockResolvedValue([slotRow()]);
    prisma.timetableSubstitution.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        date: new Date('2026-08-03T00:00:00.000Z'),
        status: 'ASSIGNED',
        reason: 'Sick leave',
        timetableSlotId: 'slot-1',
        absentTeacherId: 'staff-2',
        substituteTeacherId: 'staff-1',
      },
    ]);
    prisma.staff.findMany.mockResolvedValue([
      { id: 'staff-1', firstName: 'Asha', lastName: 'Rai' },
      { id: 'staff-2', firstName: 'Bikash', lastName: 'Thapa' },
    ]);

    const result = await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    expect(result.substitutions[0]).toEqual(
      expect.objectContaining({
        className: 'Class 9',
        sectionName: 'B',
        subjectName: 'Science',
        room: 'Lab 1',
        role: 'SUBSTITUTE',
        absentTeacherName: 'Bikash Thapa',
        substituteTeacherName: 'Asha Rai',
      }),
    );
    // slot-1 was already loaded, so no second slot query.
    expect(prisma.timetableSlot.findMany).toHaveBeenCalledTimes(1);
  });

  it('batch-fetches only slots owned by the absent teacher', async () => {
    const prisma = basePrisma();
    prisma.timetableSlot.findMany
      .mockResolvedValueOnce([slotRow()])
      .mockResolvedValueOnce([
        slotRow({
          id: 'slot-other',
          class: { name: 'Class 7' },
          section: { name: 'A' },
          subject: { name: 'Maths' },
          roomRef: null,
        }),
      ]);
    prisma.timetableSubstitution.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        date: new Date('2026-08-03T00:00:00.000Z'),
        status: 'ASSIGNED',
        reason: 'Cover',
        // This teacher is the substitute, so the slot belongs to someone else
        // and is not in the first query's result.
        timetableSlotId: 'slot-other',
        absentTeacherId: 'staff-2',
        substituteTeacherId: 'staff-1',
      },
    ]);
    prisma.staff.findMany.mockResolvedValue([
      { id: 'staff-1', firstName: 'Asha', lastName: 'Rai' },
      { id: 'staff-2', firstName: 'Bikash', lastName: 'Thapa' },
    ]);

    const result = await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    expect(prisma.timetableSlot.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.timetableSlot.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-1', id: { in: ['slot-other'] } },
      }),
    );
    expect(result.substitutions[0]).toEqual(
      expect.objectContaining({
        className: 'Class 7',
        subjectName: 'Maths',
        room: null,
      }),
    );
  });

  it('degrades to nulls when a substitution slot cannot be resolved', async () => {
    const prisma = basePrisma();
    prisma.timetableSubstitution.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        date: new Date('2026-08-03T00:00:00.000Z'),
        status: 'PENDING',
        reason: null,
        timetableSlotId: 'slot-deleted',
        absentTeacherId: 'staff-2',
        substituteTeacherId: null,
      },
    ]);
    prisma.staff.findMany.mockResolvedValue([
      { id: 'staff-2', firstName: 'Bikash', lastName: 'Thapa' },
    ]);

    const result = await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    // A slot removed between the two queries must not throw.
    expect(result.substitutions[0]).toEqual(
      expect.objectContaining({
        className: null,
        subjectName: null,
        startsAt: null,
        role: 'ABSENT_TEACHER',
        substituteTeacherName: null,
        absentTeacherName: 'Bikash Thapa',
      }),
    );
  });

  it('scopes slot and substitution reads to the acting tenant and teacher', async () => {
    const prisma = basePrisma();

    await makeService(prisma).getTeacherMobileTimetable(actor, {
      date: '2026-08-03',
      days: 1,
    });

    expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          staffId: 'staff-1',
        }),
      }),
    );
    expect(prisma.timetableSubstitution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });
});

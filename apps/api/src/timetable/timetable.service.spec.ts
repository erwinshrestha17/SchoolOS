import { ConflictException } from '@nestjs/common';
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

import { AuthMethod, TeacherAssignmentType } from '@prisma/client';
import { AcademicsService } from './academics.service';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';

/**
 * `GET /teacher-assignments` is gated on `academics:read`, which every teacher
 * preset holds. Two confirmed defects lived behind that gate:
 *
 *  1. `include: { staff: true }` returned every colleague's full Staff row --
 *     citizenshipNo, panNumber, bankAccount, bankName, dateOfBirth, address
 *     and emergency contacts -- even though the shared contract
 *     (`TeacherAssignmentSummary`) only ever promised id/name/employeeId.
 *  2. A teacher received the whole school's subject-teacher map rather than
 *     their own assignments.
 *
 * These are the regression tests for both.
 */

const SENSITIVE_STAFF_FIELDS = [
  'citizenshipNo',
  'panNumber',
  'bankAccount',
  'bankName',
  'dateOfBirth',
  'address',
  'emergencyContactPhone',
  'emergencyContactName',
  'salary',
];

function buildService() {
  const findMany = jest.fn().mockResolvedValue([]);
  const staffFindFirst = jest.fn().mockResolvedValue('staff-teacher-1');

  const prisma = {
    teacherAssignment: { findMany },
  } as never;
  const teacherScope = {
    resolveActiveStaffId: staffFindFirst,
  } as unknown as TeacherScopeService;

  const service = new AcademicsService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    teacherScope,
  );

  return { service, findMany, staffFindFirst };
}

function actorFor(roles: string[], permissions: string[]) {
  return {
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    userId: 'user-teacher-1',
    email: 'teacher@school.test',
    roles,
    permissions,
    authMethod: AuthMethod.PASSWORD,
  };
}

describe('AcademicsService.listTeacherAssignments', () => {
  it('never selects sensitive staff columns, for any caller', async () => {
    const { service, findMany } = buildService();

    await service.listTeacherAssignments(
      actorFor(['admin'], ['academics:manage']),
    );

    const staffInclude = findMany.mock.calls[0][0].include.staff;
    expect(staffInclude).toEqual({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
      },
    });
    // `staff: true` would pull the whole row; assert it is not a bare boolean.
    expect(staffInclude).not.toBe(true);
    for (const field of SENSITIVE_STAFF_FIELDS) {
      expect(staffInclude.select[field]).toBeUndefined();
    }
  });

  it('scopes a teacher to their own assignments', async () => {
    const { service, findMany, staffFindFirst } = buildService();

    await service.listTeacherAssignments(
      actorFor(['teacher'], ['academics:read', 'academics:enter_marks']),
    );

    expect(staffFindFirst).toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        status: 'ACTIVE',
        staffId: 'staff-teacher-1',
      }),
    );
  });

  it('fails closed when a teacher has no active staff record', async () => {
    const { service, findMany, staffFindFirst } = buildService();
    staffFindFirst.mockResolvedValue(null);

    await service.listTeacherAssignments(
      actorFor(['teacher'], ['academics:read']),
    );

    // A sentinel staffId that matches nothing -- never an unscoped query.
    expect(findMany.mock.calls[0][0].where.staffId).toBe(
      '__no_active_staff_record__',
    );
  });

  it('still gives an academic administrator the whole school map', async () => {
    const { service, findMany, staffFindFirst } = buildService();

    await service.listTeacherAssignments(
      actorFor(['admin'], ['academics:read', 'academics:manage']),
    );

    expect(staffFindFirst).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', status: 'ACTIVE' }),
    );
  });

  it('gives a teacher who is also an academic administrator the full map', async () => {
    const { service, findMany } = buildService();

    await service.listTeacherAssignments(
      actorFor(['teacher'], ['academics:read', 'academics:update']),
    );

    expect(findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ tenantId: 'tenant-1', status: 'ACTIVE' }),
    );
  });
});

describe('AcademicsService.assignTeacher', () => {
  it('dual-writes an exact-section canonical assignment and compatibility row', async () => {
    const startsOn = new Date('2026-04-14T00:00:00.000Z');
    const endsOn = new Date('2027-04-13T00:00:00.000Z');
    const subjectTeacherCreate = jest.fn().mockResolvedValue({
      id: 'legacy-assignment-1',
    });
    const teacherAssignmentCreate = jest.fn().mockResolvedValue({
      id: 'assignment-1',
      subjectId: 'subject-1',
      staffId: 'staff-1',
      classId: 'class-1',
      sectionId: 'section-1',
    });
    const tx = {
      subjectTeacherAssignment: { create: subjectTeacherCreate },
      teacherAssignment: { create: teacherAssignmentCreate },
    };
    const prisma = {
      academicYear: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'year-1',
          startsOn,
          endsOn,
        }),
      },
      class: { findFirst: jest.fn().mockResolvedValue({ id: 'class-1' }) },
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }) },
      subject: { findFirst: jest.fn().mockResolvedValue({ id: 'subject-1' }) },
      section: {
        findFirst: jest.fn().mockResolvedValue({ id: 'section-1' }),
      },
      $transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new AcademicsService(
      prisma as never,
      {} as never,
      audit as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const actor = actorFor(['admin'], ['academics:update']);

    await service.assignTeacher(
      {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        staffId: 'staff-1',
      },
      actor,
    );

    expect(subjectTeacherCreate).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: 'subject-1',
        staffId: 'staff-1',
      },
    });
    expect(teacherAssignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: 'tenant-1',
          academicYearId: 'year-1',
          staffId: 'staff-1',
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
          componentScope: null,
          isPrimary: true,
          effectiveFrom: startsOn,
          effectiveUntil: endsOn,
          createdById: 'user-teacher-1',
        },
        include: expect.objectContaining({
          staff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
        }),
      }),
    );
  });
});

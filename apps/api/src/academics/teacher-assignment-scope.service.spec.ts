import { AuthMethod } from '@prisma/client';
import { AcademicsService } from './academics.service';

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
  const staffFindFirst = jest.fn().mockResolvedValue({ id: 'staff-teacher-1' });

  const prisma = {
    subjectTeacherAssignment: { findMany },
    staff: { findFirst: staffFindFirst },
  } as never;

  const service = new AcademicsService(
    prisma,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
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

    expect(staffFindFirst).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', userId: 'user-teacher-1' },
      select: { id: true },
    });
    expect(findMany.mock.calls[0][0].where).toEqual({
      tenantId: 'tenant-1',
      staffId: 'staff-teacher-1',
    });
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
    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-1' });
  });

  it('gives a teacher who is also an academic administrator the full map', async () => {
    const { service, findMany } = buildService();

    await service.listTeacherAssignments(
      actorFor(['teacher'], ['academics:read', 'academics:update']),
    );

    expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 'tenant-1' });
  });
});

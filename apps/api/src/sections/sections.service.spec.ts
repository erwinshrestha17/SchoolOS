import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  StaffStatus,
  TeacherAssignmentStatus,
  TeacherAssignmentType,
} from '@prisma/client';
import { createTeacherScopeServiceForTests } from '../../test/test-helpers';
import { TeacherCapability } from '../teacher-scope/teacher-capability';
import { TeacherScopeService } from '../teacher-scope/teacher-scope.service';
import { SectionsService } from './sections.service';

const teacherActor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-teacher',
  email: 'teacher@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['teacher'],
  permissions: ['sections:read'],
};

const adminActor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-admin',
  email: 'admin@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['sections:read', 'academics:update'],
};

const YEAR_START = new Date('2026-04-01T00:00:00.000Z');
const YEAR_END = new Date('2027-03-31T23:59:59.999Z');

type BuildServiceOptions = {
  sections?: unknown[];
  assignments?: unknown[];
  currentYear?: unknown | null;
  section?: unknown | null;
  staff?: unknown | null;
  priorActive?: unknown | null;
  existingAssignment?: unknown | null;
  transactionImpl?: (
    callback: (tx: unknown) => Promise<unknown>,
  ) => Promise<unknown>;
};

function buildService(options: BuildServiceOptions = {}) {
  const audit = { record: jest.fn() };
  const teacherScope = {
    resolveReadableScope: jest.fn().mockResolvedValue({
      assignments: options.assignments ?? [],
      homeroomSectionIds: new Set(),
      subjectsBySection: new Map(),
      allSectionIds: new Set(),
    }),
  };

  const tx = {
    teacherAssignment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.existingAssignment ?? null),
      update: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve({
          id: where.id,
          staffId: 'staff-2',
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
          status: TeacherAssignmentStatus.ACTIVE,
          staff: {
            id: 'staff-2',
            firstName: 'Sita',
            lastName: 'Sharma',
            employeeId: 'EMP-002',
          },
          class: { id: 'class-1', name: 'Grade 1' },
          section: { id: 'section-1', name: 'A' },
          academicYear: {
            id: 'year-1',
            name: '2083/84',
            startsOn: YEAR_START,
            endsOn: YEAR_END,
          },
        }),
      ),
      create: jest.fn().mockResolvedValue({
        id: 'assignment-new',
        staffId: 'staff-2',
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: null,
        status: TeacherAssignmentStatus.ACTIVE,
        staff: {
          id: 'staff-2',
          firstName: 'Sita',
          lastName: 'Sharma',
          employeeId: 'EMP-002',
        },
        class: { id: 'class-1', name: 'Grade 1' },
        section: { id: 'section-1', name: 'A' },
        academicYear: {
          id: 'year-1',
          name: '2083/84',
          startsOn: YEAR_START,
          endsOn: YEAR_END,
        },
      }),
    },
    section: {
      update: jest.fn().mockResolvedValue({ id: 'section-1' }),
    },
  };

  const prisma = {
    section: {
      findMany: jest.fn().mockResolvedValue(options.sections ?? []),
      findFirst: jest.fn().mockResolvedValue(options.section ?? null),
    },
    staff: {
      findFirst: jest.fn().mockResolvedValue(options.staff ?? null),
    },
    academicYear: {
      findFirst: jest.fn().mockResolvedValue(options.currentYear ?? null),
    },
    teacherAssignment: {
      findFirst: jest.fn().mockResolvedValue(options.priorActive ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest
      .fn()
      .mockImplementation(
        options.transactionImpl ??
          ((callback: (innerTx: typeof tx) => Promise<unknown>) =>
            callback(tx)),
      ),
  };

  const service = new SectionsService(
    prisma as never,
    audit as never,
    teacherScope as never,
  );

  return { service, prisma, audit, tx, teacherScope };
}

function buildSection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'section-1',
    name: 'A',
    capacity: 40,
    classTeacherId: null,
    classId: 'class-1',
    class: { id: 'class-1', name: 'Grade 1' },
    _count: { students: 28 },
    teacherAssignmentRecords: [],
    ...overrides,
  };
}

describe('SectionsService.listSections', () => {
  it('flags the sections where the caller is the class teacher', async () => {
    const { service } = buildService({
      sections: [buildSection({ id: 'section-1', classTeacherId: 'staff-9' })],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections).toEqual([
      expect.objectContaining({
        id: 'section-1',
        isAssignedClassTeacher: true,
      }),
    ]);
  });

  it('flags subject-teaching sections from canonical assignments', async () => {
    const { service } = buildService({
      sections: [
        buildSection({ id: 'section-1', classId: 'class-1' }),
        buildSection({ id: 'section-2', classId: 'class-2' }),
        buildSection({ id: 'section-3', classId: 'class-3' }),
      ],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'subject-1',
        },
        {
          assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
          classId: 'class-2',
          sectionId: 'section-2',
          subjectId: 'subject-1',
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections.map((s) => s.isAssignedSubjectTeacher)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('returns no tenant-wide sections for a teacher without an active assignment', async () => {
    const { service, prisma } = buildService({
      sections: [],
      assignments: [],
    });

    const sections = await service.listSections(teacherActor);

    expect(prisma.section.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: teacherActor.tenantId,
        id: { in: ['__no_teacher_sections__'] },
      },
      include: expect.any(Object),
      orderBy: [{ class: { level: 'asc' } }, { name: 'asc' }],
    });
    expect(sections).toEqual([]);
  });

  it('includes a flat classId alongside the nested class object', async () => {
    const { service } = buildService({
      sections: [buildSection({ id: 'section-1', classId: 'class-1' })],
      assignments: [
        {
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
        },
      ],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections[0].classId).toBe('class-1');
  });

  it('omits classTeacher for teacher-only actors', async () => {
    const { service } = buildService({
      sections: [buildSection()],
      assignments: [],
    });

    const sections = await service.listSections(teacherActor);

    expect(sections[0]).not.toHaveProperty('classTeacher');
  });

  it('includes classTeacher for administrative actors', async () => {
    const { service } = buildService({
      currentYear: { id: 'year-1' },
      sections: [
        buildSection({
          teacherAssignmentRecords: [
            {
              staff: {
                id: 'staff-1',
                firstName: 'Ramesh',
                lastName: 'Gurung',
                employeeId: 'EMP-001',
              },
            },
          ],
        }),
      ],
    });

    const sections = await service.listSections(adminActor);

    expect(sections[0].classTeacher).toEqual({
      id: 'staff-1',
      firstName: 'Ramesh',
      lastName: 'Gurung',
      employeeId: 'EMP-001',
    });
  });
});

describe('SectionsService.assignClassTeacher (DEF-04)', () => {
  const section = {
    id: 'section-1',
    classId: 'class-1',
    class: { id: 'class-1', name: 'Grade 1' },
  };
  const staff = {
    id: 'staff-2',
    status: StaffStatus.ACTIVE,
  };
  const currentYear = {
    id: 'year-1',
    startsOn: YEAR_START,
    endsOn: YEAR_END,
  };

  it('creates an ACTIVE CLASS_TEACHER row and dual-writes Section.classTeacherId', async () => {
    const { service, tx, audit } = buildService({
      section,
      staff,
      currentYear,
      priorActive: null,
      existingAssignment: null,
    });

    const result = await service.assignClassTeacher(
      'section-1',
      { staffId: 'staff-2' },
      adminActor,
    );

    expect(tx.teacherAssignment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: adminActor.tenantId,
        academicYearId: 'year-1',
        staffId: 'staff-2',
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        classId: 'class-1',
        sectionId: 'section-1',
        subjectId: null,
        componentScope: null,
        isPrimary: true,
        effectiveFrom: YEAR_START,
        effectiveUntil: YEAR_END,
        createdById: adminActor.userId,
      }),
      include: expect.any(Object),
    });
    expect(tx.section.update).toHaveBeenCalledWith({
      where: { id: 'section-1' },
      data: { classTeacherId: 'staff-2' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'assign_class_teacher',
        resource: 'teacher_assignment',
        after: expect.objectContaining({
          staffId: 'staff-2',
          sectionId: 'section-1',
        }),
      }),
    );
    expect(result.id).toBe('assignment-new');
  });

  it('revokes the prior active class teacher when reassigning', async () => {
    const { service, tx } = buildService({
      section,
      staff,
      currentYear,
      priorActive: { staffId: 'staff-1' },
      existingAssignment: null,
    });

    await service.assignClassTeacher(
      'section-1',
      { staffId: 'staff-2' },
      adminActor,
    );

    expect(tx.teacherAssignment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: adminActor.tenantId,
        academicYearId: 'year-1',
        sectionId: 'section-1',
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        status: TeacherAssignmentStatus.ACTIVE,
        staffId: { not: 'staff-2' },
      }),
      data: expect.objectContaining({
        status: TeacherAssignmentStatus.REVOKED,
        revokedById: adminActor.userId,
      }),
    });
  });

  it('reactivates a previously revoked row instead of creating a duplicate', async () => {
    const { service, tx } = buildService({
      section,
      staff,
      currentYear,
      priorActive: { staffId: 'staff-1' },
      existingAssignment: {
        id: 'assignment-existing',
        staffId: 'staff-2',
        status: TeacherAssignmentStatus.REVOKED,
      },
    });

    await service.assignClassTeacher(
      'section-1',
      { staffId: 'staff-2' },
      adminActor,
    );

    expect(tx.teacherAssignment.update).toHaveBeenCalledWith({
      where: { id: 'assignment-existing' },
      data: expect.objectContaining({
        status: TeacherAssignmentStatus.ACTIVE,
        revokedById: null,
        revokedAt: null,
      }),
      include: expect.any(Object),
    });
    expect(tx.teacherAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects inactive staff', async () => {
    const { service } = buildService({
      section,
      staff: { id: 'staff-2', status: StaffStatus.INACTIVE },
      currentYear,
    });

    await expect(
      service.assignClassTeacher(
        'section-1',
        { staffId: 'staff-2' },
        adminActor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects assignment when no current academic year exists', async () => {
    const { service } = buildService({
      section,
      staff,
      currentYear: null,
    });

    await expect(
      service.assignClassTeacher(
        'section-1',
        { staffId: 'staff-2' },
        adminActor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects unknown sections', async () => {
    const { service } = buildService({
      section: null,
    });

    await expect(
      service.assignClassTeacher(
        'missing-section',
        { staffId: 'staff-2' },
        adminActor,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SectionsService.removeClassTeacher (DEF-04)', () => {
  const section = {
    id: 'section-1',
    classId: 'class-1',
  };
  const currentYear = {
    id: 'year-1',
    startsOn: YEAR_START,
    endsOn: YEAR_END,
  };

  it('revokes active rows and clears Section.classTeacherId', async () => {
    const { service, tx, audit } = buildService({
      section,
      currentYear,
      priorActive: { id: 'assignment-1', staffId: 'staff-1' },
    });

    const result = await service.removeClassTeacher(
      'section-1',
      undefined,
      adminActor,
    );

    expect(tx.teacherAssignment.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        sectionId: 'section-1',
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        status: TeacherAssignmentStatus.ACTIVE,
      }),
      data: expect.objectContaining({
        status: TeacherAssignmentStatus.REVOKED,
        revokedById: adminActor.userId,
      }),
    });
    expect(tx.section.update).toHaveBeenCalledWith({
      where: { id: 'section-1' },
      data: { classTeacherId: null },
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'unassign_class_teacher',
        before: { staffId: 'staff-1' },
      }),
    );
    expect(result).toEqual({ removed: true, sectionId: 'section-1' });
  });

  it('throws when no active class teacher exists', async () => {
    const { service } = buildService({
      section,
      currentYear,
      priorActive: null,
    });

    await expect(
      service.removeClassTeacher('section-1', undefined, adminActor),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('DEF-04 class-teacher assignment grants homeroom attendance write', () => {
  it('rows shaped like assignClassTeacher writes grant HOMEROOM_ATTENDANCE_MARK', async () => {
    const deps = createTeacherScopeServiceForTests({
      assignments: [
        {
          id: 'assignment-1',
          tenantId: 'tenant-1',
          academicYearId: 'year-1',
          staffId: 'staff-1',
          assignmentType: TeacherAssignmentType.CLASS_TEACHER,
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: null,
          componentScope: null,
          isPrimary: true,
          effectiveFrom: YEAR_START,
          effectiveUntil: YEAR_END,
          status: TeacherAssignmentStatus.ACTIVE,
        },
      ],
      staffId: 'staff-1',
    });
    const teacherScopeService = new TeacherScopeService(
      deps.prisma as never,
      deps.audit as never,
    );

    const grant = await teacherScopeService.canActorAccess(
      {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        capability: TeacherCapability.HOMEROOM_ATTENDANCE_MARK,
      },
      {
        tenantId: 'tenant-1',
        tenantSlug: 'tenant-one',
        userId: 'user-teacher',
        email: 'teacher@schoolos.test',
        authMethod: AuthMethod.PASSWORD,
        roles: ['teacher'],
        permissions: ['attendance:mark'],
      },
    );

    expect(grant).toEqual(
      expect.objectContaining({
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        assignmentId: 'assignment-1',
        source: 'ASSIGNMENT',
      }),
    );
  });
});

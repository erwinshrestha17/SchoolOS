import { ForbiddenException } from '@nestjs/common';
import { TeacherAssignmentType } from '@prisma/client';
import { TeacherScopeService } from '../src/teacher-scope/teacher-scope.service';
import { TeacherCapability } from '../src/teacher-scope/teacher-capability';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';

interface FakeAssignment {
  id: string;
  tenantId: string;
  staffId: string;
  academicYearId: string;
  assignmentType: string;
  classId: string;
  sectionId: string;
  subjectId: string | null;
  componentScope: string | null;
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
}

interface FakeDelegation {
  id: string;
  tenantId: string;
  recipientStaffId: string;
  classId: string;
  sectionId: string;
  subjectId: string | null;
  componentScope: string | null;
  allowedCapabilities: string[];
  status: string;
  effectiveFrom: Date;
  effectiveUntil: Date;
}

/**
 * Hand-rolled fake reproducing just enough of Prisma's findMany semantics
 * (equality filters, `in`, `lte`/`gte`, `OR`) for the exact shape of query
 * TeacherScopeService issues -- not a general query engine.
 */
function makeFakePrisma(
  assignments: FakeAssignment[],
  delegations: FakeDelegation[],
) {
  return {
    staff: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.status && where.status !== 'ACTIVE') return null;
        return { id: `staff-for-${where.userId}` };
      }),
    },
    teacherAssignment: {
      findMany: jest.fn(async ({ where }: any) => {
        const now = new Date();
        return assignments.filter((a) => {
          if (a.tenantId !== where.tenantId) return false;
          if (a.staffId !== where.staffId) return false;
          if (a.academicYearId !== where.academicYearId) return false;
          if (a.classId !== where.classId) return false;
          if (a.sectionId !== where.sectionId) return false;
          if (a.status !== where.status) return false;
          if (!where.assignmentType.in.includes(a.assignmentType)) return false;
          if (a.effectiveFrom > now) return false;
          if (a.effectiveUntil !== null && a.effectiveUntil < now) return false;
          return true;
        });
      }),
    },
    teacherDelegation: {
      findMany: jest.fn(async ({ where }: any) => {
        const now = new Date();
        return delegations.filter((d) => {
          if (d.tenantId !== where.tenantId) return false;
          if (d.recipientStaffId !== where.recipientStaffId) return false;
          if (d.classId !== where.classId) return false;
          if (d.sectionId !== where.sectionId) return false;
          if (d.status !== where.status) return false;
          if (d.effectiveFrom > now) return false;
          if (d.effectiveUntil < now) return false;
          return true;
        });
      }),
    },
  };
}

function makeService(
  assignments: FakeAssignment[],
  delegations: FakeDelegation[] = [],
) {
  const prisma = makeFakePrisma(assignments, delegations);
  const auditService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new TeacherScopeService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
  );
  return { service, prisma, auditService };
}

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const YEAR = 'year-2083';
const CLASS_1 = 'class-1';
const SECTION_A = 'section-a';
const SECTION_B = 'section-b';
const SUBJECT_MATH = 'subject-math';
const SUBJECT_ENGLISH = 'subject-english';
const YESTERDAY = new Date(Date.now() - 24 * 60 * 60 * 1000);
const TOMORROW = new Date(Date.now() + 24 * 60 * 60 * 1000);
const LAST_WEEK = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function subjectAssignment(
  overrides: Partial<FakeAssignment> = {},
): FakeAssignment {
  return {
    id: 'assignment-1',
    tenantId: TENANT_A,
    staffId: 'staff-1',
    academicYearId: YEAR,
    assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
    classId: CLASS_1,
    sectionId: SECTION_A,
    subjectId: SUBJECT_MATH,
    componentScope: null,
    status: 'ACTIVE',
    effectiveFrom: YESTERDAY,
    effectiveUntil: TOMORROW,
    ...overrides,
  };
}

describe('TeacherScopeService authorization (Teacher Persona acceptance criteria)', () => {
  it('grants access to the exact assigned class/section/subject', async () => {
    const { service } = makeService([subjectAssignment()]);
    const grant = await service.requireAccess({
      tenantId: TENANT_A,
      staffId: 'staff-1',
      academicYearId: YEAR,
      classId: CLASS_1,
      sectionId: SECTION_A,
      subjectId: SUBJECT_MATH,
      capability: TeacherCapability.MARKS_ENTER,
    });
    expect(grant.source).toBe('ASSIGNMENT');
  });

  it('denies a Subject Teacher accessing a section they are not assigned to', async () => {
    const { service } = makeService([subjectAssignment()]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_B,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a Subject Teacher grading an unrelated subject in their own section', async () => {
    const { service } = makeService([subjectAssignment()]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_ENGLISH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a Class Teacher (no subject assignment) from grading any subject', async () => {
    const { service } = makeService([
      subjectAssignment({
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        subjectId: null,
      }),
    ]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a Class Teacher to mark homeroom attendance without a subject', async () => {
    const { service } = makeService([
      subjectAssignment({
        assignmentType: TeacherAssignmentType.CLASS_TEACHER,
        subjectId: null,
      }),
    ]);
    const grant = await service.requireAccess({
      tenantId: TENANT_A,
      staffId: 'staff-1',
      academicYearId: YEAR,
      classId: CLASS_1,
      sectionId: SECTION_A,
      capability: TeacherCapability.HOMEROOM_ATTENDANCE_MARK,
    });
    expect(grant.source).toBe('ASSIGNMENT');
  });

  it('denies a PRACTICAL-only teacher from writing THEORY marks', async () => {
    const { service } = makeService([
      subjectAssignment({ componentScope: 'PRACTICAL' as any }),
    ]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        componentType: 'THEORY' as any,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a PRACTICAL-only teacher to write PRACTICAL marks', async () => {
    const { service } = makeService([
      subjectAssignment({ componentScope: 'PRACTICAL' as any }),
    ]);
    const grant = await service.requireAccess({
      tenantId: TENANT_A,
      staffId: 'staff-1',
      academicYearId: YEAR,
      classId: CLASS_1,
      sectionId: SECTION_A,
      subjectId: SUBJECT_MATH,
      componentType: 'PRACTICAL' as any,
      capability: TeacherCapability.MARKS_ENTER,
    });
    expect(grant.componentScope).toBe('PRACTICAL');
  });

  it('an ALL_COMPONENTS assignment covers every component type', async () => {
    const { service } = makeService([
      subjectAssignment({ componentScope: 'ALL_COMPONENTS' as any }),
    ]);
    for (const componentType of [
      'THEORY',
      'PRACTICAL',
      'INTERNAL',
      'PROJECT',
    ]) {
      await expect(
        service.requireAccess({
          tenantId: TENANT_A,
          staffId: 'staff-1',
          academicYearId: YEAR,
          classId: CLASS_1,
          sectionId: SECTION_A,
          subjectId: SUBJECT_MATH,
          componentType: componentType as any,
          capability: TeacherCapability.MARKS_ENTER,
        }),
      ).resolves.toBeDefined();
    }
  });

  it('revoking an assignment (status != ACTIVE) immediately removes access', async () => {
    const { service } = makeService([subjectAssignment({ status: 'REVOKED' })]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('an assignment past its effectiveUntil date no longer grants access', async () => {
    const { service } = makeService([
      subjectAssignment({
        effectiveFrom: LAST_WEEK,
        effectiveUntil: YESTERDAY,
      }),
    ]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('an assignment that has not started yet (effectiveFrom in the future) does not grant access', async () => {
    const { service } = makeService([
      subjectAssignment({ effectiveFrom: TOMORROW, effectiveUntil: null }),
    ]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('cross-tenant assignment never grants access when checked under another tenant', async () => {
    const { service } = makeService([
      subjectAssignment({ tenantId: TENANT_A }),
    ]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_B,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('manipulated class/section ids on an otherwise-valid staff return a generic 403, not a different error', async () => {
    const { service } = makeService([subjectAssignment()]);
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'staff-1',
        academicYearId: YEAR,
        classId: 'someone-elses-class',
        sectionId: 'someone-elses-section',
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow('You are not authorized for this teaching scope');
  });

  it('a delegation grants only its explicitly listed capabilities', async () => {
    const { service } = makeService(
      [],
      [
        {
          id: 'delegation-1',
          tenantId: TENANT_A,
          recipientStaffId: 'substitute-1',
          classId: CLASS_1,
          sectionId: SECTION_A,
          subjectId: SUBJECT_MATH,
          componentScope: null,
          allowedCapabilities: [TeacherCapability.MARKS_ENTER],
          status: 'ACTIVE',
          effectiveFrom: YESTERDAY,
          effectiveUntil: TOMORROW,
        },
      ],
    );

    const grant = await service.requireAccess({
      tenantId: TENANT_A,
      staffId: 'substitute-1',
      academicYearId: YEAR,
      classId: CLASS_1,
      sectionId: SECTION_A,
      subjectId: SUBJECT_MATH,
      capability: TeacherCapability.MARKS_ENTER,
    });
    expect(grant.source).toBe('DELEGATION');

    // Not delegated the SUBMIT capability -- must not be granted implicitly.
    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'substitute-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_SUBMIT,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('an expired delegation (effectiveUntil in the past) no longer grants access', async () => {
    const { service } = makeService(
      [],
      [
        {
          id: 'delegation-2',
          tenantId: TENANT_A,
          recipientStaffId: 'substitute-1',
          classId: CLASS_1,
          sectionId: SECTION_A,
          subjectId: SUBJECT_MATH,
          componentScope: null,
          allowedCapabilities: [TeacherCapability.MARKS_ENTER],
          status: 'ACTIVE',
          effectiveFrom: LAST_WEEK,
          effectiveUntil: YESTERDAY,
        },
      ],
    );

    await expect(
      service.requireAccess({
        tenantId: TENANT_A,
        staffId: 'substitute-1',
        academicYearId: YEAR,
        classId: CLASS_1,
        sectionId: SECTION_A,
        subjectId: SUBJECT_MATH,
        capability: TeacherCapability.MARKS_ENTER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('records an audit entry on denial without revealing why', async () => {
    const { service, auditService } = makeService([subjectAssignment()]);
    await expect(
      service.requireAccess(
        {
          tenantId: TENANT_A,
          staffId: 'staff-1',
          academicYearId: YEAR,
          classId: CLASS_1,
          sectionId: SECTION_B,
          subjectId: SUBJECT_MATH,
          capability: TeacherCapability.MARKS_ENTER,
        },
        {
          userId: 'user-1',
          tenantId: TENANT_A,
          tenantSlug: TENANT_A,
          email: 'teacher@test.com',
          authMethod: 'PASSWORD' as any,
          roles: ['subject_teacher'],
          permissions: [],
        },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'teacher_scope.denied',
        tenantId: TENANT_A,
      }),
    );
  });

  it('resolveActiveStaffId returns null for an inactive/deactivated staff member', async () => {
    const prisma = {
      staff: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new TeacherScopeService(
      prisma as unknown as PrismaService,
      { record: jest.fn() } as unknown as AuditService,
    );
    const staffId = await service.resolveActiveStaffId({
      tenantId: TENANT_A,
      userId: 'deactivated-user',
    } as any);
    expect(staffId).toBeNull();
  });
});

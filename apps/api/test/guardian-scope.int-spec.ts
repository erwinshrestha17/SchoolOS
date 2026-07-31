import 'dotenv/config';
import { ForbiddenException } from '@nestjs/common';
import { GuardianCapability } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import {
  getParentStudentIds,
  requireGuardianCapability,
} from '../src/common/security/parent-scope';
import type { AuthContext } from '../src/auth/auth.types';

/**
 * P0-01 guardian relationship matrix, against a real database.
 *
 * `requireGuardianCapability` is the single choke point protecting every
 * parent-facing read, and its guarantee depends on a compound Prisma predicate
 * (status + verification + approval + effective dates + capability array +
 * tenant). Mocked suites can only assert that the predicate was *passed*; this
 * suite asserts that Postgres actually *evaluates* it the way the model claims.
 *
 * Requires the local database (docker compose: schoolos_postgres on 5433).
 * Run with: pnpm test:integration
 */

class FakeCls {
  private readonly store = new Map<string, unknown>();
  setTenant(tenantId: string | undefined) {
    this.store.set(TENANT_ID_KEY, tenantId);
  }
  get(key: string) {
    return this.store.get(key);
  }
  set(key: string, value: unknown) {
    this.store.set(key, value);
  }
  isActive() {
    return true;
  }
  async run<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

const SUFFIX = `p0-01-guard-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

describe('P0-01 guardian scoping (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let classAId: string;
  let classBId: string;

  // tenant A
  let childOneId: string;
  let childTwoId: string;
  let unrelatedChildId: string;
  let parentUserId: string;
  // tenant B
  let foreignChildId: string;
  let foreignParentUserId: string;

  const linkIds: Record<string, string> = {};

  const parentActor = (): AuthContext =>
    ({
      tenantId: tenantAId,
      userId: parentUserId,
      roles: ['parent'],
      permissions: [],
    }) as unknown as AuthContext;

  async function makeStudent(
    tenantId: string,
    classId: string,
    academicYearId: string,
    label: string,
  ) {
    // getParentStudentIds requires lifecycleStatus ACTIVE *and* an ACTIVE
    // enrollment, so a student without enrollment is invisible to parents.
    return prisma.student.create({
      data: {
        tenantId,
        classId,
        studentSystemId: `${label}-${SUFFIX}`,
        firstNameEn: label,
        lastNameEn: SUFFIX,
        dateOfBirth: new Date('2015-01-01'),
        gender: 'MALE',
        admissionDate: new Date('2024-01-01'),
        enrollments: {
          create: {
            tenantId,
            academicYearId,
            classId,
            admissionDate: new Date('2024-01-01'),
            mediumOfInstruction: 'English',
            status: 'ACTIVE',
            effectiveFrom: new Date('2024-01-01'),
          },
        },
      },
    });
  }

  /** Fully valid link unless overridden. */
  async function link(
    tenantId: string,
    guardianId: string,
    studentId: string,
    key: string,
    overrides: Record<string, unknown> = {},
  ) {
    const row = await prisma.studentGuardian.create({
      data: {
        tenantId,
        guardianId,
        studentId,
        relation: 'FATHER',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        approvalStatus: 'APPROVED',
        effectiveFrom: new Date(Date.now() - DAY),
        capabilities: [
          GuardianCapability.ACADEMICS_VIEW,
          GuardianCapability.ATTENDANCE_VIEW,
        ],
        ...overrides,
      },
    });
    linkIds[key] = row.id;
    return row;
  }

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);
    cls.setTenant(undefined);

    // Fixtures deliberately span two tenants, so setup is one explicit
    // cross-tenant region; every row still passes its tenantId explicitly.
    await prisma.runWithoutTenantScope(
      'integration fixture setup across two tenants',
      () => seedFixtures(),
    );

    cls.setTenant(tenantAId);
  });

  async function seedFixtures() {
    const [tenantA, tenantB] = await Promise.all([
      prisma.tenant.create({
        data: { name: `GA ${SUFFIX}`, slug: `ga-${SUFFIX}` },
      }),
      prisma.tenant.create({
        data: { name: `GB ${SUFFIX}`, slug: `gb-${SUFFIX}` },
      }),
    ]);
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [userA, userB] = await Promise.all([
      prisma.user.create({
        data: {
          tenantId: tenantAId,
          email: `parent-a-${SUFFIX}@example.test`,
          passwordHash: 'x',
        },
      }),
      prisma.user.create({
        data: {
          tenantId: tenantBId,
          email: `parent-b-${SUFFIX}@example.test`,
          passwordHash: 'x',
        },
      }),
    ]);
    parentUserId = userA.id;
    foreignParentUserId = userB.id;

    const cA = await prisma.class.create({
      data: { tenantId: tenantAId, name: `GC-A ${SUFFIX}`, level: 1 },
    });
    classAId = cA.id;
    const yearA = await prisma.academicYear.create({
      data: {
        tenantId: tenantAId,
        name: `YA ${SUFFIX}`,
        startsOn: new Date('2024-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    });

    const guardianA = await prisma.guardian.create({
      data: {
        tenantId: tenantAId,
        userId: parentUserId,
        fullName: `Parent A ${SUFFIX}`,
        relation: 'FATHER',
        primaryPhone: '9800000001',
      },
    });

    const [c1, c2, c3] = await Promise.all([
      makeStudent(tenantAId, classAId, yearA.id, 'ChildOne'),
      makeStudent(tenantAId, classAId, yearA.id, 'ChildTwo'),
      makeStudent(tenantAId, classAId, yearA.id, 'Unrelated'),
    ]);
    childOneId = c1.id;
    childTwoId = c2.id;
    unrelatedChildId = c3.id;

    // ChildOne: fully valid. ChildTwo: valid but WITHOUT AttendanceView.
    await link(tenantAId, guardianA.id, childOneId, 'childOne');
    await link(tenantAId, guardianA.id, childTwoId, 'childTwo', {
      capabilities: [GuardianCapability.ACADEMICS_VIEW],
    });

    const cB = await prisma.class.create({
      data: { tenantId: tenantBId, name: `GC-B ${SUFFIX}`, level: 1 },
    });
    classBId = cB.id;
    const yearB = await prisma.academicYear.create({
      data: {
        tenantId: tenantBId,
        name: `YB ${SUFFIX}`,
        startsOn: new Date('2024-01-01'),
        endsOn: new Date('2026-12-31'),
      },
    });

    const guardianB = await prisma.guardian.create({
      data: {
        tenantId: tenantBId,
        userId: foreignParentUserId,
        fullName: `Parent B ${SUFFIX}`,
        relation: 'MOTHER',
        primaryPhone: '9800000002',
      },
    });
    const fc = await makeStudent(tenantBId, classBId, yearB.id, 'ForeignChild');
    foreignChildId = fc.id;
    await link(tenantBId, guardianB.id, foreignChildId, 'foreign');
  }

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('teardown', async () => {
      await prisma.studentGuardian.deleteMany({
        where: { student: { lastNameEn: SUFFIX } },
      });
      await prisma.enrollment.deleteMany({
        where: { student: { lastNameEn: SUFFIX } },
      });
      await prisma.student.deleteMany({ where: { lastNameEn: SUFFIX } });
      await prisma.academicYear.deleteMany({
        where: { name: { contains: SUFFIX } },
      });
      await prisma.guardian.deleteMany({
        where: { fullName: { contains: SUFFIX } },
      });
      await prisma.class.deleteMany({ where: { name: { contains: SUFFIX } } });
      await prisma.user.deleteMany({
        where: { email: { contains: SUFFIX } },
      });
      await prisma.tenant.deleteMany({
        where: { slug: { contains: SUFFIX } },
      });
    });
    await prisma.$disconnect();
  });

  /** Restore a link to the fully-valid baseline between cases. */
  async function resetChildOne(overrides: Record<string, unknown> = {}) {
    cls.setTenant(tenantAId);
    await prisma.studentGuardian.update({
      where: { id: linkIds.childOne },
      data: {
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        approvalStatus: 'APPROVED',
        effectiveFrom: new Date(Date.now() - DAY),
        effectiveUntil: null,
        capabilities: [
          GuardianCapability.ACADEMICS_VIEW,
          GuardianCapability.ATTENDANCE_VIEW,
        ],
        ...overrides,
      },
    });
  }

  beforeEach(async () => {
    await resetChildOne();
  });

  describe('valid relationship', () => {
    it('grants access to a linked child for a held capability', async () => {
      const rel = await requireGuardianCapability(
        prisma,
        parentActor(),
        childOneId,
        GuardianCapability.ACADEMICS_VIEW,
      );

      expect(rel.studentId).toBe(childOneId);
    });

    it('lists exactly the linked children, excluding unrelated students', async () => {
      const ids = await getParentStudentIds(prisma, parentActor());

      expect(ids).not.toBeNull();
      expect([...(ids as string[])].sort()).toEqual(
        [childOneId, childTwoId].sort(),
      );
      expect(ids).not.toContain(unrelatedChildId);
    });
  });

  describe('capability enforcement', () => {
    it('denies a capability the relationship does not carry', async () => {
      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          childTwoId,
          GuardianCapability.ATTENDANCE_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('filters the child list by the requested capability', async () => {
      const ids = await getParentStudentIds(
        prisma,
        parentActor(),
        GuardianCapability.ATTENDANCE_VIEW,
      );

      expect(ids).toEqual([childOneId]);
    });
  });

  describe('relationship state', () => {
    it.each([
      ['SUSPENDED', { status: 'SUSPENDED' }],
      ['REVOKED', { status: 'REVOKED' }],
      ['EXPIRED', { status: 'EXPIRED' }],
      ['UNVERIFIED', { verificationStatus: 'UNVERIFIED' }],
      ['PENDING approval', { approvalStatus: 'PENDING' }],
      ['REJECTED approval', { approvalStatus: 'REJECTED' }],
    ])('denies access when the relationship is %s', async (_label, patch) => {
      await resetChildOne(patch);

      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('effective dating', () => {
    it('denies access before effectiveFrom', async () => {
      await resetChildOne({ effectiveFrom: new Date(Date.now() + DAY) });

      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies access after effectiveUntil has passed', async () => {
      await resetChildOne({ effectiveUntil: new Date(Date.now() - 1000) });

      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('still grants access while effectiveUntil is in the future', async () => {
      await resetChildOne({ effectiveUntil: new Date(Date.now() + DAY) });

      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).resolves.toMatchObject({ studentId: childOneId });
    });
  });

  describe('student-id tampering and cross-tenant', () => {
    it('denies an unrelated student in the same tenant', async () => {
      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          unrelatedChildId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("denies another tenant's child even with a real student id", async () => {
      await expect(
        requireGuardianCapability(
          prisma,
          parentActor(),
          foreignChildId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies a foreign parent claiming this tenant', async () => {
      const spoofed = {
        tenantId: tenantAId,
        userId: foreignParentUserId,
        roles: ['parent'],
        permissions: [],
      } as unknown as AuthContext;

      await expect(
        requireGuardianCapability(
          prisma,
          spoofed,
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns no children for a parent with no guardian record', async () => {
      const orphan = {
        tenantId: tenantAId,
        userId: 'no-such-user',
        roles: ['parent'],
        permissions: [],
      } as unknown as AuthContext;

      await expect(getParentStudentIds(prisma, orphan)).resolves.toEqual([]);
    });
  });

  describe('non-parent actors', () => {
    it('denies a staff actor the guardian path entirely', async () => {
      const staff = {
        tenantId: tenantAId,
        userId: parentUserId,
        roles: ['teacher'],
        permissions: [],
      } as unknown as AuthContext;

      await expect(
        requireGuardianCapability(
          prisma,
          staff,
          childOneId,
          GuardianCapability.ACADEMICS_VIEW,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('applies no student restriction to non-parent actors', async () => {
      const admin = {
        tenantId: tenantAId,
        userId: 'admin-user',
        roles: ['admin'],
        permissions: [],
      } as unknown as AuthContext;

      await expect(getParentStudentIds(prisma, admin)).resolves.toBeNull();
    });
  });
});

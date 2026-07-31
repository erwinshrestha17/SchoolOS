import 'dotenv/config';
import { TeacherAssignmentType } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, TENANT_ID_KEY } from '../src/prisma/prisma.service';
import { TeacherScopeService } from '../src/teacher-scope/teacher-scope.service';
import { TeacherCapability } from '../src/teacher-scope/teacher-capability';
import type { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';

/**
 * P0-01 teacher assignment matrix, against a real database.
 *
 * The existing `teacher-scope-authorization.e2e-spec.ts` runs against a
 * hand-rolled fake that documents itself as "not a general query engine", so it
 * proves the service's branching but not that Postgres agrees with the
 * assignment predicate (tenant + year + class + section + subject + status +
 * effective dates). This suite exercises the real query path.
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

const SUFFIX = `p0-01-ta-${Date.now()}`;
const DAY = 24 * 60 * 60 * 1000;

describe('P0-01 teacher assignment scoping (real database)', () => {
  const cls = new FakeCls();
  let prisma: PrismaService;
  let service: TeacherScopeService;

  let tenantAId: string;
  let tenantBId: string;
  let yearAId: string;
  let classAId: string;
  let sectionAId: string;
  let sectionOtherId: string;
  let classOtherId: string;
  let subjectMathId: string;
  let subjectSciId: string;
  let teacherUserId: string;
  let teacherStaffId: string;
  let assignmentId: string;

  const teacherActor = (): AuthContext =>
    ({
      tenantId: tenantAId,
      userId: teacherUserId,
      roles: ['teacher'],
      permissions: [],
    }) as unknown as AuthContext;

  const audit = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  beforeAll(async () => {
    prisma = new PrismaService(cls as unknown as ClsService);
    service = new TeacherScopeService(prisma, audit);

    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope(
      'integration fixture setup across two tenants',
      async () => {
        const [tenantA, tenantB] = await Promise.all([
          prisma.tenant.create({
            data: { name: `TA ${SUFFIX}`, slug: `ta-${SUFFIX}` },
          }),
          prisma.tenant.create({
            data: { name: `TB ${SUFFIX}`, slug: `tb-${SUFFIX}` },
          }),
        ]);
        tenantAId = tenantA.id;
        tenantBId = tenantB.id;

        const user = await prisma.user.create({
          data: {
            tenantId: tenantAId,
            email: `teacher-${SUFFIX}@example.test`,
            passwordHash: 'x',
          },
        });
        teacherUserId = user.id;

        const staff = await prisma.staff.create({
          data: {
            tenantId: tenantAId,
            userId: teacherUserId,
            employeeId: `EMP-${SUFFIX}`,
            firstName: 'Tara',
            lastName: SUFFIX,
            dateOfBirth: new Date('1990-01-01'),
            gender: 'FEMALE',
            address: 'Kathmandu',
            joiningDate: new Date('2024-01-01'),
            contractType: 'PERMANENT',
            status: 'ACTIVE',
          },
        });
        teacherStaffId = staff.id;

        const year = await prisma.academicYear.create({
          data: {
            tenantId: tenantAId,
            name: `YR ${SUFFIX}`,
            startsOn: new Date('2024-01-01'),
            endsOn: new Date('2026-12-31'),
          },
        });
        yearAId = year.id;

        const [cls1, cls2] = await Promise.all([
          prisma.class.create({
            data: { tenantId: tenantAId, name: `TC-1 ${SUFFIX}`, level: 5 },
          }),
          prisma.class.create({
            data: { tenantId: tenantAId, name: `TC-2 ${SUFFIX}`, level: 6 },
          }),
        ]);
        classAId = cls1.id;
        classOtherId = cls2.id;

        const [sec1, sec2] = await Promise.all([
          prisma.section.create({
            data: { tenantId: tenantAId, classId: classAId, name: `A${SUFFIX}` },
          }),
          prisma.section.create({
            data: { tenantId: tenantAId, classId: classAId, name: `B${SUFFIX}` },
          }),
        ]);
        sectionAId = sec1.id;
        sectionOtherId = sec2.id;

        const [math, sci] = await Promise.all([
          prisma.subject.create({
            data: {
              tenantId: tenantAId,
              classId: classAId,
              name: `Math ${SUFFIX}`,
              code: `MATH-${SUFFIX}`,
              type: 'COMPULSORY',
            },
          }),
          prisma.subject.create({
            data: {
              tenantId: tenantAId,
              classId: classAId,
              name: `Sci ${SUFFIX}`,
              code: `SCI-${SUFFIX}`,
              type: 'COMPULSORY',
            },
          }),
        ]);
        subjectMathId = math.id;
        subjectSciId = sci.id;

        const assignment = await prisma.teacherAssignment.create({
          data: {
            tenantId: tenantAId,
            academicYearId: yearAId,
            staffId: teacherStaffId,
            assignmentType: TeacherAssignmentType.SUBJECT_TEACHER,
            classId: classAId,
            sectionId: sectionAId,
            subjectId: subjectMathId,
            status: 'ACTIVE',
            effectiveFrom: new Date(Date.now() - 30 * DAY),
          },
        });
        assignmentId = assignment.id;
      },
    );

    cls.setTenant(tenantAId);
  });

  afterAll(async () => {
    cls.setTenant(undefined);
    await prisma.runWithoutTenantScope('teardown', async () => {
      await prisma.teacherAssignment.deleteMany({
        where: { academicYear: { name: { contains: SUFFIX } } },
      });
      await prisma.section.deleteMany({
        where: { name: { contains: SUFFIX } },
      });
      await prisma.subject.deleteMany({
        where: { name: { contains: SUFFIX } },
      });
      await prisma.class.deleteMany({ where: { name: { contains: SUFFIX } } });
      await prisma.academicYear.deleteMany({
        where: { name: { contains: SUFFIX } },
      });
      await prisma.staff.deleteMany({ where: { lastName: SUFFIX } });
      await prisma.user.deleteMany({
        where: { email: { contains: SUFFIX } },
      });
      await prisma.tenant.deleteMany({
        where: { slug: { contains: SUFFIX } },
      });
    });
    await prisma.$disconnect();
  });

  async function resetAssignment(overrides: Record<string, unknown> = {}) {
    cls.setTenant(tenantAId);
    await prisma.teacherAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'ACTIVE',
        effectiveFrom: new Date(Date.now() - 30 * DAY),
        effectiveUntil: null,
        classId: classAId,
        sectionId: sectionAId,
        subjectId: subjectMathId,
        ...overrides,
      },
    });
  }

  beforeEach(async () => {
    await resetAssignment();
    jest.clearAllMocks();
  });

  const marksWrite = (over: Record<string, unknown> = {}) => ({
    capability: TeacherCapability.MARKS_ENTER,
    classId: classAId,
    sectionId: sectionAId,
    subjectId: subjectMathId,
    ...over,
  });

  describe('exact assignment match', () => {
    it('grants the assigned class + section + subject', async () => {
      const grant = await service.canActorAccess(
        marksWrite() as never,
        teacherActor(),
      );

      expect(grant).not.toBeNull();
    });
  });

  describe('scope mismatches are denied', () => {
    it('denies a different subject in the same class/section', async () => {
      const grant = await service.canActorAccess(
        marksWrite({ subjectId: subjectSciId }) as never,
        teacherActor(),
      );

      expect(grant).toBeNull();
    });

    it('denies a different section of the same class', async () => {
      const grant = await service.canActorAccess(
        marksWrite({ sectionId: sectionOtherId }) as never,
        teacherActor(),
      );

      expect(grant).toBeNull();
    });

    it('denies a different class entirely', async () => {
      const grant = await service.canActorAccess(
        marksWrite({ classId: classOtherId }) as never,
        teacherActor(),
      );

      expect(grant).toBeNull();
    });
  });

  describe('assignment lifecycle', () => {
    it.each([['REVOKED'], ['EXPIRED']])(
      'denies once the assignment status is %s',
      async (status) => {
        await resetAssignment({ status });

        const grant = await service.canActorAccess(
          marksWrite() as never,
          teacherActor(),
        );

        expect(grant).toBeNull();
      },
    );

    it('denies an assignment that has not started yet', async () => {
      await resetAssignment({ effectiveFrom: new Date(Date.now() + DAY) });

      const grant = await service.canActorAccess(
        marksWrite() as never,
        teacherActor(),
      );

      expect(grant).toBeNull();
    });

    it('denies an assignment that had already ended', async () => {
      await resetAssignment({
        effectiveFrom: new Date(Date.now() - 30 * DAY),
        effectiveUntil: new Date(Date.now() - DAY),
      });

      const grant = await service.canActorAccess(
        marksWrite() as never,
        teacherActor(),
      );

      expect(grant).toBeNull();
    });

    it('revoking the assignment removes write access immediately', async () => {
      await expect(
        service.canActorAccess(marksWrite() as never, teacherActor()),
      ).resolves.not.toBeNull();

      await resetAssignment({ status: 'REVOKED' });

      await expect(
        service.canActorAccess(marksWrite() as never, teacherActor()),
      ).resolves.toBeNull();
    });
  });

  describe('identity and tenant boundaries', () => {
    it('denies a foreign-tenant actor holding a real staff id', async () => {
      // JwtAuthGuard always sets CLS from the same token as request.auth, so a
      // faithful foreign actor moves BOTH. (Setting only the actor leaves CLS
      // on tenant A, and the extension then overwrites the service's explicit
      // `tenantId: actor.tenantId` filter with tenant A -- an impossible state
      // in production, but one that would make this assertion vacuous.)
      cls.setTenant(tenantBId);
      const foreign = {
        tenantId: tenantBId,
        userId: teacherUserId,
        roles: ['teacher'],
        permissions: [],
      } as unknown as AuthContext;

      const grant = await service.canActorAccess(
        marksWrite() as never,
        foreign,
      );

      expect(grant).toBeNull();
      cls.setTenant(tenantAId);
    });

    it('denies an actor with no staff record', async () => {
      const orphan = {
        tenantId: tenantAId,
        userId: 'no-such-user',
        roles: ['teacher'],
        permissions: [],
      } as unknown as AuthContext;

      const grant = await service.canActorAccess(
        marksWrite() as never,
        orphan,
      );

      expect(grant).toBeNull();
    });

    it('denies an inactive staff member even with a live assignment', async () => {
      cls.setTenant(tenantAId);
      await prisma.staff.update({
        where: { id: teacherStaffId },
        data: { status: 'INACTIVE' },
      });

      const grant = await service.canActorAccess(
        marksWrite() as never,
        teacherActor(),
      );
      expect(grant).toBeNull();

      await prisma.staff.update({
        where: { id: teacherStaffId },
        data: { status: 'ACTIVE' },
      });
    });
  });
});

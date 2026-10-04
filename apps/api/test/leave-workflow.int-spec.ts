import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import type { AuthContext } from '../src/auth/auth.types';
import { StaffLeaveWorkflow } from '../src/hr/staff-leave-workflow';
import { reconcileLeaveCoverForWindow } from '../src/timetable/leave-coverage';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import {
  closeLedgerFixturePool,
  withLedgerGuardsOff,
} from './helpers/ledger-fixture';

/**
 * Phase 7.6 — staff leave workflow on real PostgreSQL: concurrent approvals,
 * balance locking, employment window, payroll guard, overlap exclusion,
 * durable timetable cover, cancellation cascade, republish reconciliation,
 * half-day leave and the academic-impact preview.
 *
 * Calendar: 2 Nov 2026 is a Monday (timetable day 1), 3 Nov a Tuesday.
 */
const MON = '2026-11-02';
const TUE = '2026-11-03';
const NEXT_MON = '2026-11-09';
const NEXT_TUE = '2026-11-10';

const APPROVER_PERMISSIONS = [
  'hr:leave:approve',
  'hr:leave:request',
  'hr:leave:read',
  'hr:manage',
];
const TEACHER_PERMISSIONS = ['hr:leave:request', 'hr:leave:read'];

interface World {
  tenantId: string;
  approver: AuthContext;
  approver2: AuthContext;
  teacher: AuthContext;
  colleague: AuthContext;
  teacherStaffId: string;
  colleagueStaffId: string;
  approverStaffId: string;
  versionId: string;
  academicYearId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  balanceId: string;
}

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 7.6 staff leave workflow (PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  const previousUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let workflow: StaffLeaveWorkflow;
  const tenants: string[] = [];

  const scope = <T>(world: World, work: () => Promise<T>) =>
    prisma.runWithTenantScope(world.tenantId, work);

  async function permissionIds(keys: string[]) {
    const rows = await Promise.all(
      keys.map((key) => {
        const split = key.lastIndexOf(':');
        const resource = key.slice(0, split);
        const action = key.slice(split + 1);
        return prisma.permission.upsert({
          where: { resource_action: { resource, action } },
          create: { resource, action },
          update: {},
        });
      }),
    );
    return rows.map((row) => row.id);
  }

  async function makeWorld(): Promise<World> {
    return prisma.runWithoutTenantScope('Phase 7.6 fixtures', async () => {
      const tenant = await prisma.tenant.create({
        data: { name: 'Phase 7.6 test', slug: `p76-${randomUUID()}` },
      });
      tenants.push(tenant.id);
      const tenantId = tenant.id;
      const approverGrants = await permissionIds(APPROVER_PERMISSIONS);
      const teacherGrants = await permissionIds(TEACHER_PERMISSIONS);
      const approverRole = await prisma.role.create({
        data: {
          tenantId,
          name: `p76-approver-${randomUUID().slice(0, 6)}`,
          rolePermissions: {
            create: approverGrants.map((permissionId) => ({ permissionId })),
          },
        },
      });
      const teacherRole = await prisma.role.create({
        data: {
          tenantId,
          name: `p76-teacher-${randomUUID().slice(0, 6)}`,
          rolePermissions: {
            create: teacherGrants.map((permissionId) => ({ permissionId })),
          },
        },
      });

      const person = async (
        label: string,
        role: { id: string; name: string },
        permissions: string[],
      ): Promise<{ actor: AuthContext; staffId: string }> => {
        const user = await prisma.user.create({
          data: {
            tenantId,
            email: `${label}-${randomUUID()}@example.test`,
            status: 'ACTIVE',
          },
        });
        await prisma.userRole.create({
          data: { tenantId, userId: user.id, roleId: role.id },
        });
        const familyId = randomUUID();
        await prisma.refreshToken.create({
          data: {
            userId: user.id,
            familyId,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 600_000),
          },
        });
        const staff = await prisma.staff.create({
          data: {
            tenantId,
            userId: user.id,
            employeeId: `P76-${randomUUID().slice(0, 8)}`,
            firstName: 'Synthetic',
            lastName: label,
            dateOfBirth: new Date('1990-01-01'),
            gender: 'OTHER',
            address: 'Synthetic address',
            joiningDate: new Date('2025-01-01'),
            contractType: 'PERMANENT',
          } as never,
        });
        return {
          staffId: staff.id,
          actor: {
            userId: user.id,
            tenantId,
            tenantSlug: tenant.slug,
            email: user.email,
            sessionFamilyId: familyId,
            authMethod: 'PASSWORD',
            roles: [role.name],
            permissions,
          } as AuthContext,
        };
      };

      const approver = await person(
        'approver',
        approverRole,
        APPROVER_PERMISSIONS,
      );
      const approver2 = await person(
        'approver2',
        approverRole,
        APPROVER_PERMISSIONS,
      );
      const teacher = await person('teacher', teacherRole, TEACHER_PERMISSIONS);
      const colleague = await person(
        'colleague',
        teacherRole,
        TEACHER_PERMISSIONS,
      );

      // Verified employment from 1 Jan 2026 (maker != checker).
      for (const staffId of [
        teacher.staffId,
        approver.staffId,
        colleague.staffId,
      ]) {
        const employment = await prisma.staffEmployment.create({
          data: {
            tenantId,
            staffId,
            employmentType: 'PERMANENT',
            postCategoryCode: 'TEACHER',
            schoolTypeCode: 'SYNTHETIC',
            effectiveFrom: new Date('2026-01-01'),
            submittedById: approver.actor.userId,
          },
        });
        await prisma.staffEmployment.update({
          where: { id: employment.id },
          data: {
            status: 'VERIFIED',
            verifiedById: approver2.actor.userId,
            verifiedAt: new Date(),
          },
        });
      }

      // Three accrued casual days and nothing else: the former approval rule
      // (allocated + carried - used) would have seen zero.
      const balance = await prisma.staffLeaveBalance.create({
        data: {
          tenantId,
          staffId: teacher.staffId,
          leaveType: 'CASUAL',
          year: 2026,
          accrued: 3,
        },
      });

      const academicYear = await prisma.academicYear.create({
        data: {
          tenantId,
          name: 'Synthetic 2026',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      const classroom = await prisma.class.create({
        data: { tenantId, name: 'Grade 5', level: 5 },
      });
      const section = await prisma.section.create({
        data: { tenantId, classId: classroom.id, name: 'A' },
      });
      const subject = await prisma.subject.create({
        data: {
          tenantId,
          classId: classroom.id,
          name: 'Mathematics',
          code: `MATH-${randomUUID().slice(0, 6)}`,
          type: 'CORE',
        } as never,
      });
      const version = await prisma.timetableVersion.create({
        data: {
          tenantId,
          academicYearId: academicYear.id,
          classId: classroom.id,
          sectionId: section.id,
          versionName: 'Term 1',
          effectiveFrom: new Date('2026-01-01'),
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      const slot = (
        staffId: string,
        dayOfWeek: number,
        startsAt: string,
        endsAt: string,
      ) =>
        prisma.timetableSlot.create({
          data: {
            tenantId,
            versionId: version.id,
            academicYearId: academicYear.id,
            classId: classroom.id,
            sectionId: section.id,
            subjectId: subject.id,
            staffId,
            dayOfWeek,
            startsAt,
            endsAt,
          },
        });
      // Monday spans 08:00-13:15 => half-day boundary 10:37.
      await slot(teacher.staffId, 1, '08:00', '08:45');
      await slot(teacher.staffId, 1, '12:30', '13:15');
      await slot(teacher.staffId, 2, '09:00', '09:45');
      await slot(colleague.staffId, 1, '09:00', '09:45');

      return {
        tenantId,
        approver: approver.actor,
        approver2: approver2.actor,
        teacher: teacher.actor,
        colleague: colleague.actor,
        teacherStaffId: teacher.staffId,
        colleagueStaffId: colleague.staffId,
        approverStaffId: approver.staffId,
        versionId: version.id,
        academicYearId: academicYear.id,
        classId: classroom.id,
        sectionId: section.id,
        subjectId: subject.id,
        balanceId: balance.id,
      };
    });
  }

  const request = (
    world: World,
    input: {
      startsOn: string;
      endsOn: string;
      leaveType?: string;
      dayPart?: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF';
      staffId?: string;
      actor?: AuthContext;
    },
  ) =>
    scope(world, () =>
      workflow.create(
        {
          staffId: input.staffId ?? world.teacherStaffId,
          leaveType: input.leaveType ?? 'CASUAL',
          startsOn: input.startsOn,
          endsOn: input.endsOn,
          reason: 'Family event',
          dayPart: input.dayPart,
        },
        input.actor ?? world.teacher,
      ),
    );

  const approve = (world: World, id: string, actor = world.approver) =>
    scope(world, () => workflow.review(id, { status: 'APPROVED' }, actor));

  const used = (world: World) =>
    scope(world, async () =>
      (
        await prisma.staffLeaveBalance.findUniqueOrThrow({
          where: { id: world.balanceId },
        })
      ).used.toFixed(2),
    );

  const cover = (world: World, leaveRequestId: string) =>
    scope(world, () =>
      prisma.timetableSubstitution.findMany({
        where: { tenantId: world.tenantId, leaveRequestId },
        include: { timetableSlot: true },
        orderBy: [{ date: 'asc' }, { timetableSlot: { startsAt: 'asc' } }],
      }),
    );

  const errorCode = (reason: unknown) =>
    (
      (reason as { getResponse?: () => unknown }).getResponse?.() as
        | { code?: string }
        | undefined
    )?.code;

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    workflow = new StaffLeaveWorkflow(prisma, new AuditService(prisma, cls));
  });

  afterEach(async () => {
    for (const tenantId of tenants.splice(0)) {
      await withLedgerGuardsOff(async (query) => {
        const tables = await query(
          `SELECT DISTINCT table_name FROM information_schema.columns
            WHERE table_schema = 'public' AND column_name = 'tenantId'`,
        );
        for (const row of tables.rows as { table_name: string }[]) {
          await query(`DELETE FROM "${row.table_name}" WHERE "tenantId" = $1`, [
            tenantId,
          ]);
        }
        await query('DELETE FROM "Tenant" WHERE "id" = $1', [tenantId]);
      });
    }
  });

  afterAll(async () => {
    await closeLedgerFixturePool();
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  describe('approval is one transaction', () => {
    it('debits the canonical balance, marks attendance, records lifecycle and creates linked cover', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: TUE });
      expect(leave.days.toFixed(2)).toBe('2.00');

      const result = await approve(world, leave.id);

      expect(result.status).toBe('APPROVED');
      expect(result.coverage).toEqual({ created: 3 });
      expect(await used(world)).toBe('2.00');
      const drafts = await cover(world, leave.id);
      expect(
        drafts.map((row) => [
          row.date.toISOString().slice(0, 10),
          row.timetableSlot.startsAt,
          row.status,
        ]),
      ).toEqual([
        [MON, '08:00', 'DRAFT'],
        [MON, '12:30', 'DRAFT'],
        [TUE, '09:00', 'DRAFT'],
      ]);
      await scope(world, async () => {
        expect(
          await prisma.staffAttendance.count({
            where: { staffId: world.teacherStaffId, status: 'LEAVE' },
          }),
        ).toBe(2);
        expect(
          await prisma.staffLifecycleEvent.count({
            where: { staffId: world.teacherStaffId, eventType: 'ON_LEAVE' },
          }),
        ).toBe(1);
      });
    });

    it('lets only one of two concurrent approvals drain the same balance', async () => {
      const world = await makeWorld();
      const first = await request(world, { startsOn: MON, endsOn: TUE });
      const second = await request(world, {
        startsOn: NEXT_MON,
        endsOn: NEXT_TUE,
      });

      const outcomes = await Promise.allSettled([
        approve(world, first.id, world.approver),
        approve(world, second.id, world.approver2),
      ]);

      const rejected = outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      );
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
      expect(errorCode(rejected[0].reason)).toBe('LEAVE_BALANCE_INSUFFICIENT');
      expect(await used(world)).toBe('2.00');
      await scope(world, async () => {
        const statuses = await prisma.staffLeaveRequest.findMany({
          where: { id: { in: [first.id, second.id] } },
          select: { status: true },
        });
        expect(statuses.map((s) => s.status).sort()).toEqual([
          'APPROVED',
          'PENDING',
        ]);
      });
    });

    it('approves one request exactly once under a double submit', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: MON });

      const outcomes = await Promise.allSettled([
        approve(world, leave.id, world.approver),
        approve(world, leave.id, world.approver2),
        approve(world, leave.id, world.approver),
      ]);

      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      for (const failure of outcomes.filter(
        (o): o is PromiseRejectedResult => o.status === 'rejected',
      )) {
        expect(errorCode(failure.reason)).toBe('LEAVE_REQUEST_STALE');
      }
      expect(await used(world)).toBe('1.00');
      expect(await cover(world, leave.id)).toHaveLength(2);
    });

    it('refuses self-approval, a revoked session and a since-terminated requester', async () => {
      const world = await makeWorld();
      // The approver files their own leave (needs a balance).
      await scope(world, () =>
        prisma.staffLeaveBalance.create({
          data: {
            tenantId: world.tenantId,
            staffId: world.approverStaffId,
            leaveType: 'CASUAL',
            year: 2026,
            allocated: 5,
          },
        }),
      );
      const own = await request(world, {
        startsOn: MON,
        endsOn: MON,
        staffId: world.approverStaffId,
        actor: world.approver,
      });
      await expect(
        approve(world, own.id, world.approver),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const leave = await request(world, { startsOn: MON, endsOn: MON });
      await scope(world, () =>
        prisma.refreshToken.updateMany({
          where: { familyId: world.approver2.sessionFamilyId },
          data: { revokedAt: new Date() },
        }),
      );
      await expect(
        approve(world, leave.id, world.approver2),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      await scope(world, () =>
        prisma.staff.update({
          where: { id: world.teacherStaffId },
          data: { status: 'TERMINATED' },
        }),
      );
      const stale = approve(world, leave.id, world.approver);
      await expect(stale).rejects.toBeInstanceOf(ConflictException);
      expect(errorCode(await stale.catch((e: unknown) => e))).toBe(
        'STAFF_INACTIVE',
      );
      expect(await used(world)).toBe('0.00');
    });

    it('rejects without touching the balance and requires a note', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: MON });
      await expect(
        scope(world, () =>
          workflow.review(leave.id, { status: 'REJECTED' }, world.approver),
        ),
      ).rejects.toThrow(/review note/);
      const rejected = await scope(world, () =>
        workflow.review(
          leave.id,
          { status: 'REJECTED', reviewNote: 'Exam week' },
          world.approver,
        ),
      );
      expect(rejected.status).toBe('REJECTED');
      expect(await used(world)).toBe('0.00');
      expect(await cover(world, leave.id)).toHaveLength(0);
    });
  });

  describe('request rules', () => {
    it('refuses leave outside verified employment', async () => {
      const world = await makeWorld();
      const outside = request(world, {
        startsOn: '2025-12-30',
        endsOn: '2026-01-02',
      });
      await expect(outside).rejects.toBeInstanceOf(ConflictException);
      expect(errorCode(await outside.catch((e: unknown) => e))).toBe(
        'LEAVE_OUTSIDE_EMPLOYMENT',
      );
    });

    it('refuses paid leave the balance cannot cover, but files unpaid leave', async () => {
      const world = await makeWorld();
      const tooLong = request(world, { startsOn: MON, endsOn: '2026-11-06' });
      expect(errorCode(await tooLong.catch((e: unknown) => e))).toBe(
        'LEAVE_BALANCE_INSUFFICIENT',
      );
      const unpaid = await request(world, {
        startsOn: MON,
        endsOn: '2026-11-06',
        leaveType: 'unpaid',
      });
      expect(unpaid.isPaid).toBe(false);
      expect(unpaid.leaveType).toBe('UNPAID');
      await approve(world, unpaid.id);
      expect(await used(world)).toBe('0.00');
    });

    it('lets the database refuse overlapping leave, even for racing requests', async () => {
      const world = await makeWorld();
      await request(world, { startsOn: MON, endsOn: TUE });
      const overlap = request(world, { startsOn: TUE, endsOn: TUE });
      expect(errorCode(await overlap.catch((e: unknown) => e))).toBe(
        'LEAVE_OVERLAP',
      );

      const outcomes = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          request(world, { startsOn: NEXT_MON, endsOn: NEXT_MON }),
        ),
      );
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    });

    it('allows a first and a second half on the same day, but not a full day over them', async () => {
      const world = await makeWorld();
      const morning = await request(world, {
        startsOn: MON,
        endsOn: MON,
        dayPart: 'FIRST_HALF',
      });
      const afternoon = await request(world, {
        startsOn: MON,
        endsOn: MON,
        dayPart: 'SECOND_HALF',
      });
      expect(morning.days.toFixed(1)).toBe('0.5');
      expect(afternoon.days.toFixed(1)).toBe('0.5');
      const full = request(world, { startsOn: MON, endsOn: MON });
      expect(errorCode(await full.catch((e: unknown) => e))).toBe(
        'LEAVE_OVERLAP',
      );
      await expect(
        request(world, {
          startsOn: MON,
          endsOn: TUE,
          dayPart: 'FIRST_HALF',
        }),
      ).rejects.toThrow(/same day/);

      // A first-half approval covers only the morning period.
      await approve(world, morning.id);
      const drafts = await cover(world, morning.id);
      expect(drafts.map((row) => row.timetableSlot.startsAt)).toEqual([
        '08:00',
      ]);
      expect(await used(world)).toBe('0.50');
    });

    it('blocks all leave attendance writes inside a finalized payroll period', async () => {
      const world = await makeWorld();
      await withLedgerGuardsOff(async (query) => {
        await query(
          `INSERT INTO "PayrollRun" ("id","tenantId","periodMonth","periodYear","periodStart","periodEnd","status","updatedAt")
           VALUES ($1,$2,11,2026,'2026-11-01 00:00:00','2026-11-30 23:59:59.999','FINALIZED',now())`,
          [randomUUID(), world.tenantId],
        );
      });
      const unpaid = await request(world, {
        startsOn: MON,
        endsOn: MON,
        leaveType: 'UNPAID',
      });
      const blocked = approve(world, unpaid.id);
      expect(errorCode(await blocked.catch((e: unknown) => e))).toBe(
        'LEAVE_PAYROLL_FINALIZED',
      );
      // Paid leave also writes attendance; finalized input history is immutable.
      const paid = await request(world, { startsOn: TUE, endsOn: TUE });
      expect(
        errorCode(await approve(world, paid.id).catch((e: unknown) => e)),
      ).toBe('LEAVE_PAYROLL_FINALIZED');
      expect(await used(world)).toBe('0.00');
    });

    it('keeps another school out', async () => {
      const world = await makeWorld();
      const other = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: MON });
      await expect(
        prisma.runWithTenantScope(other.tenantId, () =>
          workflow.review(leave.id, { status: 'APPROVED' }, other.approver),
        ),
      ).rejects.toThrow(/not found/);
    });
  });

  describe('cancellation and coverage', () => {
    it('cancels approved leave: balance restored, attendance removed, all cover and delegations cancelled', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: TUE });
      await approve(world, leave.id);
      const [assigned] = await cover(world, leave.id);
      const delegationId = randomUUID();
      await scope(world, async () => {
        await prisma.timetableSubstitution.update({
          where: { id: assigned.id },
          data: {
            status: 'ASSIGNED',
            substituteTeacherId: world.colleagueStaffId,
            assignedAt: new Date(),
          },
        });
      });
      // Created as the substitute-assignment flow would (its eligibility gate
      // is Phase 6's concern, not this test's).
      await withLedgerGuardsOff(async (query) => {
        await query(
          `INSERT INTO "TeacherDelegation" ("id","tenantId","academicYearId","grantorStaffId","recipientStaffId","classId","sectionId","subjectId","allowedCapabilities","reason","timetableSubstitutionId","effectiveFrom","effectiveUntil","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,ARRAY['ATTENDANCE_MARK'],'Leave cover',$9,$10,$11,now())`,
          [
            delegationId,
            world.tenantId,
            world.academicYearId,
            world.teacherStaffId,
            world.colleagueStaffId,
            world.classId,
            world.sectionId,
            world.subjectId,
            assigned.id,
            `${MON}T00:00:00.000Z`,
            `${MON}T23:59:59.000Z`,
          ],
        );
      });

      // The requester may not cancel approved leave themselves.
      await expect(
        scope(world, () => workflow.cancel(leave.id, world.teacher)),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const cancelled = await scope(world, () =>
        workflow.cancel(leave.id, world.approver),
      );

      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancelledCoverCount).toBe(3);
      expect(await used(world)).toBe('0.00');
      expect(
        (await cover(world, leave.id)).every(
          (row) => row.status === 'CANCELLED',
        ),
      ).toBe(true);
      await scope(world, async () => {
        expect(
          await prisma.staffAttendance.count({
            where: { staffId: world.teacherStaffId },
          }),
        ).toBe(0);
        const delegation = await prisma.teacherDelegation.findUniqueOrThrow({
          where: { id: delegationId },
        });
        expect(delegation.status).toBe('REVOKED');
      });
      // Idempotent.
      await expect(
        scope(world, () => workflow.cancel(leave.id, world.approver)),
      ).resolves.toMatchObject({ status: 'CANCELLED', cancelledCoverCount: 0 });
    });

    it('lets the requester withdraw only their own pending request', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: MON });
      await expect(
        scope(world, () => workflow.cancel(leave.id, world.colleague)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      const withdrawn = await scope(world, () =>
        workflow.cancel(leave.id, world.teacher),
      );
      expect(withdrawn.status).toBe('CANCELLED');
      // A withdrawn request frees the dates for a new one.
      await expect(
        request(world, { startsOn: MON, endsOn: MON }),
      ).resolves.toMatchObject({ status: 'PENDING' });
    });

    it('reconciles leave cover when the timetable changes', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: TUE });
      await approve(world, leave.id);
      expect(await cover(world, leave.id)).toHaveLength(3);

      // Term 1 ends on 31 Oct; Term 2 (published from 1 Nov) moves the
      // Monday class to 10:00 and drops Tuesday.
      await scope(world, async () => {
        await prisma.timetableVersion.update({
          where: { id: world.versionId },
          data: { effectiveTo: new Date('2026-10-31') },
        });
        const term2 = await prisma.timetableVersion.create({
          data: {
            tenantId: world.tenantId,
            academicYearId: world.academicYearId,
            classId: world.classId,
            sectionId: world.sectionId,
            versionName: 'Term 2',
            effectiveFrom: new Date('2026-11-01'),
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        });
        await prisma.timetableSlot.create({
          data: {
            tenantId: world.tenantId,
            versionId: term2.id,
            academicYearId: world.academicYearId,
            classId: world.classId,
            sectionId: world.sectionId,
            subjectId: world.subjectId,
            staffId: world.teacherStaffId,
            dayOfWeek: 1,
            startsAt: '10:00',
            endsAt: '10:45',
          },
        });
        const result = await prisma.$transaction((tx) =>
          reconcileLeaveCoverForWindow(
            tx,
            world.tenantId,
            { from: new Date('2026-11-01'), to: null },
            new Date('2026-10-02'),
            world.approver.userId,
          ),
        );
        expect(result).toEqual({ created: 1, cancelled: 3 });
      });

      const rows = await cover(world, leave.id);
      expect(
        rows
          .filter((row) => row.status !== 'CANCELLED')
          .map((row) => [
            row.date.toISOString().slice(0, 10),
            row.timetableSlot.startsAt,
          ]),
      ).toEqual([[MON, '10:00']]);
    });

    it('previews academic impact and reports coverage status today-first', async () => {
      const world = await makeWorld();
      const leave = await request(world, { startsOn: MON, endsOn: TUE });
      // The colleague is away on Tuesday.
      const away = await request(world, {
        startsOn: TUE,
        endsOn: TUE,
        leaveType: 'UNPAID',
        staffId: world.colleagueStaffId,
        actor: world.colleague,
      });
      await approve(world, away.id);

      const preview = await scope(world, () =>
        workflow.impact(leave.id, world.approver),
      );
      expect(preview.totals).toEqual({
        periods: 3,
        assigned: 0,
        unresolved: 3,
        withoutFreeTeacher: 1,
      });
      const monday = preview.days.find((day) => day.date === MON);
      // The colleague is free at 08:00 and 12:30 (they teach only at 09:00);
      // on Tuesday they are on approved leave, so nobody is free at 09:00.
      expect(
        monday?.periods.map((p) => [
          p.startsAt,
          p.coverage,
          p.freeTeacherCount,
        ]),
      ).toEqual([
        ['08:00', 'UNCOVERED', 1],
        ['12:30', 'UNCOVERED', 1],
      ]);
      expect(preview.days.find((day) => day.date === TUE)?.periods).toEqual([
        expect.objectContaining({ startsAt: '09:00', freeTeacherCount: 0 }),
      ]);

      await approve(world, leave.id);
      const [first] = await cover(world, leave.id);
      await scope(world, () =>
        prisma.timetableSubstitution.update({
          where: { id: first.id },
          data: {
            status: 'ASSIGNED',
            substituteTeacherId: world.colleagueStaffId,
          },
        }),
      );

      const status = await scope(world, () =>
        workflow.coverageStatus(world.approver, { from: MON, days: 7 }),
      );
      expect(status.totals).toEqual({ periods: 3, assigned: 1, uncovered: 2 });
      expect(
        status.items.map((item) => [item.date, item.startsAt, item.coverage]),
      ).toEqual([
        [MON, '08:00', 'ASSIGNED'],
        [MON, '12:30', 'DRAFT'],
        [TUE, '09:00', 'DRAFT'],
      ]);
      expect(status.items[0].absentTeacher.id).toBe(world.teacherStaffId);
    });
  });

  it("Phase 7.12: keeps one school out of another school's leave", async () => {
    const schoolA = await makeWorld();
    const schoolB = await makeWorld();
    const leave = await request(schoolA, { startsOn: MON, endsOn: TUE });
    // School B's approver, acting in school B, with school A's real ids.
    const inB = <T>(work: () => Promise<T>) => scope(schoolB, work);
    await expect(
      inB(() =>
        workflow.review(leave.id, { status: 'APPROVED' }, schoolB.approver),
      ),
    ).rejects.toThrow(/not found/i);
    await expect(
      inB(() => workflow.impact(leave.id, schoolB.approver)),
    ).rejects.toThrow(/not found/i);
    await expect(
      inB(() => workflow.cancel(leave.id, schoolB.approver)),
    ).rejects.toThrow(/not found/i);
    await expect(
      request(schoolB, {
        startsOn: MON,
        endsOn: TUE,
        staffId: schoolA.teacherStaffId,
        actor: schoolB.approver,
      }),
    ).rejects.toThrow(/not found|staff/i);
    const coverage = await inB(() =>
      workflow.coverageStatus(schoolB.approver, { from: MON, days: 7 }),
    );
    expect(
      coverage.items.some(
        (item) => item.absentTeacher.id === schoolA.teacherStaffId,
      ),
    ).toBe(false);
    // School A's request is untouched.
    const unchanged = await scope(schoolA, () =>
      prisma.staffLeaveRequest.findUniqueOrThrow({ where: { id: leave.id } }),
    );
    expect(unchanged.status).toBe('PENDING');
  });

  it('keeps leave rows consistent at the database level', async () => {
    const world = await makeWorld();
    const insert = (sql: string) =>
      withLedgerGuardsOff(async (query) => {
        await query(sql, [randomUUID(), world.tenantId, world.teacherStaffId]);
      });
    await expect(
      insert(
        `INSERT INTO "StaffLeaveRequest" ("id","tenantId","staffId","leaveType","startsOn","endsOn","days","reason","updatedAt")
         VALUES ($1,$2,$3,'CASUAL','2026-11-03','2026-11-02',1,'x',now())`,
      ),
    ).rejects.toThrow(/StaffLeaveRequest_dates_ordered/);
    await expect(
      insert(
        `INSERT INTO "StaffLeaveRequest" ("id","tenantId","staffId","leaveType","startsOn","endsOn","days","dayPart","reason","updatedAt")
         VALUES ($1,$2,$3,'CASUAL','2026-11-02','2026-11-03',1,'FIRST_HALF','x',now())`,
      ),
    ).rejects.toThrow(/StaffLeaveRequest_half_day_single_day/);
    await expect(
      insert(
        `INSERT INTO "StaffLeaveRequest" ("id","tenantId","staffId","leaveType","startsOn","endsOn","days","reason","updatedAt")
         VALUES ($1,$2,$3,'CASUAL','2026-11-02','2026-11-02',0,'x',now())`,
      ),
    ).rejects.toThrow(/StaffLeaveRequest_days_positive/);
  });
});

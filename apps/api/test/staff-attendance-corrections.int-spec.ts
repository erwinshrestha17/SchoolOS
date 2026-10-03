import { StaffService } from '../src/staff/staff.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  StaffAttendanceCorrections,
  STAFF_CORRECTION_APPROVE,
} from '../src/hr/staff-attendance-corrections';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import {
  withLedgerGuardsOff,
  closeLedgerFixturePool,
} from './helpers/ledger-fixture';
import { StaffTimeClockService } from '../src/attendance/staff-time-clock.service';
import { AuditService } from '../src/audit/audit.service';

(authTestDatabaseUrl ? describe : describe.skip)(
  'Phase 7.7 staff corrections (PostgreSQL)',
  () => {
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    const previousUrl = process.env.DATABASE_URL;
    let prisma: PrismaService;
    let service: StaffAttendanceCorrections;
    const tenants: string[] = [];
    interface World {
      tenantId: string;
      staffId: string;
      maker: AuthContext;
      checker: AuthContext;
      checker2: AuthContext;
      attendanceId: string;
    }
    const scope = <T>(w: World, fn: () => Promise<T>) =>
      prisma.runWithTenantScope(w.tenantId, fn);
    async function world(): Promise<World> {
      return prisma.runWithoutTenantScope(
        'Phase 7.7 test fixture',
        async () => {
          const tenant = await prisma.tenant.create({
            data: { name: 'Synthetic Phase 7.7', slug: `p77-${randomUUID()}` },
          });
          tenants.push(tenant.id);
          const permissions = [
            'hr:attendance:correct',
            STAFF_CORRECTION_APPROVE,
          ];
          const grants = await Promise.all(
            permissions.map((key) => {
              const split = key.lastIndexOf(':');
              const resource = key.slice(0, split),
                action = key.slice(split + 1);
              return prisma.permission.upsert({
                where: { resource_action: { resource, action } },
                create: { resource, action },
                update: {},
              });
            }),
          );
          const role = await prisma.role.create({
            data: {
              tenantId: tenant.id,
              name: `p77-${randomUUID()}`,
              rolePermissions: {
                create: grants.map((p) => ({ permissionId: p.id })),
              },
            },
          });
          async function actor(): Promise<AuthContext> {
            const user = await prisma.user.create({
              data: {
                tenantId: tenant.id,
                email: `${randomUUID()}@example.test`,
                status: 'ACTIVE',
              },
            });
            await prisma.userRole.create({
              data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
            });
            const family = randomUUID();
            await prisma.refreshToken.create({
              data: {
                userId: user.id,
                familyId: family,
                tokenHash: randomUUID(),
                expiresAt: new Date(Date.now() + 600000),
              },
            });
            return {
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
              userId: user.id,
              email: user.email,
              authMethod: 'PASSWORD',
              roles: [role.name],
              permissions,
              sessionFamilyId: family,
            };
          }
          const maker = await actor(),
            checker = await actor(),
            checker2 = await actor();
          const staff = await prisma.staff.create({
            data: {
              tenantId: tenant.id,
              userId: maker.userId,
              employeeId: randomUUID(),
              firstName: 'Synthetic',
              lastName: 'Correction',
              dateOfBirth: new Date('1990-01-01'),
              gender: 'OTHER',
              address: 'Test',
              joiningDate: new Date('2025-01-01'),
              contractType: 'PERMANENT',
            },
          });
          const attendance = await prisma.staffAttendance.create({
            data: {
              tenantId: tenant.id,
              staffId: staff.id,
              attendanceDate: new Date('2026-11-02'),
              status: 'ABSENT',
            },
          });
          return {
            tenantId: tenant.id,
            staffId: staff.id,
            attendanceId: attendance.id,
            maker,
            checker,
            checker2,
          };
        },
      );
    }
    const request = (w: World) =>
      scope(w, () =>
        service.request(
          w.attendanceId,
          { status: 'PRESENT', reason: 'Verified missing check-in' },
          w.maker,
        ),
      );
    const row = (w: World) =>
      scope(w, () =>
        prisma.staffAttendance.findUniqueOrThrow({
          where: { id: w.attendanceId },
        }),
      );
    const lock = (w: World) =>
      scope(w, () =>
        prisma.payrollRun.create({
          data: {
            tenantId: w.tenantId,
            // Legacy Gregorian label: bounds are authoritative.
            periodMonth: 11,
            periodYear: 2026,
            periodStart: new Date('2026-11-01T00:00:00.000Z'),
            periodEnd: new Date('2026-11-30T23:59:59.999Z'),
            status: 'FINALIZED',
            finalizedAt: new Date(),
          },
        }),
      );
    beforeAll(() => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      service = new StaffAttendanceCorrections(prisma);
    });
    afterEach(async () => {
      for (const tenantId of tenants.splice(0))
        await withLedgerGuardsOff(async (query) => {
          const tables = await query(
            `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenantId'`,
          );
          for (const table of tables.rows as { table_name: string }[])
            await query(
              `DELETE FROM "${table.table_name}" WHERE "tenantId"=$1`,
              [tenantId],
            );
          await query('DELETE FROM "Tenant" WHERE id=$1', [tenantId]);
        });
    });
    afterAll(async () => {
      await closeLedgerFixturePool();
      await prisma?.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    it('applies an independently approved open correction and preserves the original snapshot', async () => {
      const w = await world();
      const c = await request(w);
      const decided = await scope(w, () =>
        service.decide(c.id, 'APPROVED', w.checker),
      );
      expect(decided.status).toBe('APPROVED');
      expect(decided.originalStatus).toBe('ABSENT');
      expect((await row(w)).status).toBe('PRESENT');
      await expect(
        scope(w, () =>
          prisma.staffAttendance.update({
            where: { id: w.attendanceId },
            data: { status: 'ABSENT' },
          }),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_CORRECTED_USE_WORKFLOW');
    });
    it('queues a finalized-period correction without touching attendance or payroll', async () => {
      const w = await world();
      const run = await lock(w);
      const before = await row(w);
      const c = await request(w);
      const result = await scope(w, () =>
        service.decide(c.id, 'APPROVED', w.checker),
      );
      expect(result.status).toBe('PENDING_PAYROLL_ADJUSTMENT');
      expect(await row(w)).toEqual(before);
      expect(
        await scope(w, () =>
          prisma.payrollRun.findUnique({ where: { id: run.id } }),
        ),
      ).toEqual(run);
    });
    it('rejection and cancellation leave attendance unchanged', async () => {
      const w = await world();
      const before = await row(w);
      const c = await request(w);
      await scope(w, () =>
        service.decide(c.id, 'REJECTED', w.checker, 'Evidence insufficient'),
      );
      const next = await request(w);
      await scope(w, () => service.decide(next.id, 'CANCELLED', w.maker));
      expect(await row(w)).toEqual(before);
    });
    it('denies self approval, missing permission, cross-tenant identifiers and ended sessions', async () => {
      const w = await world();
      const other = await world();
      const c = await request(w);
      await expect(
        scope(w, () => service.decide(c.id, 'APPROVED', w.maker)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        scope(w, () =>
          service.decide(c.id, 'APPROVED', { ...w.checker, permissions: [] }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        scope(other, () => service.decide(c.id, 'APPROVED', other.checker)),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        scope(w, () =>
          service.decide(c.id, 'APPROVED', {
            ...w.checker,
            sessionFamilyId: randomUUID(),
          }),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
    it('permits only one concurrent decision and rejects a later replay', async () => {
      const w = await world();
      const c = await request(w);
      const results = await Promise.allSettled([
        scope(w, () => service.decide(c.id, 'APPROVED', w.checker)),
        scope(w, () => service.decide(c.id, 'APPROVED', w.checker2)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      await expect(
        scope(w, () => service.decide(c.id, 'APPROVED', w.checker)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
    it('rejects a second open correction and detects attendance changed since request', async () => {
      const w = await world();
      const c = await request(w);
      await expect(request(w)).rejects.toBeInstanceOf(ConflictException);
      await scope(w, () =>
        prisma.staffAttendance.update({
          where: { id: w.attendanceId },
          data: { note: 'Changed evidence' },
        }),
      );
      await expect(
        scope(w, () => service.decide(c.id, 'APPROVED', w.checker)),
      ).rejects.toBeInstanceOf(ConflictException);
    });
    it('rejects direct SQL updates/deletes, ORM upserts, checkout and new locked-period rows', async () => {
      const w = await world();
      await lock(w);
      await expect(
        scope(
          w,
          () =>
            prisma.$executeRaw`UPDATE "StaffAttendance" SET status='PRESENT' WHERE id=${w.attendanceId}`,
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      await expect(
        scope(w, () =>
          prisma.staffAttendance.delete({ where: { id: w.attendanceId } }),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      await expect(
        scope(w, () =>
          prisma.staffAttendance.upsert({
            where: {
              tenantId_staffId_attendanceDate: {
                tenantId: w.tenantId,
                staffId: w.staffId,
                attendanceDate: new Date('2026-11-02'),
              },
            },
            create: {
              tenantId: w.tenantId,
              staffId: w.staffId,
              attendanceDate: new Date('2026-11-02'),
            },
            update: { status: 'PRESENT' },
          }),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      await expect(
        scope(w, () =>
          prisma.staffAttendance.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staffId,
              attendanceDate: new Date('2026-11-03'),
            },
          }),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      const clock = new StaffTimeClockService(
        prisma,
        new AuditService(prisma, cls),
      );
      await expect(
        scope(w, () =>
          clock.checkIn(
            { attendanceDate: '2026-11-02', timestamp: '2026-11-02T03:00:00Z' },
            w.maker,
          ),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
    });
    it('database checks prevent self approval and incomplete decisions', async () => {
      const w = await world();
      const c = await request(w);
      await expect(
        scope(w, () =>
          prisma.staffAttendanceCorrection.update({
            where: { id: c.id },
            data: {
              status: 'APPROVED',
              approverId: w.maker.userId,
              decidedAt: new Date(),
            },
          }),
        ),
      ).rejects.toThrow('StaffAttendanceCorrection_independent_approver');
      await expect(
        scope(w, () =>
          prisma.staffAttendanceCorrection.update({
            where: { id: c.id },
            data: { status: 'APPROVED' },
          }),
        ),
      ).rejects.toThrow('StaffAttendanceCorrection_decision');
    });
    it('staff-service and time-clock checkout cannot bypass a fixed period', async () => {
      const w = await world();
      await scope(w, () =>
        prisma.staffAttendance.update({
          where: { id: w.attendanceId },
          data: { checkInAt: new Date('2026-11-02T03:00:00Z') },
        }),
      );
      await lock(w);
      const audit = new AuditService(prisma, cls);
      const staffService = new StaffService(
        prisma,
        {} as never,
        audit,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(
        scope(w, () =>
          staffService.recordStaffAttendance(
            w.staffId,
            { attendanceDate: '2026-11-02', status: 'PRESENT' },
            w.maker,
          ),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      const clock = new StaffTimeClockService(prisma, audit);
      await expect(
        scope(w, () =>
          clock.checkOut(
            { attendanceDate: '2026-11-02', timestamp: '2026-11-02T10:00:00Z' },
            w.maker,
          ),
        ),
      ).rejects.toThrow('STAFF_ATTENDANCE_PAYROLL_LOCKED');
      const attendance = new AttendanceService(
        prisma,
        {} as never,
        audit,
        {} as never,
        { getSetting: () => Promise.resolve(null) } as never,
        {} as never,
      );
      await expect(
        scope(w, () =>
          attendance.submitStaffAttendance(
            {
              attendanceDate: '2026-11-02',
              records: [{ staffId: w.staffId, status: 'PRESENT' }],
            },
            {
              ...w.maker,
              permissions: [...w.maker.permissions, 'hr:attendance:write'],
            },
          ),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechecks persisted approval grants and restricts reason/impact projections', async () => {
      const w = await world();
      const c = await request(w);
      await scope(w, () =>
        prisma.userRole.updateMany({
          where: { userId: w.checker.userId },
          data: { revokedAt: new Date() },
        }),
      );
      await expect(
        scope(w, () => service.decide(c.id, 'APPROVED', w.checker)),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        scope(w, () =>
          service.list({ ...w.maker, permissions: ['hr:attendance:read'] }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        scope(w, () =>
          service.impact(c.id, {
            ...w.maker,
            permissions: ['hr:attendance:read'],
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('projects paid/unpaid day deltas with verified employment and no money fields', async () => {
      const w = await world();
      await scope(w, async () => {
        const employment = await prisma.staffEmployment.create({
          data: {
            tenantId: w.tenantId,
            staffId: w.staffId,
            employmentType: 'PERMANENT',
            postCategoryCode: 'TEACHER',
            schoolTypeCode: 'SYNTHETIC',
            effectiveFrom: new Date('2026-01-01'),
            submittedById: w.maker.userId,
          },
        });
        await prisma.staffEmployment.update({
          where: { id: employment.id },
          data: {
            status: 'VERIFIED',
            verifiedById: w.checker.userId,
            verifiedAt: new Date(),
          },
        });
      });
      const c = await request(w);
      expect(await scope(w, () => service.impact(c.id, w.checker))).toEqual({
        correctionId: c.id,
        workingDays: 30,
        paidDaysDelta: 1,
        unpaidDaysDelta: -1,
        payrollLocked: false,
        basis: 'CURRENT_PAYROLL_DAY_RULES',
        provisional: true,
      });
    });

    it('timestamped payroll ends do not freeze the following calendar day', async () => {
      const w = await world();
      await scope(w, () =>
        prisma.payrollRun.create({
          data: {
            tenantId: w.tenantId,
            periodMonth: 11,
            periodYear: 2026,
            periodStart: new Date('2026-11-01'),
            periodEnd: new Date('2026-11-30T23:59:59.999Z'),
            status: 'FINALIZED',
          },
        }),
      );
      await expect(
        scope(w, () =>
          prisma.staffAttendance.create({
            data: {
              tenantId: w.tenantId,
              staffId: w.staffId,
              attendanceDate: new Date('2026-12-01'),
            },
          }),
        ),
      ).resolves.toBeDefined();
    });

    it('a SQL writer waiting on payroll finalization sees the new lock', async () => {
      const w = await world();
      let release!: () => void, ready!: () => void;
      const releasePromise = new Promise<void>((resolve) => {
        release = resolve;
      });
      const readyPromise = new Promise<void>((resolve) => {
        ready = resolve;
      });
      const finalizing = scope(w, () =>
        prisma.$transaction(async (tx) => {
          await tx.payrollRun.create({
            data: {
              tenantId: w.tenantId,
              periodMonth: 11,
              periodYear: 2026,
              periodStart: new Date('2026-11-01T00:00:00.000Z'),
              periodEnd: new Date('2026-11-30T23:59:59.999Z'),
              status: 'FINALIZED',
            },
          });
          ready();
          await releasePromise;
        }),
      );
      await readyPromise;
      const writing = scope(
        w,
        () =>
          prisma.$executeRaw`UPDATE "StaffAttendance" SET status='PRESENT' WHERE id=${w.attendanceId}`,
      ).then(
        () => null,
        (error: unknown) => error,
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      release();
      await finalizing;
      expect(String(await writing)).toContain(
        'STAFF_ATTENDANCE_PAYROLL_LOCKED',
      );
      expect((await row(w)).status).toBe('ABSENT');
    });
  },
);

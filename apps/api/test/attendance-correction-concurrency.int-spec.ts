import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { ConflictException } from '@nestjs/common';
import { AttendanceStatus, AuthMethod, Gender } from '@prisma/client';
import { AttendanceService } from '../src/attendance/attendance.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

// Explicit disposable loopback database opt-in; never inherit the school's DB.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Attendance correction decisions (real PostgreSQL)', () => {
  const previousUrl = process.env.DATABASE_URL;
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let audit: AuditService;
  let tenantId: string;
  let requestId: string;
  let recordId: string;
  let actor: AuthContext;
  const scoped = <T>(fn: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, fn);
  const service = (db = prisma) =>
    new AttendanceService(
      db,
      {} as never,
      audit,
      {} as never,
      {} as never,
      {} as never,
    );
  const decide = (status: 'APPROVED' | 'REJECTED', target = service()) =>
    scoped(() =>
      target.approveCorrectionRequest(
        requestId,
        {
          status,
          reviewReason: 'Synthetic review against the original register',
        },
        actor,
      ),
    );
  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    audit = new AuditService(prisma, cls);
  });
  beforeEach(async () => {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Synthetic correction test',
        slug: `correction-${randomUUID()}`,
      },
    });
    tenantId = tenant.id;
    await scoped(async () => {
      const reviewer = await prisma.user.create({
        data: {
          tenantId,
          email: 'reviewer@example.invalid',
          passwordHash: 'synthetic-not-a-login',
        },
      });
      const requester = await prisma.user.create({
        data: {
          tenantId,
          email: 'requester@example.invalid',
          passwordHash: 'synthetic-not-a-login',
        },
      });
      const classroom = await prisma.class.create({
        data: { tenantId, name: 'Synthetic class', level: 1 },
      });
      const year = await prisma.academicYear.create({
        data: {
          tenantId,
          name: 'Synthetic year',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      const student = await prisma.student.create({
        data: {
          tenantId,
          classId: classroom.id,
          studentSystemId: randomUUID(),
          firstNameEn: 'Synthetic',
          lastNameEn: 'Student',
          gender: Gender.MALE,
          dateOfBirth: new Date('2018-01-01'),
          admissionDate: new Date('2026-01-01'),
        },
      });
      const session = await prisma.attendanceSession.create({
        data: {
          tenantId,
          academicYearId: year.id,
          classId: classroom.id,
          attendanceDate: new Date('2026-09-08'),
          lockAt: new Date('2026-09-09'),
          submittedAt: new Date('2026-09-08'),
          submittedById: requester.id,
        },
      });
      const record = await prisma.attendanceRecord.create({
        data: {
          tenantId,
          attendanceSessionId: session.id,
          studentId: student.id,
          status: AttendanceStatus.ABSENT,
        },
      });
      recordId = record.id;
      requestId = (
        await prisma.attendanceCorrectionRequest.create({
          data: {
            tenantId,
            attendanceRecordId: recordId,
            attendanceSessionId: session.id,
            studentId: student.id,
            attendanceDate: session.attendanceDate,
            requestedStatus: AttendanceStatus.PRESENT,
            previousStatus: AttendanceStatus.ABSENT,
            reason: 'Synthetic correction request',
            requestedById: requester.id,
          },
        })
      ).id;
      actor = {
        tenantId,
        tenantSlug: tenant.slug,
        userId: reviewer.id,
        email: reviewer.email,
        authMethod: AuthMethod.PASSWORD,
        roles: ['principal'],
        permissions: ['attendance:review_conflicts'],
      };
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (!tenantId) return;
    await scoped(async () => {
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.attendanceCorrectionRequest.deleteMany({
        where: { tenantId },
      });
      await prisma.attendanceRecord.deleteMany({ where: { tenantId } });
      await prisma.attendanceSession.deleteMany({ where: { tenantId } });
      await prisma.student.deleteMany({ where: { tenantId } });
      await prisma.academicYear.deleteMany({ where: { tenantId } });
      await prisma.class.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { tenantId } });
    });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  it('allows only one decision after both reviewers read PENDING', async () => {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const delegate = prisma.attendanceCorrectionRequest;
    const db = new Proxy(prisma, {
      get(target, key) {
        if (key === 'attendanceCorrectionRequest')
          return {
            ...delegate,
            findFirst: async (
              ...args: Parameters<typeof delegate.findFirst>
            ) => {
              const row = await delegate.findFirst(...args);
              if (++arrivals === 2) release();
              await barrier;
              return row;
            },
          };
        const value: unknown = Reflect.get(target, key);
        const resolved: unknown =
          typeof value === 'function'
            ? (value as (...args: unknown[]) => unknown).bind(target)
            : value;
        return resolved;
      },
    });
    const results = await Promise.allSettled([
      decide('APPROVED', service(db)),
      decide('REJECTED', service(db)),
    ]);
    expect(arrivals).toBe(2);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const loser = results.find((r) => r.status === 'rejected');
    if (!loser) throw new Error('Expected one competing decision to fail');
    expect(loser.reason).toBeInstanceOf(ConflictException);
    await scoped(async () => {
      const result = await prisma.attendanceCorrectionRequest.findFirstOrThrow({
        where: { id: requestId, tenantId },
      });
      const record = await prisma.attendanceRecord.findFirstOrThrow({
        where: { id: recordId, tenantId },
      });
      expect(record.status).toBe(
        result.status === 'APPROVED' ? 'PRESENT' : 'ABSENT',
      );
      const logs = await prisma.auditLog.findMany({
        where: { tenantId, resourceId: requestId },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(
        result.status === 'APPROVED' ? 'approve' : 'reject',
      );
    });
  });

  for (const status of ['APPROVED', 'REJECTED'] as const) {
    it(`rolls back ${status} and attendance when audit fails`, async () => {
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('synthetic audit outage'));
      await expect(decide(status)).rejects.toThrow('synthetic audit outage');
      await scoped(async () => {
        const correction =
          await prisma.attendanceCorrectionRequest.findFirstOrThrow({
            where: { id: requestId, tenantId },
          });
        expect(correction.status).toBe('PENDING');
        expect(correction.reviewedAt).toBeNull();
        expect(correction.reviewedById).toBeNull();
        const record = await prisma.attendanceRecord.findFirstOrThrow({
          where: { id: recordId, tenantId },
        });
        expect(record.status).toBe('ABSENT');
        expect(record.remark).toBeNull();
        expect(
          await prisma.auditLog.count({
            where: { tenantId, resourceId: requestId },
          }),
        ).toBe(0);
      });
      await expect(decide(status)).resolves.toMatchObject({ status });
    });
  }
});

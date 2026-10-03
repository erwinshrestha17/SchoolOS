import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  IsolatedAuthCls,
  authTestDatabaseUrl,
} from './helpers/auth-test-isolation';
import { AuthzCacheService } from '../src/auth/authz-cache.service';
import { ResourceOwnershipService } from '../src/authorization/resource-ownership';
import { AuthorizationService } from '../src/authorization/authorization.service';
import { grantAllows } from '../src/authorization/scopes/scope-resolver';
import { AuthMethod, type Prisma } from '@prisma/client';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
const suffix = randomUUID();
const now = new Date();
const cls = new IsolatedAuthCls();
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Incomplete fixture');
  return value;
}
interface IsolationDelegate {
  findFirst(args: { where: { id: string } }): Promise<unknown>;
  deleteMany(args: {
    where: { id?: string; tenantId?: string };
  }): Promise<{ count: number }>;
}
interface Fixture {
  tenantId: string;
  userId: string;
  roleId: string;
  assignmentId: string;
  classId: string;
  sectionId: string;
  subjectId: string;
  studentId: string;
  yearId: string;
  sessionId: string;
  examId: string;
  invoiceId: string;
  staffId: string;
  runId: string;
  accountId: string;
  journalId: string;
  noticeId: string;
  fileId: string;
  exportId: string;
}

describeDatabase(
  'Phase 1C/1D real persistence, scoped authority and priority isolation',
  () => {
    let db: PrismaService;
    let a: Fixture;
    let b: Fixture;
    const originalUrl = process.env.DATABASE_URL;
    beforeAll(async () => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      db = new PrismaService(cls as unknown as ClsService);
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      a = await fixture('a');
      b = await fixture('b');
    });
    afterAll(async () => {
      if (db) {
        for (const f of [a, b].filter(Boolean))
          await db.runWithTenantScope(f.tenantId, async () => {
            for (const delegate of [
              db.dataExportJob,
              db.notice,
              db.journalEntry,
              db.chartAccount,
              db.payrollRun,
              db.invoice,
              db.examTerm,
              db.attendanceSession,
              db.enrollment,
              db.student,
              db.staff,
              db.fileAsset,
              db.subject,
              db.section,
              db.class,
              db.academicYear,
              db.userRole,
              db.role,
              db.user,
            ])
              await (delegate as unknown as IsolationDelegate).deleteMany({
                where: { tenantId: f.tenantId },
              });
            await db.tenant.delete({ where: { id: f.tenantId } });
          });
        await db.$disconnect();
      }
      process.env.DATABASE_URL = originalUrl;
      jest.restoreAllMocks();
    });

    async function fixture(label: string): Promise<Fixture> {
      const tenant = await db.tenant.create({
        data: { name: `Phase1 ${label}`, slug: `phase1-${label}-${suffix}` },
      });
      return db.runWithTenantScope(tenant.id, async () => {
        const tenantId = tenant.id;
        const user = await db.user.create({
          data: {
            tenantId,
            email: `${label}-${suffix}@example.invalid`,
            status: 'ACTIVE',
          },
        });
        const role = await db.role.create({
          data: { tenantId, name: `reader-${label}-${suffix}` },
        });
        const permission = await db.permission.upsert({
          where: { resource_action: { resource: 'students', action: 'read' } },
          update: {},
          create: { resource: 'students', action: 'read' },
        });
        await db.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
        const assignment = await db.userRole.create({
          data: { tenantId, userId: user.id, roleId: role.id },
        });
        const year = await db.academicYear.create({
          data: {
            tenantId,
            name: `year-${suffix}`,
            startsOn: new Date('2026-01-01'),
            endsOn: new Date('2027-01-01'),
            isCurrent: true,
          },
        });
        const classroom = await db.class.create({
          data: { tenantId, name: `class-${suffix}`, level: 1 },
        });
        const section = await db.section.create({
          data: { tenantId, classId: classroom.id, name: 'A' },
        });
        const subject = await db.subject.create({
          data: {
            tenantId,
            classId: classroom.id,
            name: 'English',
            code: 'ENG',
            type: 'CORE',
          },
        });
        const student = await db.student.create({
          data: {
            tenantId,
            classId: classroom.id,
            sectionId: section.id,
            studentSystemId: `phase1-${label}-${suffix}`,
            firstNameEn: 'Synthetic',
            lastNameEn: 'Student',
            dateOfBirth: new Date('2016-01-01'),
            gender: 'OTHER',
            admissionDate: now,
          },
        });
        await db.enrollment.create({
          data: {
            tenantId,
            studentId: student.id,
            academicYearId: year.id,
            classId: classroom.id,
            sectionId: section.id,
            effectiveFrom: new Date('2026-01-01'),
            admissionDate: now,
            mediumOfInstruction: 'English',
          },
        });
        const session = await db.attendanceSession.create({
          data: {
            tenantId,
            academicYearId: year.id,
            classId: classroom.id,
            sectionId: section.id,
            attendanceDate: now,
            lockAt: now,
          },
        });
        const exam = await db.examTerm.create({
          data: {
            tenantId,
            academicYearId: year.id,
            name: 'Synthetic term',
            startsOn: now,
            endsOn: now,
          },
        });
        const invoice = await db.invoice.create({
          data: {
            tenantId,
            studentId: student.id,
            academicYearId: year.id,
            invoiceNumber: `phase1-${suffix}`,
            dueDate: now,
            subtotal: 0,
            vatAmount: 0,
            totalAmount: 0,
          },
        });
        const staff = await db.staff.create({
          data: {
            tenantId,
            userId: user.id,
            employeeId: `phase1-${suffix}`,
            firstName: 'Synthetic',
            lastName: 'Staff',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'OTHER',
            address: 'Synthetic',
            joiningDate: now,
            contractType: 'PERMANENT',
          },
        });
        const run = await db.payrollRun.create({
          data: {
            tenantId,
            periodMonth: 1,
            periodYear: 2083,
            // Baisakh 2083 (BS): 2026-04-14 .. 2026-05-14.
            periodStart: new Date('2026-04-14T00:00:00.000Z'),
            periodEnd: new Date('2026-05-14T23:59:59.999Z'),
          },
        });
        const account = await db.chartAccount.create({
          data: { tenantId, code: 'PHASE1', name: 'Synthetic', type: 'ASSET' },
        });
        const journal = await db.journalEntry.create({
          data: {
            tenantId,
            entryDate: now,
            narration: 'Synthetic',
            sourceType: 'MANUAL',
          },
        });
        const notice = await db.notice.create({
          data: {
            tenantId,
            title: 'Synthetic',
            body: 'Synthetic',
            createdById: user.id,
          },
        });
        const file = await db.fileAsset.create({
          data: {
            tenantId,
            objectKey: `${tenantId}/synthetic/${suffix}.pdf`,
            originalFilename: 'synthetic.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 0,
          },
        });
        const exp = await db.dataExportJob.create({
          data: {
            tenantId,
            exportKey: 'synthetic',
            format: 'csv',
            requestedById: user.id,
            fileAssetId: file.id,
          },
        });
        return {
          tenantId,
          userId: user.id,
          roleId: role.id,
          assignmentId: assignment.id,
          classId: classroom.id,
          sectionId: section.id,
          subjectId: subject.id,
          studentId: student.id,
          yearId: year.id,
          sessionId: session.id,
          examId: exam.id,
          invoiceId: invoice.id,
          staffId: staff.id,
          runId: run.id,
          accountId: account.id,
          journalId: journal.id,
          noticeId: notice.id,
          fileId: file.id,
          exportId: exp.id,
        };
      });
    }

    it.each([
      'studentId',
      'sessionId',
      'examId',
      'invoiceId',
      'staffId',
      'runId',
      'journalId',
      'noticeId',
      'fileId',
      'exportId',
    ] as const)(
      'guessed %s is invisible under another tenant for reads and mutations',
      async (key) => {
        const delegates = {
          studentId: db.student,
          sessionId: db.attendanceSession,
          examId: db.examTerm,
          invoiceId: db.invoice,
          staffId: db.staff,
          runId: db.payrollRun,
          journalId: db.journalEntry,
          noticeId: db.notice,
          fileId: db.fileAsset,
          exportId: db.dataExportJob,
        };
        await db.runWithTenantScope(a.tenantId, async () => {
          const delegate = delegates[key] as unknown as IsolationDelegate;
          expect(
            await delegate.findFirst({ where: { id: b[key] } }),
          ).toBeNull();
          expect(await delegate.deleteMany({ where: { id: b[key] } })).toEqual({
            count: 0,
          });
        });
        await db.runWithTenantScope(b.tenantId, async () => {
          expect(
            await (delegates[key] as unknown as IsolationDelegate).findFirst({
              where: { id: b[key] },
            }),
          ).not.toBeNull();
        });
      },
    );

    it('rejects nested foreign children in attendance, exams, fees, payroll, accounting, notices and exports', async () => {
      await db.runWithTenantScope(a.tenantId, async () => {
        const attempts = [
          () =>
            db.attendanceRecord.create({
              data: {
                tenantId: a.tenantId,
                attendanceSessionId: a.sessionId,
                studentId: b.studentId,
              },
            }),
          () =>
            db.assessmentComponent.create({
              data: {
                tenantId: a.tenantId,
                examTermId: a.examId,
                subjectId: b.subjectId,
                name: 'foreign',
                maxMarks: 100,
              },
            }),
          () =>
            db.invoice.create({
              data: {
                tenantId: a.tenantId,
                studentId: b.studentId,
                academicYearId: a.yearId,
                invoiceNumber: 'foreign',
                dueDate: now,
                subtotal: 0,
                vatAmount: 0,
                totalAmount: 0,
              },
            }),
          () =>
            db.payrollLine.create({
              data: {
                tenantId: a.tenantId,
                payrollRunId: a.runId,
                staffId: b.staffId,
                grossSalary: 0,
                netSalary: 0,
              },
            }),
          () =>
            db.journalLine.create({
              data: {
                tenantId: a.tenantId,
                journalEntryId: a.journalId,
                chartAccountId: b.accountId,
                side: 'DEBIT',
                amount: 0,
                debit: 0,
                credit: 0,
              },
            }),
          () =>
            db.notice.create({
              data: {
                tenantId: a.tenantId,
                title: 'Foreign',
                body: 'Foreign',
                classId: b.classId,
              },
            }),
          () =>
            db.dataExportJob.create({
              data: {
                tenantId: a.tenantId,
                exportKey: 'foreign',
                format: 'csv',
                fileAssetId: b.fileId,
              },
            }),
        ];
        for (const attempt of attempts)
          await expect(attempt()).rejects.toThrow(/Tenant-owned reference/);
      });
    });

    it('rolls back the entire mixed-tenant batch including its earlier authorized write', async () => {
      await db.runWithTenantScope(a.tenantId, async () => {
        await expect(
          db.$transaction(async (tx) => {
            await tx.attendanceRecord.create({
              data: {
                tenantId: a.tenantId,
                attendanceSessionId: a.sessionId,
                studentId: a.studentId,
              },
            });
            await tx.attendanceRecord.create({
              data: {
                tenantId: a.tenantId,
                attendanceSessionId: a.sessionId,
                studentId: b.studentId,
              },
            });
          }),
        ).rejects.toThrow(/Tenant-owned reference/);
        expect(
          await db.attendanceRecord.count({
            where: { attendanceSessionId: a.sessionId },
          }),
        ).toBe(0);
      });
    });

    it('checks raw SQL and prohibits tenant reassignment even outside ORM scoping', async () => {
      await db.runWithTenantScope(a.tenantId, async () => {
        await expect(
          db.$executeRaw`UPDATE "Class" SET "tenantId"=${b.tenantId} WHERE "id"=${a.classId}`,
        ).rejects.toThrow(/Tenant ownership is immutable/);
        await expect(
          db.$executeRaw`UPDATE "Student" SET "sectionId"=${b.sectionId} WHERE "id"=${a.studentId}`,
        ).rejects.toThrow(/Tenant-owned reference/);
      });
    });

    it('creates typed TENANT scope atomically and rejects legacy scoped writes and foreign role membership', async () => {
      await db.runWithTenantScope(a.tenantId, async () => {
        expect(
          await db.roleScopeGrant.findMany({
            where: { userRoleAssignmentId: a.assignmentId },
          }),
        ).toEqual([
          expect.objectContaining({ scopeType: 'TENANT', scopeId: a.tenantId }),
        ]);
        await expect(
          db.userRole.create({
            data: {
              tenantId: a.tenantId,
              userId: a.userId,
              roleId: a.roleId,
              scopeId: a.sectionId,
            },
          }),
        ).rejects.toThrow(/explicit typed grant/);
        await expect(
          db.userRole.create({
            data: { tenantId: a.tenantId, userId: b.userId, roleId: a.roleId },
          }),
        ).rejects.toThrow();
      });
    });

    async function replaceScopes(
      scopes: {
        scopeType: Prisma.RoleScopeGrantCreateManyInput['scopeType'];
        scopeId: string;
        expiresAt?: Date;
      }[],
    ) {
      await db.runWithTenantScope(a.tenantId, () =>
        db.$transaction(async (tx) => {
          await tx.roleScopeGrant.updateMany({
            where: { userRoleAssignmentId: a.assignmentId, supersededAt: null },
            data: { revokedAt: new Date(), supersededAt: new Date() },
          });
          await tx.roleScopeGrant.createMany({
            data: scopes.map((s) => ({
              tenantId: a.tenantId,
              userRoleAssignmentId: a.assignmentId,
              scopeType: s.scopeType,
              scopeId: s.scopeId,
              expiresAt: s.expiresAt ?? null,
              effectiveFrom: new Date('2020-01-01'),
            })),
          });
        }),
      );
    }

    it('uses live scope changes with explicit student/class/section/year inheritance and no flat widening', async () => {
      const resolver = new AuthzCacheService(db, {
        invalidate: async () => undefined,
      } as never);
      const ownership = new ResourceOwnershipService(db);
      await replaceScopes([
        { scopeType: 'CLASS', scopeId: a.classId },
        { scopeType: 'SECTION', scopeId: a.sectionId },
      ]);
      const authz = await resolver.resolve(a.tenantId, a.userId);
      expect(authz.permissions).toEqual([]);
      expect(authz.accessGrants?.[0].scopes).toHaveLength(2);
      const result = await db.runWithTenantScope(a.tenantId, () =>
        ownership.lookup(a.tenantId, 'STUDENT', a.studentId),
      );
      expect(result?.scope).toMatchObject({
        STUDENT: a.studentId,
        CLASS: a.classId,
        SECTION: a.sectionId,
        ACADEMIC_YEAR: a.yearId,
      });
      const kernel = new AuthorizationService();
      const input = {
        actor: {
          userId: a.userId,
          tenantId: a.tenantId,
          tenantSlug: 'synthetic',
          email: null,
          authMethod: AuthMethod.PASSWORD,
          ...authz,
        },
        identity: {
          tenantId: a.tenantId,
          securityDomain: 'SCHOOL' as const,
          userSessionActive: true,
          tenantActive: true,
        },
        trustedTenantId: a.tenantId,
        securityDomain: 'SCHOOL' as const,
        requestedPermissions: ['students:read'],
      };
      expect(await kernel.evaluate(input)).toMatchObject({
        outcome: 'DENY',
        reasonCode: 'SCOPE_MISMATCH',
      });
      expect(
        await kernel.evaluate({ ...input, resourceLookup: async () => result }),
      ).toMatchObject({ outcome: 'ALLOW' });
      await db.runWithTenantScope(a.tenantId, async () => {
        expect(
          await ownership.lookup(a.tenantId, 'STUDENT', b.studentId),
        ).toBeNull();
        await db.roleScopeGrant.updateMany({
          where: {
            userRoleAssignmentId: a.assignmentId,
            scopeType: 'SECTION',
            revokedAt: null,
          },
          data: { expiresAt: new Date('2021-01-01') },
        });
      });
      const expired = await resolver.resolve(a.tenantId, a.userId);
      expect(
        grantAllows(
          required(expired.accessGrants)[0],
          'students:read',
          a.tenantId,
          result?.scope,
        ),
      ).toBe(false);
      await db.runWithTenantScope(a.tenantId, () =>
        db.roleScopeGrant.updateMany({
          where: {
            userRoleAssignmentId: a.assignmentId,
            scopeType: 'SECTION',
            supersededAt: null,
          },
          data: { revokedAt: new Date() },
        }),
      );
      const revoked = await resolver.resolve(a.tenantId, a.userId);
      expect(required(revoked.accessGrants)[0].scopes).toHaveLength(2);
      expect(
        grantAllows(
          required(revoked.accessGrants)[0],
          'students:read',
          a.tenantId,
          result?.scope,
        ),
      ).toBe(false);
      await replaceScopes([{ scopeType: 'TENANT', scopeId: a.tenantId }]);
      expect(
        (await resolver.resolve(a.tenantId, a.userId)).permissions,
      ).toEqual(['students:read']);
      await db.runWithTenantScope(a.tenantId, () =>
        db.roleScopeGrant.updateMany({
          where: { userRoleAssignmentId: a.assignmentId },
          data: { revokedAt: new Date() },
        }),
      );
      expect(
        (await resolver.resolve(a.tenantId, a.userId)).permissions,
      ).toEqual([]);
    });

    it('denies deleted scoped targets, foreign targets and conflicting TENANT restrictions', async () => {
      await replaceScopes([{ scopeType: 'CLASS', scopeId: a.classId }]);
      await db.runWithTenantScope(a.tenantId, async () => {
        await expect(
          db.roleScopeGrant.create({
            data: {
              tenantId: a.tenantId,
              userRoleAssignmentId: a.assignmentId,
              scopeType: 'SECTION',
              scopeId: b.sectionId,
            },
          }),
        ).rejects.toThrow(/Invalid scope target/);
      });
      await replaceScopes([{ scopeType: 'CLASS', scopeId: a.classId }]);
      await db.runWithTenantScope(a.tenantId, async () => {
        await expect(
          db.roleScopeGrant.create({
            data: {
              tenantId: a.tenantId,
              userRoleAssignmentId: a.assignmentId,
              scopeType: 'TENANT',
              scopeId: a.tenantId,
            },
          }),
        ).rejects.toThrow(/Conflicting role scope/);
        const unused = await db.class.create({
          data: { tenantId: a.tenantId, name: `unused-${suffix}`, level: 1 },
        });
        await replaceScopes([{ scopeType: 'CLASS', scopeId: unused.id }]);
        await db.class.delete({ where: { id: unused.id } });
      });
      const resolver = new AuthzCacheService(db, {} as never);
      expect(
        (await resolver.resolve(a.tenantId, a.userId)).permissions,
      ).toEqual([]);
      expect((await resolver.resolve(a.tenantId, a.userId)).roles).toEqual([]);
    });
  },
);

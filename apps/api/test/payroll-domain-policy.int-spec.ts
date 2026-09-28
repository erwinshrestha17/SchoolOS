import domainTemplateV1 from './fixtures/phase2-domain-template-v1.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { systemRolePermissions } from '@schoolos/core';
import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { PayrollService } from '../src/payroll/payroll.service';
import { StaffService } from '../src/staff/staff.service';
import { StaffDocumentService } from '../src/staff/staff-document.service';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

// This suite proves policy, persistence and recovery. Readiness is a bounded
// double; it does not certify statutory policy or external salary payment.
const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 2 payroll duties (isolated PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let service: PayrollService;
  let staffService: StaffService;
  let documents: StaffDocumentService;
  let files: FileRegistryService;
  let audit: AuditService;
  let tenantId: string;
  let staffId: string;
  let salaryId: string;
  let runId: string;
  const actors: Record<string, AuthContext> = {};
  const oldUrl = process.env.DATABASE_URL;
  const accounting = { postPayrollAccrual: jest.fn() };
  const readiness = {
    assertActionAllowed: jest.fn().mockResolvedValue(undefined),
  };
  const permissions = [
    'hr:documents:read',
    'hr:documents:manage',
    'staff:read',
    'staff:update',
    'hr:manage',
    'hr:bank:read',
    'hr:bank:write',
    'hr:tax:read',
    'hr:tax:write',
    'hr:identity:read',
    'payroll:salary:read',
    'payroll:salary:write',
    'payroll:run:create',
    'payroll:run:validate',
    'payroll:run:review',
    'payroll:run:approve',
    'payroll:run:finalize',
    'payroll:run:post',
  ];
  const scope = <T>(work: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, work);
  const itTenant = (name: string, work: () => Promise<void>) => {
    it(name, () => scope(work));
  };
  const dbRun = () =>
    scope(() =>
      prisma.payrollRun.findFirstOrThrow({ where: { id: runId, tenantId } }),
    );
  const approve = async () => {
    await service.validatePayrollRun(runId, actors.preparer);
    await service.submitPayrollRunForReview(runId, actors.preparer);
    await service.reviewPayrollRun(runId, actors.reviewer);
    await service.approvePayrollRun(runId, actors.approver);
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    audit = new AuditService(prisma, cls);
    service = new PayrollService(
      prisma,
      audit,
      accounting as never,
      undefined,
      undefined,
      readiness as never,
    );
    staffService = new StaffService(
      prisma,
      {} as never,
      audit,
      {} as never,
      {} as never,
      {} as never,
    );
    files = new FileRegistryService(
      prisma,
      audit,
      {} as never,
      {} as never,
      {} as never,
      { assertTenantActive: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );
    documents = new StaffDocumentService(prisma, files, audit);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const suffix = randomUUID();
    await prisma.runWithoutTenantScope(
      'isolated Phase 2 payroll fixtures',
      async () => {
        const tenant = await prisma.tenant.create({
          data: { name: 'Phase 2 payroll test', slug: `p2-payroll-${suffix}` },
        });
        tenantId = tenant.id;
        const grants = await Promise.all(
          permissions.map(async (key) => {
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
        for (const name of [
          'preparer',
          'reviewer',
          'approver',
          'finalizer',
          'finalizer2',
          'posting',
        ]) {
          const user = await prisma.user.create({
            data: { tenantId, email: `${name}@example.test`, status: 'ACTIVE' },
          });
          const role = await prisma.role.create({
            data: {
              tenantId,
              name: `policy-test-${name}`,
              rolePermissions: {
                create: grants.map((grant) => ({ permissionId: grant.id })),
              },
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
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          actors[name] = {
            userId: user.id,
            tenantId,
            tenantSlug: tenant.slug,
            sessionFamilyId: familyId,
            email: user.email,
            authMethod: 'PASSWORD',
            roles: [role.name],
            permissions,
          };
        }
        const staff = await prisma.staff.create({
          data: {
            tenantId,
            userId: actors.preparer.userId,
            employeeId: 'EMP-P2',
            firstName: 'Synthetic',
            lastName: 'Staff',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'FEMALE',
            address: 'Test',
            joiningDate: new Date('2024-01-01'),
            contractType: 'PERMANENT',
            status: 'ACTIVE',
            bankAccount: 'synthetic-account',
            panNumber: 'synthetic-pan',
          },
        });
        staffId = staff.id;
        const salary = await prisma.salaryStructure.create({
          data: {
            tenantId,
            staffId,
            effectiveFrom: new Date('2024-01-01'),
            basicSalary: '45000',
            status: 'ACTIVE',
            paymentMethod: 'BANK',
          },
        });
        salaryId = salary.id;
        const run = await prisma.payrollRun.create({
          data: {
            tenantId,
            periodMonth: 5,
            periodYear: 2026,
            status: 'GENERATED',
            generatedById: actors.preparer.userId,
            grossAmount: '45000',
            netAmount: '45000',
            lines: {
              create: {
                tenantId,
                staffId,
                salaryStructureId: salaryId,
                grossSalary: '45000',
                netSalary: '45000',
              },
            },
          },
        });
        runId = run.id;
      },
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.runWithoutTenantScope(
      'remove only isolated Phase 2 fixtures',
      async () => {
        await prisma.auditLog.deleteMany({ where: { tenantId } });
        await prisma.payrollRun.updateMany({
          where: { tenantId },
          data: { predecessorRunId: null },
        });
        await prisma.payrollRun.deleteMany({ where: { tenantId } });
        await prisma.salaryStructure.deleteMany({ where: { tenantId } });
        await prisma.staffDocument.deleteMany({ where: { tenantId } });
        await prisma.fileAsset.deleteMany({ where: { tenantId } });
        await prisma.staff.deleteMany({ where: { tenantId } });
        await prisma.rolePermission.deleteMany({
          where: { role: { tenantId } },
        });
        await prisma.userRole.deleteMany({ where: { tenantId } });
        await prisma.role.deleteMany({ where: { tenantId } });
        await prisma.user.deleteMany({ where: { tenantId } });
        await prisma.tenant.delete({ where: { id: tenantId } });
      },
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
  });

  const staffFile = (module?: string, entityId?: string) =>
    prisma.fileAsset.create({
      data: {
        tenantId,
        uploadedByUserId: actors.preparer.userId,
        originalFilename: 'synthetic-certificate.pdf',
        objectKey: `${tenantId}/staff/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: BigInt(100),
        ...(module ? { module } : {}),
        ...(entityId ? { entityId } : {}),
      },
    });
  itTenant(
    'authorizes and audits staff documents and archives evidence without deleting history',
    async () => {
      const file = await staffFile();
      const doc = await documents.addDocument(
        staffId,
        {
          fileId: file.id,
          name: 'Synthetic qualification',
          kind: 'ACADEMIC_CERTIFICATE',
        },
        actors.preparer,
      );
      await documents.verifyDocument(
        doc.id,
        'Synthetic verification',
        actors.reviewer,
      );
      const asset = await files.getFileMetadata(tenantId, file.id);
      await expect(
        files.assertFileAccessForAuth(asset, actors.reviewer),
      ).resolves.toBeUndefined();
      await expect(
        files.assertFileAccessForAuth(asset, {
          ...actors.reviewer,
          roles: ['admin'],
          permissions: ['staff:read', 'hr:manage'],
        }),
      ).rejects.toThrow(ForbiddenException);
      await documents.deleteDocument(doc.id, actors.reviewer);
      const archived = await prisma.staffDocument.findFirstOrThrow({
        where: { id: doc.id, tenantId },
      });
      expect(archived).toMatchObject({
        status: 'ARCHIVED',
        verifiedById: actors.reviewer.userId,
      });
      await expect(
        files.assertFileAccessForAuth(asset, actors.reviewer),
      ).rejects.toThrow(NotFoundException);
      expect(
        await prisma.auditLog.count({
          where: { tenantId, resource: 'staff_document', resourceId: doc.id },
        }),
      ).toBe(4);
    },
  );
  itTenant('cannot repurpose a student file as a staff document', async () => {
    const file = await staffFile('student-documents', randomUUID());
    await expect(
      documents.addDocument(
        staffId,
        { fileId: file.id, name: 'Wrong source', kind: 'OTHER' },
        actors.preparer,
      ),
    ).rejects.toThrow(ConflictException);
    expect(await prisma.staffDocument.count({ where: { tenantId } })).toBe(0);
  });
  itTenant(
    'rolls back document creation and file linking when their audit append fails',
    async () => {
      const file = await staffFile();
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic document audit failure'));
      await expect(
        documents.addDocument(
          staffId,
          { fileId: file.id, name: 'Synthetic certificate', kind: 'OTHER' },
          actors.preparer,
        ),
      ).rejects.toThrow('Synthetic document audit failure');
      expect(await prisma.staffDocument.count({ where: { tenantId } })).toBe(0);
      expect(
        (
          await prisma.fileAsset.findFirstOrThrow({
            where: { tenantId, id: file.id },
          })
        ).module,
      ).toBeNull();
    },
  );
  itTenant(
    'rolls back staff document verification and archival when audit fails',
    async () => {
      const file = await staffFile();
      const doc = await documents.addDocument(
        staffId,
        { fileId: file.id, name: 'Synthetic certificate', kind: 'OTHER' },
        actors.preparer,
      );
      const spy = jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(
          new Error('Synthetic verification audit failure'),
        );
      await expect(
        documents.verifyDocument(doc.id, '', actors.reviewer),
      ).rejects.toThrow('Synthetic verification audit failure');
      expect(
        (
          await prisma.staffDocument.findFirstOrThrow({
            where: { tenantId, id: doc.id },
          })
        ).status,
      ).toBe('ACTIVE');
      spy.mockRejectedValueOnce(new Error('Synthetic archival audit failure'));
      await expect(
        documents.deleteDocument(doc.id, actors.reviewer),
      ).rejects.toThrow('Synthetic archival audit failure');
      expect(
        (
          await prisma.staffDocument.findFirstOrThrow({
            where: { tenantId, id: doc.id },
          })
        ).status,
      ).toBe('ACTIVE');
      expect(
        (
          await prisma.fileAsset.findFirstOrThrow({
            where: { tenantId, id: file.id },
          })
        ).status,
      ).toBe('UPLOADED');
    },
  );
  itTenant(
    'rechecks persisted staff document management permission before verification',
    async () => {
      const file = await staffFile();
      const doc = await documents.addDocument(
        staffId,
        { fileId: file.id, name: 'Synthetic certificate', kind: 'OTHER' },
        actors.preparer,
      );
      await prisma.rolePermission.deleteMany({
        where: {
          role: { tenantId, name: 'policy-test-reviewer' },
          permission: { resource: 'hr:documents', action: 'manage' },
        },
      });
      await expect(
        documents.verifyDocument(doc.id, '', actors.reviewer),
      ).rejects.toThrow(ForbiddenException);
      expect(
        (
          await prisma.staffDocument.findFirstOrThrow({
            where: { tenantId, id: doc.id },
          })
        ).status,
      ).toBe('ACTIVE');
    },
  );

  itTenant(
    'keeps salary, bank, tax and nested payroll evidence separate in Staff projections',
    async () => {
      await approve();
      const basic = await staffService.getStaffDetail(staffId, {
        ...actors.preparer,
        permissions: ['staff:read', 'hr:manage'],
      });
      expect(basic.allowedSensitiveFields.bankRead).toBe(false);
      expect(basic.bankAccount).not.toBe('synthetic-account');
      expect(basic.panNumber).not.toBe('synthetic-pan');
      expect(basic.salaryStructures?.[0]).toMatchObject({
        basicSalary: null,
        masked: true,
      });
      const salaryOnly = await staffService.getStaffDetail(staffId, {
        ...actors.preparer,
        permissions: ['staff:read', 'payroll:salary:read'],
      });
      expect(salaryOnly.salaryStructures?.[0]).toMatchObject({
        basicSalary: expect.anything(),
      });
      expect(JSON.stringify(salaryOnly)).not.toMatch(
        /synthetic-account|synthetic-pan|approvedSourceFingerprint/,
      );
      const structures = await service.listSalaryStructures(undefined, {
        ...actors.preparer,
        permissions: ['payroll:salary:read'],
      });
      expect(structures.items[0]).toMatchObject({
        bankAccount: null,
        bankName: null,
        pfEnabled: null,
        tdsEnabled: null,
      });
    },
  );
  itTenant(
    'requires every persisted protected-field grant despite cached permissions',
    async () => {
      await prisma.rolePermission.deleteMany({
        where: {
          role: { tenantId, name: 'policy-test-preparer' },
          permission: { resource: 'hr:bank', action: 'write' },
        },
      });
      await expect(
        staffService.updateStaff(
          staffId,
          { bankAccount: 'changed-account' },
          actors.preparer,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(
        (
          await prisma.staff.findFirstOrThrow({
            where: { id: staffId, tenantId },
          })
        ).bankAccount,
      ).toBe('synthetic-account');
    },
  );
  itTenant(
    'records protected field categories atomically and rolls back if audit append fails',
    async () => {
      await staffService.updateStaff(
        staffId,
        { bankAccount: 'changed-account' },
        actors.preparer,
      );
      const event = await prisma.auditLog.findFirstOrThrow({
        where: { tenantId, resource: 'staff', action: 'update' },
      });
      expect(event.after).toMatchObject({
        protectedFieldsUpdated: ['hr:bank:write'],
      });
      expect(JSON.stringify(event)).not.toMatch(
        /synthetic-account|changed-account/,
      );
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic staff audit failure'));
      await expect(
        staffService.updateStaff(
          staffId,
          { bankAccount: 'failed-account' },
          actors.preparer,
        ),
      ).rejects.toThrow('Synthetic staff audit failure');
      expect(
        (
          await prisma.staff.findFirstOrThrow({
            where: { id: staffId, tenantId },
          })
        ).bankAccount,
      ).toBe('changed-account');
    },
  );
  itTenant(
    'does not expose protected Staff records through Platform or support actors',
    async () => {
      for (const invalid of [
        { ...actors.preparer, securityDomain: 'PLATFORM' as const },
        { ...actors.preparer, roles: ['platform_super_admin'] },
        { ...actors.preparer, isSupportOverride: true },
      ])
        await expect(
          staffService.getStaffDetail(staffId, invalid),
        ).rejects.toThrow(ForbiddenException);
    },
  );

  itTenant(
    'records distinct review, approval and finalization and authorizes the row actions',
    async () => {
      await approve();
      const finalized = await service.finalizePayrollRun(
        runId,
        actors.finalizer,
      );
      expect(finalized).toMatchObject({
        status: 'FINALIZED',
        allowedActions: { canPost: true, canEdit: false, canReject: false },
      });
      const run = await dbRun();
      expect(run.reviewedById).toBe(actors.reviewer.userId);
      expect(run.approvedById).toBe(actors.approver.userId);
      expect(run.finalizedById).toBe(actors.finalizer.userId);
      expect(run.approvedSourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(
        await scope(() =>
          prisma.auditLog.count({ where: { tenantId, resourceId: runId } }),
        ),
      ).toBe(5);
      expect(
        await scope(() =>
          prisma.payslip.count({
            where: { tenantId, payrollRunId: runId, status: 'ISSUED' },
          }),
        ),
      ).toBe(1);
    },
  );

  itTenant(
    'denies preparer review and reviewer approval despite possession of every duty',
    async () => {
      await service.validatePayrollRun(runId, actors.preparer);
      await service.submitPayrollRunForReview(runId, actors.preparer);
      await expect(
        service.reviewPayrollRun(runId, actors.preparer),
      ).rejects.toThrow(ForbiddenException);
      await service.reviewPayrollRun(runId, actors.reviewer);
      await expect(
        service.approvePayrollRun(runId, actors.reviewer),
      ).rejects.toThrow(ForbiddenException);
      expect((await dbRun()).status).toBe('REVIEWED');
    },
  );

  itTenant(
    'requires current live session even after an action began with valid cached permissions',
    async () => {
      readiness.assertActionAllowed.mockImplementationOnce(async () => {
        await scope(() =>
          prisma.refreshToken.updateMany({
            where: { userId: actors.preparer.userId },
            data: { revokedAt: new Date() },
          }),
        );
      });
      await expect(
        service.validatePayrollRun(runId, actors.preparer),
      ).rejects.toThrow(UnauthorizedException);
      expect((await dbRun()).status).toBe('GENERATED');
    },
  );

  itTenant(
    'rechecks persisted grants rather than retaining removed permissions',
    async () => {
      await scope(() =>
        prisma.userRole.updateMany({
          where: { tenantId, userId: actors.preparer.userId },
          data: { revokedAt: new Date() },
        }),
      );
      await expect(
        service.validatePayrollRun(runId, actors.preparer),
      ).rejects.toThrow(ForbiddenException);
      expect((await dbRun()).status).toBe('GENERATED');
    },
  );

  itTenant(
    'blocks changed bank/source data until reason-bound return and fresh independent approval',
    async () => {
      await approve();
      await scope(() =>
        prisma.staff.update({
          where: { id: staffId, tenantId },
          data: { bankAccount: 'changed-synthetic-account' },
        }),
      );
      await expect(
        service.finalizePayrollRun(runId, actors.finalizer),
      ).rejects.toThrow(ConflictException);
      expect((await dbRun()).status).toBe('APPROVED');
      await service.rejectPayrollRun(
        runId,
        { reason: 'Bank evidence corrected' },
        actors.reviewer,
      );
      expect((await dbRun()).approvedSourceFingerprint).toBeNull();
      await approve();
      await expect(
        service.finalizePayrollRun(runId, actors.finalizer),
      ).resolves.toMatchObject({ status: 'FINALIZED' });
    },
  );

  itTenant(
    'rolls back finalization and payslips when the security audit cannot be appended',
    async () => {
      await approve();
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('injected audit storage failure'));
      await expect(
        service.finalizePayrollRun(runId, actors.finalizer),
      ).rejects.toThrow('injected audit storage failure');
      expect((await dbRun()).status).toBe('APPROVED');
      expect(
        await scope(() =>
          prisma.payslip.count({ where: { tenantId, payrollRunId: runId } }),
        ),
      ).toBe(0);
    },
  );

  itTenant(
    'preserves finalized history and void payslips while preparing a linked replacement',
    async () => {
      await approve();
      await service.finalizePayrollRun(runId, actors.finalizer);
      await expect(
        service.regeneratePayrollLines(runId, actors.preparer),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.rejectPayrollRun(
          runId,
          { reason: 'Unsafe edit' },
          actors.reviewer,
        ),
      ).rejects.toThrow(ConflictException);
      await service.cancelFinalizedPayrollRun(
        runId,
        { reason: 'Bank details need replacement' },
        actors.finalizer,
      );
      const replacement = await service.createPayrollRun(
        { periodMonth: 5, periodYear: 2026 },
        actors.preparer,
      );
      expect(replacement).toMatchObject({
        revision: 2,
        predecessorRunId: runId,
        status: 'GENERATED',
      });
      expect((await dbRun()).status).toBe('VOID');
      expect(
        await scope(() =>
          prisma.payslip.count({
            where: { tenantId, payrollRunId: runId, status: 'VOID' },
          }),
        ),
      ).toBe(1);
      await expect(
        scope(() =>
          prisma.payrollRun.create({
            data: { tenantId, periodMonth: 5, periodYear: 2026, revision: 3 },
          }),
        ),
      ).rejects.toMatchObject({ code: 'P2002' });
    },
  );

  itTenant(
    'allows only one concurrent finalization and one set of payslips',
    async () => {
      await approve();
      const results = await Promise.allSettled([
        service.finalizePayrollRun(runId, actors.finalizer),
        service.finalizePayrollRun(runId, actors.finalizer2),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      if (!rejected || rejected.status !== 'rejected') {
        throw new Error('Expected concurrent finalization to be rejected');
      }
      expect(rejected.reason).toBeInstanceOf(ConflictException);
      expect(
        await scope(() =>
          prisma.payslip.count({ where: { tenantId, payrollRunId: runId } }),
        ),
      ).toBe(1);
    },
  );

  itTenant(
    'blocks direct posting before finalization and posting by the approver',
    async () => {
      await approve();
      await expect(
        service.postPayrollRun(runId, actors.posting),
      ).rejects.toThrow(ConflictException);
      await service.finalizePayrollRun(runId, actors.finalizer);
      await expect(
        service.postPayrollRun(runId, actors.approver),
      ).rejects.toThrow(ForbiddenException);
      await scope(() =>
        prisma.salaryStructure.update({
          where: { id: salaryId, tenantId },
          data: { basicSalary: '46000' },
        }),
      );
      await expect(
        service.postPayrollRun(runId, actors.posting),
      ).rejects.toThrow(ConflictException);
      expect(accounting.postPayrollAccrual).not.toHaveBeenCalled();
    },
  );

  itTenant(
    'upgrades only the exact reviewed system template and preserves modified duty grants',
    async () => {
      const createRole = async (
        name: string,
        isSystem: boolean,
        keys: string[],
      ) => {
        const permissions = await Promise.all(
          keys.map(async (key) => {
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
        return prisma.role.create({
          data: {
            tenantId,
            name,
            isSystem,
            rolePermissions: {
              create: permissions.map((permission) => ({
                permissionId: permission.id,
              })),
            },
          },
        });
      };
      const baseline = systemRolePermissions.payroll_preparer.filter(
        (key) => key !== 'payroll:run:validate',
      );
      const preparer = await createRole('payroll_preparer', true, baseline);
      const modified = await createRole('payroll_approver', true, [
        ...systemRolePermissions.payroll_approver.filter(
          (key) => key !== 'payroll:run:finalize',
        ),
        'payroll:run:post',
      ]);
      const pool = new Pool({ connectionString: authTestDatabaseUrl });
      try {
        const migration = readFileSync(
          join(
            __dirname,
            '../prisma/migrations/20260927113000_phase2_payroll_templates/migration.sql',
          ),
          'utf8',
        );
        await pool.query(migration);
        await pool.query(migration);
      } finally {
        await pool.end();
      }
      const keys = async (roleId: string) =>
        (
          await prisma.rolePermission.findMany({
            where: { roleId },
            include: { permission: true },
          })
        ).map(
          ({ permission }) => `${permission.resource}:${permission.action}`,
        );
      expect(await keys(preparer.id)).toContain('payroll:run:validate');
      expect(await keys(modified.id)).not.toContain('payroll:run:finalize');
      expect(
        await prisma.auditLog.count({
          where: {
            tenantId,
            resourceId: preparer.id,
            action: 'upgrade_payroll_template',
          },
        }),
      ).toBe(1);
      const posting = await prisma.role.findUniqueOrThrow({
        where: { tenantId_name: { tenantId, name: 'posting_authority' } },
      });
      expect(
        await prisma.userRole.count({
          where: { tenantId, roleId: posting.id },
        }),
      ).toBe(0);
      expect((await keys(posting.id)).sort()).toEqual(
        [...domainTemplateV1.posting_authority].sort(),
      );
    },
  );

  itTenant(
    'denies cross-tenant direct IDs and platform/support payroll authority',
    async () => {
      const otherTenantId = randomUUID();
      await expect(
        prisma.runWithTenantScope(otherTenantId, () =>
          service.validatePayrollRun(runId, {
            ...actors.preparer,
            tenantId: otherTenantId,
          }),
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.validatePayrollRun(runId, {
          ...actors.preparer,
          securityDomain: 'PLATFORM',
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.validatePayrollRun(runId, {
          ...actors.preparer,
          isSupportOverride: true,
        }),
      ).rejects.toThrow(ForbiddenException);
    },
  );
});

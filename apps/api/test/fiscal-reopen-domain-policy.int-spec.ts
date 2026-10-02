import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { AccountingService } from '../src/accounting/accounting.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import { ApprovalWorkflowService } from '../src/advanced-operations/approval-workflow.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import { purgeGuardedLedgerRows } from './helpers/ledger-fixture';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase(
  'Phase 2 fiscal reopen approvals (isolated PostgreSQL)',
  () => {
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    const previousUrl = process.env.DATABASE_URL;
    let prisma: PrismaService;
    let audit: AuditService;
    let accounting: AccountingService;
    let approvals: ApprovalWorkflowService;
    let tenantId: string;
    let yearId: string;
    let periodId: string;
    const actors: Record<string, AuthContext> = {};
    const scope = <T>(work: () => Promise<T>) =>
      prisma.runWithTenantScope(tenantId, work);
    const itTenant = (name: string, work: () => Promise<void>) => {
      it(name, () => scope(work));
    };
    const year = () =>
      prisma.fiscalYear.findFirstOrThrow({ where: { id: yearId, tenantId } });
    const period = () =>
      prisma.fiscalPeriod.findFirstOrThrow({
        where: { id: periodId, tenantId },
      });
    const requestYear = () =>
      accounting.reopenFiscalYear(
        yearId,
        { reason: 'Correct a closed fiscal year with independent approval' },
        actors.requester,
      );
    const requestPeriod = () =>
      accounting.reopenFiscalPeriod(
        periodId,
        { reason: 'Correct a closed fiscal period with independent approval' },
        actors.requester,
      );

    beforeAll(() => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      audit = new AuditService(prisma, cls);
      approvals = new ApprovalWorkflowService(prisma, audit);
      accounting = new AccountingService(
        prisma,
        audit,
        new AccountingPostingService(prisma, audit),
        approvals,
      );
      accounting.onModuleInit();
    });
    beforeEach(async () => {
      await prisma.runWithoutTenantScope(
        'create only isolated Phase 2 fiscal fixtures',
        async () => {
          const tenant = await prisma.tenant.create({
            data: {
              name: 'Phase 2 fiscal test',
              slug: `p2-fiscal-${randomUUID()}`,
            },
          });
          tenantId = tenant.id;
          const keys = [
            'accounting:fiscal:reopen',
            'accounting:fiscal:manage',
            'advanced:approvals:decide',
            'advanced:approvals:manage',
          ];
          const grants = await Promise.all(
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
          for (const name of ['requester', 'approver', 'approver2']) {
            const user = await prisma.user.create({
              data: {
                tenantId,
                email: `${name}@example.test`,
                status: 'ACTIVE',
              },
            });
            const role = await prisma.role.create({
              data: {
                tenantId,
                name: `fiscal-test-${name}`,
                rolePermissions: {
                  create: grants.map((grant) => ({ permissionId: grant.id })),
                },
              },
            });
            await prisma.userRole.create({
              data: {
                tenantId,
                userId: user.id,
                roleId: role.id,
              },
            });
            const familyId = randomUUID();
            await prisma.refreshToken.create({
              data: {
                userId: user.id,
                familyId,
                tokenHash: randomUUID(),
                expiresAt: new Date(Date.now() + 120_000),
              },
            });
            actors[name] = {
              userId: user.id,
              tenantId,
              tenantSlug: tenant.slug,
              email: user.email,
              sessionFamilyId: familyId,
              authMethod: 'PASSWORD',
              roles: [role.name],
              permissions: keys,
            };
          }
          const fiscalYear = await prisma.fiscalYear.create({
            data: {
              tenantId,
              name: 'Synthetic closed year',
              startDate: new Date('2026-01-01'),
              endDate: new Date('2026-12-31'),
              status: 'CLOSED',
              closedAt: new Date(),
              closedById: actors.requester.userId,
              closeReason: 'Synthetic prior close',
            },
          });
          yearId = fiscalYear.id;
          periodId = (
            await prisma.fiscalPeriod.create({
              data: {
                tenantId,
                fiscalYearId: yearId,
                label: 'Synthetic May',
                periodNumber: 5,
                startDate: new Date('2026-05-01'),
                endDate: new Date('2026-05-31'),
                status: 'CLOSED',
                closedAt: new Date(),
                closedById: actors.requester.userId,
                closeReason: 'Synthetic prior close',
              },
            })
          ).id;
        },
      );
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      await prisma.runWithoutTenantScope(
        'remove only isolated Phase 2 fiscal fixtures',
        async () => {
          await purgeGuardedLedgerRows(tenantId);
          await prisma.auditLog.deleteMany({ where: { tenantId } });
          await prisma.approvalRequest.deleteMany({ where: { tenantId } });
          await prisma.approvalPolicy.deleteMany({ where: { tenantId } });
          await prisma.journalLine.deleteMany({ where: { tenantId } });
          await prisma.journalEntry.deleteMany({ where: { tenantId } });
          await prisma.journalEntrySequence.deleteMany({ where: { tenantId } });
          await prisma.chartAccount.deleteMany({ where: { tenantId } });
          await prisma.fiscalPeriod.deleteMany({ where: { tenantId } });
          await prisma.fiscalYear.deleteMany({ where: { tenantId } });
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
      await prisma.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    itTenant(
      'requires distinct approval before reopening a closed year and then its closed period',
      async () => {
        const yearRequest = await requestYear();
        expect(yearRequest.status).toBe('PENDING');
        expect((await year()).status).toBe('CLOSED');
        await expect(
          approvals.decide(
            yearRequest.id,
            { decision: 'APPROVE' },
            actors.requester,
          ),
        ).rejects.toThrow(ForbiddenException);
        const approvedYear = await approvals.decide(
          yearRequest.id,
          { decision: 'APPROVE' },
          actors.approver,
        );
        expect(approvedYear.status).toBe('APPLIED');
        expect((await year()).status).toBe('OPEN');
        expect((await period()).status).toBe('CLOSED');
        const periodRequest = await requestPeriod();
        expect((await period()).status).toBe('CLOSED');
        const approvedPeriod = await approvals.decide(
          periodRequest.id,
          { decision: 'APPROVE' },
          actors.approver2,
        );
        expect(approvedPeriod.status).toBe('APPLIED');
        expect((await period()).status).toBe('OPEN');
        expect((await period()).reopenReason).toBe(
          'Correct a closed fiscal period with independent approval',
        );
        expect(
          await prisma.auditLog.count({
            where: { tenantId, action: 'reopen' },
          }),
        ).toBe(2);
      },
    );
    itTenant(
      'permits one pending fiscal reopen request per target under concurrent submission',
      async () => {
        const attempts = await Promise.allSettled([
          requestYear(),
          requestYear(),
        ]);
        expect(
          attempts.filter((attempt) => attempt.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          await prisma.approvalRequest.count({
            where: {
              tenantId,
              workflowType: 'FISCAL_YEAR_REOPEN',
              targetId: yearId,
              status: 'PENDING',
            },
          }),
        ).toBe(1);
        await expect(requestYear()).rejects.toThrow(ConflictException);
      },
    );
    itTenant(
      'rolls back fiscal period close when its audit record fails',
      async () => {
        await prisma.fiscalYear.update({
          where: { id: yearId },
          data: { status: 'OPEN' },
        });
        await prisma.fiscalPeriod.update({
          where: { id: periodId },
          data: { status: 'LOCKED' },
        });
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(
            new Error('Synthetic fiscal close audit failure'),
          );
        await expect(
          accounting.closeFiscalPeriod(
            periodId,
            { reason: 'Close period after reconciliation review' },
            actors.requester,
          ),
        ).rejects.toThrow('Synthetic fiscal close audit failure');
        expect((await period()).status).toBe('LOCKED');
        jest.restoreAllMocks();
        expect(
          (
            await accounting.closeFiscalPeriod(
              periodId,
              { reason: 'Close period after reconciliation review' },
              actors.requester,
            )
          ).status,
        ).toBe('CLOSED');
      },
    );
    itTenant(
      'commits fiscal-year status, closing journal and audit as one transaction',
      async () => {
        await prisma.fiscalYear.update({
          where: { id: yearId },
          data: { status: 'OPEN' },
        });
        await prisma.fiscalPeriod.create({
          data: {
            tenantId,
            fiscalYearId: yearId,
            label: 'Synthetic December',
            periodNumber: 12,
            startDate: new Date('2026-12-01'),
            endDate: new Date('2026-12-31'),
            status: 'CLOSED',
            closedAt: new Date(),
            closedById: actors.requester.userId,
            closeReason: 'Synthetic prior close',
          },
        });
        const accounts = await Promise.all(
          [
            ['1001', 'Cash', 'ASSET'],
            ['4001', 'Revenue', 'REVENUE'],
            ['5001', 'Expense', 'EXPENSE'],
            ['3100', 'Retained earnings', 'EQUITY'],
          ].map(([code, name, type]) =>
            prisma.chartAccount.create({
              data: {
                tenantId,
                code,
                name,
                type: type as 'ASSET' | 'REVENUE' | 'EXPENSE' | 'EQUITY',
              },
            }),
          ),
        );
        const accountId = (code: string) => {
          const account = accounts.find((item) => item.code === code);
          if (!account) throw new Error(`Missing synthetic account ${code}`);
          return account.id;
        };
        // The ledger refuses postings into a closed period, so seed the posted
        // journal while the period is open, then restore its fixture state.
        const seededPeriod = await prisma.fiscalPeriod.findFirstOrThrow({
          where: { id: periodId },
          select: { status: true },
        });
        await prisma.fiscalPeriod.update({
          where: { id: periodId },
          data: { status: 'OPEN' },
        });
        await prisma.journalEntry.create({
          data: {
            tenantId,
            fiscalYearId: yearId,
            fiscalPeriodId: periodId,
            entryDate: new Date('2026-05-05'),
            entryNumber: `synthetic-${randomUUID()}`,
            narration: 'Synthetic revenue and expense before close',
            status: 'POSTED',
            sourceType: 'MANUAL',
            postedAt: new Date(),
            postedById: actors.requester.userId,
            lines: {
              create: [
                [accountId('1001'), 'DEBIT', 100],
                [accountId('4001'), 'CREDIT', 100],
                [accountId('5001'), 'DEBIT', 20],
                [accountId('1001'), 'CREDIT', 20],
              ].map(([chartAccountId, side, amount]) => ({
                tenantId,
                chartAccountId: String(chartAccountId),
                side: side as 'DEBIT' | 'CREDIT',
                amount: Number(amount),
                debit: side === 'DEBIT' ? Number(amount) : 0,
                credit: side === 'CREDIT' ? Number(amount) : 0,
              })),
            },
          },
        });
        await prisma.fiscalPeriod.update({
          where: { id: periodId },
          data: { status: seededPeriod.status },
        });
        const originalRecord = audit.record.bind(audit);
        jest.spyOn(audit, 'record').mockImplementation((event, tx) => {
          if (event.resource === 'fiscal_year' && event.action === 'close')
            throw new Error('Synthetic year close audit failure');
          return originalRecord(event, tx);
        });
        await expect(
          accounting.closeFiscalYear(
            yearId,
            { reason: 'Close the year after reviewed financial results' },
            actors.requester,
          ),
        ).rejects.toThrow('Synthetic year close audit failure');
        expect((await year()).status).toBe('OPEN');
        expect(
          await prisma.journalEntry.count({
            where: { tenantId, sourceType: 'CLOSING_ENTRY' },
          }),
        ).toBe(0);
        jest.restoreAllMocks();
        const result = await accounting.closeFiscalYear(
          yearId,
          { reason: 'Close the year after reviewed financial results' },
          actors.requester,
        );
        expect(result.fiscalYear.status).toBe('CLOSED');
        expect(result.closingEntry.sourceType).toBe('CLOSING_ENTRY');
        expect(
          await prisma.journalEntry.count({
            where: { tenantId, sourceType: 'CLOSING_ENTRY' },
          }),
        ).toBe(1);
      },
    );
    itTenant(
      'requires two distinct approvers when active policy raises the threshold',
      async () => {
        await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'Two independent approvers',
            minApprovals: 2,
            approverPermissions: ['advanced:approvals:decide'],
            isActive: true,
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
        });
        const request = await requestYear();
        expect(request.steps).toHaveLength(2);
        const first = await approvals.decide(
          request.id,
          { decision: 'APPROVE' },
          actors.approver,
        );
        expect(first.status).toBe('PENDING');
        expect((await year()).status).toBe('CLOSED');
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow(ForbiddenException);
        const second = await approvals.decide(
          request.id,
          { decision: 'APPROVE' },
          actors.approver2,
        );
        expect(second.status).toBe('APPLIED');
        expect((await year()).status).toBe('OPEN');
      },
    );
    itTenant(
      'replaces the active fiscal policy atomically and freezes the new threshold for later requests',
      async () => {
        const first = await approvals.createPolicy(
          {
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'First fiscal policy',
            minApprovals: 1,
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
          actors.requester,
        );
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(
            new Error('Synthetic fiscal policy audit failure'),
          );
        await expect(
          approvals.createPolicy(
            {
              workflowType: 'FISCAL_YEAR_REOPEN',
              name: 'Unaudited fiscal policy',
              minApprovals: 2,
              finalActionKey: 'accounting.fiscal_year.reopen',
            },
            actors.requester,
          ),
        ).rejects.toThrow('Synthetic fiscal policy audit failure');
        expect(
          await prisma.approvalPolicy.findMany({
            where: { tenantId, workflowType: 'FISCAL_YEAR_REOPEN' },
          }),
        ).toEqual([expect.objectContaining({ id: first.id, isActive: true })]);
        jest.restoreAllMocks();
        const second = await approvals.createPolicy(
          {
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'Two-person fiscal policy',
            minApprovals: 2,
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
          actors.requester,
        );
        expect(second.isActive).toBe(true);
        expect(
          await prisma.approvalPolicy.findUniqueOrThrow({
            where: { id: first.id },
          }),
        ).toMatchObject({ isActive: false });
        expect((await requestYear()).steps).toHaveLength(2);
        expect(
          await prisma.auditLog.count({
            where: {
              tenantId,
              resource: 'approval_policy',
              action: 'approval_policy_created',
            },
          }),
        ).toBe(2);
      },
    );
    itTenant(
      'requires both the configured role and permission, not either one alone',
      async () => {
        await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'Role and capability',
            approverRoles: ['fiscal-test-approver2'],
            approverPermissions: ['advanced:approvals:decide'],
            minApprovals: 1,
            isActive: true,
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
        });
        const request = await requestYear();
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow(ForbiddenException);
        expect((await year()).status).toBe('CLOSED');
        expect(
          (
            await approvals.decide(
              request.id,
              { decision: 'APPROVE' },
              actors.approver2,
            )
          ).status,
        ).toBe('APPLIED');
      },
    );
    itTenant(
      'freezes submitted approval steps when policy threshold changes afterward',
      async () => {
        const policy = await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'Frozen threshold',
            approverPermissions: ['advanced:approvals:decide'],
            minApprovals: 2,
            isActive: true,
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
        });
        const request = await requestYear();
        await prisma.approvalPolicy.update({
          where: { id: policy.id },
          data: { minApprovals: 3, isActive: false },
        });
        await approvals.decide(
          request.id,
          { decision: 'APPROVE' },
          actors.approver,
        );
        expect((await year()).status).toBe('CLOSED');
        expect(
          (
            await approvals.decide(
              request.id,
              { decision: 'APPROVE' },
              actors.approver2,
            )
          ).status,
        ).toBe('APPLIED');
      },
    );
    itTenant(
      'rejects changed fiscal year state after request and preserves approved retry evidence',
      async () => {
        const request = await requestYear();
        await prisma.fiscalYear.update({
          where: { id: yearId },
          data: { status: 'OPEN' },
        });
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow(ConflictException);
        const pending = await prisma.approvalRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
        expect(pending.status).toBe('APPROVED');
        expect(pending.finalActionStatus).toBe('READY');
        expect(
          await prisma.auditLog.count({
            where: { tenantId, resource: 'fiscal_year', action: 'reopen' },
          }),
        ).toBe(0);
      },
    );
    itTenant(
      'allows only one of two simultaneous approvers to decide a single pending step',
      async () => {
        const request = await requestYear();
        const results = await Promise.allSettled([
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver2,
          ),
        ]);
        expect(
          results.filter((row) => row.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          await prisma.approvalDecision.count({
            where: { tenantId, requestId: request.id },
          }),
        ).toBe(1);
        expect(
          await prisma.auditLog.count({
            where: { tenantId, resource: 'fiscal_year', action: 'reopen' },
          }),
        ).toBe(1);
      },
    );
    itTenant(
      'rolls back request, approval and final business mutation when their audit write fails',
      async () => {
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic request audit failure'));
        await expect(requestYear()).rejects.toThrow(
          'Synthetic request audit failure',
        );
        expect(
          await prisma.approvalRequest.count({ where: { tenantId } }),
        ).toBe(0);
        const request = await requestYear();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic approval audit failure'));
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow('Synthetic approval audit failure');
        expect(
          (
            await prisma.approvalRequest.findUniqueOrThrow({
              where: { id: request.id },
            })
          ).status,
        ).toBe('PENDING');
        expect(
          await prisma.approvalDecision.count({
            where: { tenantId, requestId: request.id },
          }),
        ).toBe(0);
        jest.restoreAllMocks();
        const record = audit.record.bind(audit);
        jest.spyOn(audit, 'record').mockImplementation((event, tx) => {
          if (event.resource === 'fiscal_year')
            throw new Error('Synthetic fiscal action audit failure');
          return record(event, tx);
        });
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow('Synthetic fiscal action audit failure');
        expect((await year()).status).toBe('CLOSED');
        const ready = await prisma.approvalRequest.findUniqueOrThrow({
          where: { id: request.id },
        });
        expect(ready.status).toBe('APPROVED');
        expect(ready.finalActionStatus).toBe('READY');
        jest.restoreAllMocks();
        expect(
          (await approvals.applyFinalAction(request.id, actors.approver))
            .status,
        ).toBe('APPLIED');
        expect((await year()).status).toBe('OPEN');
      },
    );
    itTenant(
      'denies revoked grants, expired sessions, forged targets and requester replay',
      async () => {
        const request = await requestYear();
        await expect(
          approvals.applyFinalAction(request.id, actors.approver),
        ).rejects.toThrow(ConflictException);
        await expect(
          approvals.applyFinalAction(request.id, actors.requester),
        ).rejects.toThrow(ForbiddenException);
        await prisma.userRole.updateMany({
          where: { tenantId, userId: actors.approver.userId },
          data: { revokedAt: new Date() },
        });
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow(ForbiddenException);
        await prisma.refreshToken.updateMany({
          where: { userId: actors.approver2.userId },
          data: { revokedAt: new Date() },
        });
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver2,
          ),
        ).rejects.toThrow(UnauthorizedException);
        await expect(
          approvals.createRequest(
            {
              workflowType: 'FISCAL_YEAR_REOPEN',
              title: 'Forged target',
              reason: 'Forged target change reason',
              targetModule: 'accounting',
              targetType: 'fiscal_year',
              targetId: randomUUID(),
              finalActionKey: 'accounting.fiscal_year.reopen',
              finalActionPayload: { reason: 'Forged target change reason' },
            },
            actors.requester,
          ),
        ).rejects.toThrow();
        expect((await year()).status).toBe('CLOSED');
      },
    );
    itTenant(
      'rechecks the approving role before a deferred fiscal reopen is applied',
      async () => {
        await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FISCAL_YEAR_REOPEN',
            name: 'Role-bound fiscal approval',
            approverRoles: ['fiscal-test-approver'],
            approverPermissions: ['advanced:approvals:decide'],
            finalActionKey: 'accounting.fiscal_year.reopen',
          },
        });
        const request = await requestYear();
        const record = audit.record.bind(audit);
        jest.spyOn(audit, 'record').mockImplementation((event, tx) => {
          if (event.resource === 'fiscal_year')
            throw new Error('Synthetic fiscal action audit failure');
          return record(event, tx);
        });
        await expect(
          approvals.decide(
            request.id,
            { decision: 'APPROVE' },
            actors.approver,
          ),
        ).rejects.toThrow('Synthetic fiscal action audit failure');
        jest.restoreAllMocks();
        await prisma.role.updateMany({
          where: { tenantId, name: 'fiscal-test-approver' },
          data: { name: 'fiscal-test-approver-renamed' },
        });
        await expect(
          approvals.applyFinalAction(request.id, actors.approver),
        ).rejects.toThrow(ForbiddenException);
        expect((await year()).status).toBe('CLOSED');
      },
    );
    itTenant(
      'blocks duplicate concurrent final actions at the approved request',
      async () => {
        const request = await requestYear();
        // The first call may auto-apply immediately; a replay returns APPLIED without another domain mutation.
        const result = await approvals.decide(
          request.id,
          { decision: 'APPROVE' },
          actors.approver,
        );
        const replay = await Promise.allSettled([
          approvals.applyFinalAction(request.id, actors.approver),
          approvals.applyFinalAction(request.id, actors.approver),
        ]);
        expect(result.status).toBe('APPLIED');
        await expect(
          approvals.applyFinalAction(request.id, actors.requester),
        ).rejects.toThrow(ForbiddenException);
        expect(replay.every((item) => item.status === 'fulfilled')).toBe(true);
        expect(
          await prisma.auditLog.count({
            where: { tenantId, resource: 'fiscal_year', action: 'reopen' },
          }),
        ).toBe(1);
      },
    );
  },
);

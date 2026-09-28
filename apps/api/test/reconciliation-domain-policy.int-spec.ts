import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { BankReconciliationService } from '../src/accounting/bank-reconciliation.service';
import { AccountingService } from '../src/accounting/accounting.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 2 reconciliation duties (isolated PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let audit: AuditService;
  let service: BankReconciliationService;
  let tenantId: string;
  let periodId: string;
  let yearId: string;
  let journalId: string;
  let lineId: string;
  let statementId: string;
  let sessionId: string;
  let debitAccountId: string;
  let creditAccountId: string;
  const actors: Record<string, AuthContext> = {};
  const previousUrl = process.env.DATABASE_URL;
  const permissions = ['read', 'manage', 'review', 'finalize'].map(
    (key) => `accounting:reconciliation:${key}`,
  );
  const scope = <T>(work: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, work);
  const itTenant = (name: string, work: () => Promise<void>) =>
    it(name, () => scope(work));
  const prepareDto = () => ({
    accountId: debitAccountId,
    fiscalPeriodId: periodId,
    statementFrom: '2026-05-01',
    statementTo: '2026-05-31',
    openingBankBalance: '0.00',
    closingBankBalance: '100.00',
    statementReference: 'Synthetic bank statement 2026-05',
  });
  const matched = () =>
    service.match(sessionId, statementId, lineId, actors.matcher);
  const submitted = async () => {
    await matched();
    return service.transition(sessionId, 'SUBMIT', undefined, actors.preparer);
  };
  const reviewed = async () => {
    await submitted();
    return service.transition(
      sessionId,
      'REVIEW',
      'Verified all matches and balances',
      actors.reviewer,
    );
  };
  const current = () =>
    prisma.bankReconciliationSession.findFirstOrThrow({
      where: { id: sessionId, tenantId },
    });
  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    audit = new AuditService(prisma, cls);
    service = new BankReconciliationService(
      prisma,
      audit,
      new AccountingPostingService(prisma, audit),
    );
  });
  beforeEach(async () => {
    await prisma.runWithoutTenantScope(
      'isolated Phase 2 reconciliation fixtures',
      async () => {
        const tenant = await prisma.tenant.create({
          data: {
            name: 'Phase 2 reconciliation test',
            slug: `p2-reconciliation-${randomUUID()}`,
          },
        });
        tenantId = tenant.id;
        const grants = await Promise.all(
          permissions.map((key) => {
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
          'matcher',
          'finalizer',
          'finalizer2',
        ]) {
          const user = await prisma.user.create({
            data: { tenantId, email: `${name}@example.test`, status: 'ACTIVE' },
          });
          const role = await prisma.role.create({
            data: {
              tenantId,
              name: `reconciliation-test-${name}`,
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
            permissions,
          };
        }
        const year = await prisma.fiscalYear.create({
          data: {
            tenantId,
            name: 'Synthetic 2026',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
          },
        });
        yearId = year.id;
        const period = await prisma.fiscalPeriod.create({
          data: {
            tenantId,
            fiscalYearId: year.id,
            label: 'Synthetic May',
            periodNumber: 5,
            startDate: new Date('2026-05-01'),
            endDate: new Date('2026-05-31'),
          },
        });
        periodId = period.id;
        debitAccountId = (
          await prisma.chartAccount.create({
            data: {
              tenantId,
              code: '1001',
              name: 'Synthetic cash',
              type: 'ASSET',
            },
          })
        ).id;
        creditAccountId = (
          await prisma.chartAccount.create({
            data: {
              tenantId,
              code: '4001',
              name: 'Synthetic revenue',
              type: 'REVENUE',
            },
          })
        ).id;
      },
    );
    await scope(async () => {
      const entry = await prisma.journalEntry.create({
        data: {
          tenantId,
          fiscalPeriodId: periodId,
          fiscalYearId: yearId,
          entryDate: new Date('2026-05-02'),
          narration: 'Synthetic posted reconciliation source',
          status: 'POSTED',
          sourceType: 'MANUAL',
          entryNumber: `synthetic-${randomUUID()}`,
          postedAt: new Date(),
          postedById: actors.preparer.userId,
          lines: {
            create: [
              {
                tenantId,
                chartAccountId: debitAccountId,
                debit: 100,
                credit: 0,
                side: 'DEBIT',
                amount: 100,
              },
              {
                tenantId,
                chartAccountId: creditAccountId,
                debit: 0,
                credit: 100,
                side: 'CREDIT',
                amount: 100,
              },
            ],
          },
        },
        include: { lines: true },
      });
      journalId = entry.id;
      lineId = entry.lines.find(
        (row) => row.chartAccountId === debitAccountId,
      )!.id;
      statementId = (
        await prisma.bankStatement.create({
          data: {
            tenantId,
            accountId: debitAccountId,
            statementDate: new Date('2026-05-02'),
            description: 'Synthetic normalized bank deposit',
            debitAmount: 100,
            creditAmount: 0,
          },
        })
      ).id;
      sessionId = (await service.prepare(prepareDto(), actors.preparer)).id;
    });
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.runWithoutTenantScope(
      'remove only isolated Phase 2 reconciliation fixtures',
      async () => {
        await prisma.bankReconciliationHistory.deleteMany({
          where: { tenantId },
        });
        await prisma.bankReconciliationMatch.deleteMany({
          where: { tenantId },
        });
        await prisma.bankReconciliationSession.deleteMany({
          where: { tenantId },
        });
        await prisma.bankStatement.deleteMany({ where: { tenantId } });
        await prisma.auditLog.deleteMany({ where: { tenantId } });
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
    await prisma?.$disconnect();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });

  itTenant(
    'persists prepare, independent review and finalization with exact balances and server actions',
    async () => {
      const prepared = await service.get(sessionId, actors.preparer);
      expect(prepared).toMatchObject({
        status: 'OPEN',
        closingBookBalance: '100.00',
        closingBankBalance: '100.00',
        difference: '0.00',
        unmatchedStatementCount: 1,
      });
      await reviewed();
      expect(
        (await service.get(sessionId, actors.reviewer)).allowedActions.finalize,
      ).toBe(false);
      const final = await service.transition(
        sessionId,
        'FINALIZE',
        'Independent final balance confirmation',
        actors.finalizer,
      );
      expect(final).toMatchObject({
        status: 'FINALIZED',
        createdById: actors.preparer.userId,
        reviewedById: actors.reviewer.userId,
        finalizedById: actors.finalizer.userId,
        issues: [],
      });
      expect(final.allowedActions).toEqual({
        manage: false,
        submit: false,
        review: false,
        return: false,
        finalize: false,
        cancel: false,
      });
      expect(
        await prisma.bankReconciliationHistory.count({
          where: { tenantId, sessionId },
        }),
      ).toBe(5);
      expect(
        await prisma.auditLog.count({
          where: { tenantId, resourceId: sessionId },
        }),
      ).toBe(5);
    },
  );
  itTenant(
    'denies preparer, matcher and submitter self-review despite all-duty grants',
    async () => {
      await submitted();
      for (const actor of [actors.preparer, actors.matcher])
        await expect(
          service.transition(
            sessionId,
            'REVIEW',
            'Independent review reason',
            actor,
          ),
        ).rejects.toThrow(ForbiddenException);
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
      ).rejects.toThrow(ConflictException);
      expect((await current()).status).toBe('SUBMITTED');
    },
  );
  itTenant(
    'denies preparer, matcher and reviewer finalization and missing durable review evidence',
    async () => {
      await reviewed();
      for (const actor of [actors.preparer, actors.matcher, actors.reviewer])
        await expect(
          service.transition(
            sessionId,
            'FINALIZE',
            'Independent final balance confirmation',
            actor,
          ),
        ).rejects.toThrow(ForbiddenException);
      await prisma.bankReconciliationSession.update({
        where: { id: sessionId },
        data: { reviewedById: null },
      });
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
      ).rejects.toThrow(ConflictException);
    },
  );
  itTenant(
    'blocks unresolved exceptions and preserves returned, corrected and rematched history',
    async () => {
      await service.transition(sessionId, 'SUBMIT', undefined, actors.preparer);
      await expect(
        service.transition(
          sessionId,
          'REVIEW',
          'Reviewed outstanding exception lines',
          actors.reviewer,
        ),
      ).rejects.toThrow(ConflictException);
      await service.transition(
        sessionId,
        'RETURN',
        'Matching exceptions require correction',
        actors.reviewer,
      );
      await matched();
      await service.unmatch(
        sessionId,
        statementId,
        'Incorrect initial match selection',
        actors.preparer,
      );
      await matched();
      await service.transition(sessionId, 'SUBMIT', undefined, actors.preparer);
      const review = await service.transition(
        sessionId,
        'REVIEW',
        'All matching exceptions resolved',
        actors.reviewer,
      );
      expect(
        review.matches.filter((row) => row.status === 'UNMATCHED'),
      ).toHaveLength(1);
      expect(
        review.matches.filter((row) => row.status === 'MATCHED'),
      ).toHaveLength(1);
    },
  );
  itTenant(
    'rejects altered statement and journal source after submission or review',
    async () => {
      await reviewed();
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { reference: 'Source changed after review' },
      });
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
      ).rejects.toThrow('evidence changed');
      expect((await current()).status).toBe('REVIEWED');
      await service.transition(
        sessionId,
        'RETURN',
        'Statement reference requires fresh review',
        actors.reviewer,
      );
      await service.transition(sessionId, 'SUBMIT', undefined, actors.preparer);
      await prisma.journalEntry.update({
        where: { id: journalId },
        data: { narration: 'Synthetic changed ledger source' },
      });
      await expect(
        service.transition(
          sessionId,
          'REVIEW',
          'Independent review reason',
          actors.reviewer,
        ),
      ).rejects.toThrow('evidence changed');
    },
  );
  itTenant(
    'requires exact amounts, same account, period and tenant for matching',
    async () => {
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { debitAmount: '99.99' },
      });
      await expect(matched()).rejects.toThrow('amounts must match');
      expect(
        await prisma.bankReconciliationMatch.count({ where: { tenantId } }),
      ).toBe(0);
      await expect(
        service.match(sessionId, statementId, randomUUID(), actors.matcher),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.match(sessionId, randomUUID(), lineId, actors.matcher),
      ).rejects.toThrow(NotFoundException);
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { debitAmount: 100, statementDate: new Date('2026-06-02') },
      });
      await expect(matched()).rejects.toThrow(NotFoundException);
    },
  );
  itTenant(
    'rejects duplicate concurrent matching and leaves one durable match',
    async () => {
      const results = await Promise.allSettled([
        matched(),
        service.match(sessionId, statementId, lineId, actors.preparer),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(
        await prisma.bankReconciliationMatch.count({
          where: { tenantId, sessionId, status: 'MATCHED' },
        }),
      ).toBe(1);
      expect((await current()).revision).toBe(2);
    },
  );
  itTenant(
    'rolls back an imported statement when audit fails and rechecks a revoked importer',
    async () => {
      const accounting = new AccountingService(
        prisma,
        audit,
        new AccountingPostingService(prisma, audit),
      );
      const lines = [
        {
          statementDate: '2026-05-03',
          description: 'Synthetic import requiring audit',
          debitAmount: 25,
        },
      ];
      jest.spyOn(audit, 'record').mockRejectedValueOnce(
        new Error('Synthetic import audit failure'),
      );
      await expect(
        accounting.importBankStatement(debitAccountId, lines, actors.preparer),
      ).rejects.toThrow('Synthetic import audit failure');
      expect(
        await prisma.bankStatement.count({
          where: { tenantId, description: lines[0].description },
        }),
      ).toBe(0);
      expect(
        await prisma.bankStatementImportBatch.count({ where: { tenantId } }),
      ).toBe(0);
      jest.restoreAllMocks();
      await prisma.userRole.updateMany({
        where: { tenantId, userId: actors.preparer.userId },
        data: { revokedAt: new Date() },
      });
      await expect(
        accounting.importBankStatement(debitAccountId, lines, actors.preparer),
      ).rejects.toThrow(ForbiddenException);
    },
  );
  itTenant(
    'serializes finalization and freezes final matching, balances and cancellation',
    async () => {
      await reviewed();
      const results = await Promise.allSettled([
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer2,
        ),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
      await expect(
        service.unmatch(
          sessionId,
          statementId,
          'Change final matching after approval',
          actors.preparer,
        ),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.amend(
          sessionId,
          {
            openingBankBalance: '0',
            closingBankBalance: '200',
            statementReference: 'Changed final statement',
            reason: 'Amend final statement balances',
          },
          actors.preparer,
        ),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.cancel(sessionId, 'Cancel finalized evidence', actors.preparer),
      ).rejects.toThrow(ConflictException);
    },
  );
  itTenant(
    'rejects closed or locked periods and inactive accounts without writing evidence',
    async () => {
      await prisma.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: 'CLOSED' },
      });
      await expect(matched()).rejects.toThrow(ConflictException);
      await prisma.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: 'OPEN' },
      });
      await prisma.chartAccount.update({
        where: { id: debitAccountId },
        data: { isActive: false },
      });
      await expect(matched()).rejects.toThrow(ConflictException);
      expect(
        (
          await prisma.bankStatement.findUniqueOrThrow({
            where: { id: statementId },
          })
        ).isReconciled,
      ).toBe(false);
      expect(
        await prisma.bankReconciliationMatch.count({ where: { tenantId } }),
      ).toBe(0);
    },
  );
  itTenant(
    'rolls matching, session claims and history back when atomic audit fails',
    async () => {
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic audit failure'));
      await expect(matched()).rejects.toThrow('Synthetic audit failure');
      expect((await current()).revision).toBe(1);
      expect(
        await prisma.bankReconciliationMatch.count({ where: { tenantId } }),
      ).toBe(0);
      expect(
        await prisma.bankReconciliationHistory.count({ where: { tenantId } }),
      ).toBe(1);
      expect(
        (
          await prisma.bankStatement.findUniqueOrThrow({
            where: { id: statementId },
          })
        ).isReconciled,
      ).toBe(false);
      await reviewed();
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(
          new Error('Synthetic finalization audit failure'),
        );
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
      ).rejects.toThrow('Synthetic finalization audit failure');
      expect((await current()).status).toBe('REVIEWED');
    },
  );
  itTenant(
    'denies expired sessions, revoked grants, Platform and support overrides at service boundary',
    async () => {
      await reviewed();
      await expect(
        service.get(sessionId, {
          ...actors.finalizer,
          securityDomain: 'PLATFORM',
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.get(sessionId, {
          ...actors.finalizer,
          isSupportOverride: true,
        }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.get(sessionId, {
          ...actors.finalizer,
          roles: ['platform_super_admin'],
        }),
      ).rejects.toThrow(ForbiddenException);
      await prisma.refreshToken.updateMany({
        where: { userId: actors.finalizer.userId },
        data: { revokedAt: new Date() },
      });
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await prisma.userRole.updateMany({
        where: { tenantId, userId: actors.finalizer2.userId },
        data: { revokedAt: new Date() },
      });
      await expect(
        service.transition(
          sessionId,
          'FINALIZE',
          'Independent final balance confirmation',
          actors.finalizer2,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect((await current()).status).toBe('REVIEWED');
    },
  );
  itTenant(
    'blocks fiscal close on provisional matches and stale final evidence',
    async () => {
      const accounting = new AccountingService(
        prisma,
        audit,
        new AccountingPostingService(prisma, audit),
      );
      await submitted();
      const pending = await accounting.getFiscalPeriodCloseReadiness(
        periodId,
        actors.preparer,
      );
      expect(pending.blockers.map((row) => row.code)).toContain(
        'UNFINALIZED_RECONCILIATIONS',
      );
      const yearPending = await accounting.getFiscalYearCloseReadiness(
        yearId,
        actors.preparer,
      );
      expect(yearPending.issues.map((row) => row.code)).toContain(
        'UNFINALIZED_RECONCILIATIONS',
      );
      await service.transition(
        sessionId,
        'REVIEW',
        'Reviewed all matching evidence',
        actors.reviewer,
      );
      await service.transition(
        sessionId,
        'FINALIZE',
        'Independent final balance confirmation',
        actors.finalizer,
      );
      const ready = await accounting.getFiscalPeriodCloseReadiness(
        periodId,
        actors.preparer,
      );
      expect(ready.blockers.map((row) => row.code)).not.toContain(
        'UNFINALIZED_RECONCILIATIONS',
      );
      await prisma.bankStatement.update({
        where: { id: statementId },
        data: { reference: 'Synthetic change after finalization' },
      });
      const stale = await accounting.getFiscalPeriodCloseReadiness(
        periodId,
        actors.preparer,
      );
      expect(stale.blockers.map((row) => row.code)).toContain(
        'UNFINALIZED_RECONCILIATIONS',
      );
    },
  );
  itTenant(
    'requires precise reported balances and reason-bound amendments, then preserves cancelled history',
    async () => {
      await expect(
        service.amend(
          sessionId,
          {
            openingBankBalance: '0',
            closingBankBalance: '100.005',
            statementReference: 'Synthetic amended bank statement',
            reason: 'Correct reported bank balance',
          },
          actors.preparer,
        ),
      ).rejects.toThrow(BadRequestException);
      await service.amend(
        sessionId,
        {
          openingBankBalance: '0',
          closingBankBalance: '99.99',
          statementReference: 'Synthetic amended bank statement',
          reason: 'Correct reported bank balance',
        },
        actors.preparer,
      );
      await matched();
      await service.transition(sessionId, 'SUBMIT', undefined, actors.preparer);
      await expect(
        service.transition(
          sessionId,
          'REVIEW',
          'Independent review reason',
          actors.reviewer,
        ),
      ).rejects.toThrow(ConflictException);
      await service.transition(
        sessionId,
        'RETURN',
        'Closing reported balance requires correction',
        actors.reviewer,
      );
      const cancelled = await service.cancel(
        sessionId,
        'Retain evidence of abandoned preparation',
        actors.preparer,
      );
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.matches[0].status).toBe('UNMATCHED');
      expect(
        (
          await prisma.bankStatement.findUniqueOrThrow({
            where: { id: statementId },
          })
        ).isReconciled,
      ).toBe(false);
      expect(
        (await service.prepare(prepareDto(), actors.preparer)).id,
      ).not.toBe(sessionId);
    },
  );
  itTenant(
    'rejects overlapping and unfinished sessions, unknown IDs and foreign account IDs',
    async () => {
      await expect(
        service.prepare(prepareDto(), actors.preparer),
      ).rejects.toThrow(ConflictException);
      await expect(service.get(randomUUID(), actors.preparer)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.prepare(
          { ...prepareDto(), accountId: randomUUID() },
          actors.preparer,
        ),
      ).rejects.toThrow(NotFoundException);
      await reviewed();
      await service.transition(
        sessionId,
        'FINALIZE',
        'Independent final balance confirmation',
        actors.finalizer,
      );
      await expect(
        service.prepare(prepareDto(), actors.preparer),
      ).rejects.toThrow(ConflictException);
    },
  );
});

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
import { AccountingService } from '../src/accounting/accounting.service';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';
import { purgeGuardedLedgerRows } from './helpers/ledger-fixture';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase('Phase 2 journal duties (isolated PostgreSQL)', () => {
  const cls = new IsolatedAuthCls() as unknown as ClsService;
  let prisma: PrismaService;
  let audit: AuditService;
  let service: AccountingService;
  let tenantId: string;
  let periodId: string;
  let journalId: string;
  let debitAccountId: string;
  let creditAccountId: string;
  const actors: Record<string, AuthContext> = {};
  const previousUrl = process.env.DATABASE_URL;
  const permissions = [
    'create',
    'submit',
    'review',
    'approve',
    'post',
    'reject',
    'cancel',
  ].map((duty) => `accounting:journals:${duty}`);
  const scope = <T>(work: () => Promise<T>) =>
    prisma.runWithTenantScope(tenantId, work);
  const itTenant = (name: string, work: () => Promise<void>) => {
    it(name, () => scope(work));
  };
  const draft = () =>
    service.createManualJournal(
      {
        entryDate: '2026-05-01',
        narration: 'Synthetic independent journal',
        lines: [
          { chartAccountId: debitAccountId, side: 'DEBIT', amount: 100 },
          { chartAccountId: creditAccountId, side: 'CREDIT', amount: 100 },
        ],
      },
      actors.preparer,
    );
  const approved = async () => {
    await service.submitManualJournal(journalId, {}, actors.preparer);
    await service.reviewManualJournal(journalId, {}, actors.reviewer);
    await service.approveManualJournal(journalId, {}, actors.approver);
  };
  const current = () =>
    prisma.journalEntry.findFirstOrThrow({
      where: { id: journalId, tenantId },
    });

  beforeAll(() => {
    process.env.DATABASE_URL = authTestDatabaseUrl;
    prisma = new PrismaService(cls);
    audit = new AuditService(prisma, cls);
    service = new AccountingService(
      prisma,
      audit,
      new AccountingPostingService(prisma, audit),
    );
  });
  beforeEach(async () => {
    await prisma.runWithoutTenantScope(
      'isolated Phase 2 journal fixtures',
      async () => {
        const tenant = await prisma.tenant.create({
          data: {
            name: 'Phase 2 journal test',
            slug: `p2-journal-${randomUUID()}`,
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
          'approver',
          'poster',
          'poster2',
        ]) {
          const user = await prisma.user.create({
            data: { tenantId, email: `${name}@example.test`, status: 'ACTIVE' },
          });
          const role = await prisma.role.create({
            data: {
              tenantId,
              name: `journal-test-${name}`,
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
    journalId = (await scope(draft)).id;
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.runWithoutTenantScope(
      'remove only isolated Phase 2 journal fixtures',
      async () => {
        await purgeGuardedLedgerRows(tenantId);
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
    'persists distinct review, approval, posting and server-authorized row actions',
    async () => {
      await approved();
      const before = await service.getJournalEntry(journalId, actors.approver);
      expect(before.allowedActions.post).toBe(false);
      const posted = await service.postApprovedManualJournal(
        journalId,
        {},
        actors.poster,
      );
      expect(posted).toMatchObject({
        status: 'POSTED',
        reviewedById: actors.reviewer.userId,
        approvedById: actors.approver.userId,
        postedById: actors.poster.userId,
      });
      expect(posted.entryNumber).toBeTruthy();
      expect(
        await prisma.auditLog.count({
          where: { tenantId, resourceId: journalId },
        }),
      ).toBe(5);
    },
  );
  itTenant(
    'denies creator review, direct approval and reviewer approval despite all-duty grants',
    async () => {
      await service.submitManualJournal(journalId, {}, actors.preparer);
      await expect(
        service.reviewManualJournal(journalId, {}, actors.preparer),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.approveManualJournal(journalId, {}, actors.approver),
      ).rejects.toThrow(ConflictException);
      await service.reviewManualJournal(journalId, {}, actors.reviewer);
      await expect(
        service.approveManualJournal(journalId, {}, actors.preparer),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.approveManualJournal(journalId, {}, actors.reviewer),
      ).rejects.toThrow(ForbiddenException);
      expect((await current()).status).toBe('REVIEWED');
    },
  );
  itTenant(
    'denies approver posting and missing durable approval evidence',
    async () => {
      await approved();
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.approver),
      ).rejects.toThrow(ForbiddenException);
      await prisma.journalEntry.update({
        where: { id: journalId },
        data: { approvedSourceFingerprint: null },
      });
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow(ConflictException);
      expect((await current()).status).toBe('APPROVED');
    },
  );
  itTenant(
    'denies changed source lines after approval without consuming a posting number',
    async () => {
      await approved();
      // Re-point one line at another account: shape-valid, so the database
      // accepts it, and only the approval fingerprint can catch it.
      await prisma.journalLine.updateMany({
        where: { tenantId, journalEntryId: journalId, side: 'DEBIT' },
        data: { chartAccountId: creditAccountId },
      });
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow(ConflictException);
      expect(
        await prisma.journalEntrySequence.count({ where: { tenantId } }),
      ).toBe(0);
    },
  );
  itTenant(
    'rejects changed debit/credit ledger columns after approval',
    async () => {
      await approved();
      // Phase 7.3: the inconsistent edit can no longer even be stored.
      await expect(
        prisma.journalLine.updateMany({
          where: { tenantId, journalEntryId: journalId, side: 'DEBIT' },
          data: { debit: '200' },
        }),
      ).rejects.toThrow(/JournalLine_amount_side_check/);
      expect((await current()).status).toBe('APPROVED');
      // The untouched journal still posts.
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).resolves.toMatchObject({ status: 'POSTED' });
    },
  );
  itTenant(
    'rejects posting when a journal account was deactivated after approval',
    async () => {
      await approved();
      await prisma.chartAccount.update({
        where: { id: debitAccountId },
        data: { isActive: false, archivedAt: new Date() },
      });
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow('no longer active');
      expect((await current()).status).toBe('APPROVED');
      expect(
        await prisma.journalEntrySequence.count({ where: { tenantId } }),
      ).toBe(0);
    },
  );
  itTenant('rejects a fiscal period closed after the form opened', async () => {
    await approved();
    await prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'CLOSED' },
    });
    await expect(
      service.postApprovedManualJournal(journalId, {}, actors.poster),
    ).rejects.toThrow('closed fiscal period');
    expect((await current()).status).toBe('APPROVED');
  });
  itTenant(
    'rolls back journal posting, sequence and status if audit append fails',
    async () => {
      await approved();
      jest
        .spyOn(audit, 'record')
        .mockRejectedValueOnce(new Error('Synthetic audit failure'));
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow('Synthetic audit failure');
      expect((await current()).status).toBe('APPROVED');
      expect(
        await prisma.journalEntrySequence.count({ where: { tenantId } }),
      ).toBe(0);
    },
  );
  itTenant('rolls back draft creation if audit append fails', async () => {
    jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('Synthetic audit failure'));
    await expect(draft()).rejects.toThrow('Synthetic audit failure');
    expect(await prisma.journalEntry.count({ where: { tenantId } })).toBe(1);
    expect(await prisma.journalLine.count({ where: { tenantId } })).toBe(2);
  });
  itTenant(
    'rechecks the persisted session before financial mutation',
    async () => {
      await approved();
      await prisma.refreshToken.updateMany({
        where: { userId: actors.poster.userId },
        data: { revokedAt: new Date() },
      });
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow(UnauthorizedException);
      expect((await current()).status).toBe('APPROVED');
    },
  );
  itTenant(
    'rechecks persisted role grants despite a stale caller projection',
    async () => {
      await approved();
      await prisma.rolePermission.deleteMany({
        where: {
          role: { tenantId, name: 'journal-test-poster' },
          permission: { resource: 'accounting:journals', action: 'post' },
        },
      });
      await expect(
        service.postApprovedManualJournal(journalId, {}, actors.poster),
      ).rejects.toThrow(ForbiddenException);
      expect((await current()).status).toBe('APPROVED');
    },
  );
  itTenant(
    'permits only one concurrent posting and allocates one journal number',
    async () => {
      await approved();
      const results = await Promise.allSettled([
        service.postApprovedManualJournal(journalId, {}, actors.poster),
        service.postApprovedManualJournal(journalId, {}, actors.poster2),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected?.status !== 'rejected')
        throw new Error('Expected one concurrent posting to be rejected');
      expect(rejected.reason).toBeInstanceOf(ConflictException);
      expect((await current()).status).toBe('POSTED');
      expect(
        (
          await prisma.journalEntrySequence.findFirstOrThrow({
            where: { tenantId },
          })
        ).lastValue,
      ).toBe(1);
    },
  );
  itTenant(
    'preserves Platform/support separation and denies direct cross-tenant IDs',
    async () => {
      await approved();
      for (const invalid of [
        { ...actors.poster, securityDomain: 'PLATFORM' as const },
        { ...actors.poster, roles: ['platform_super_admin'] },
        { ...actors.poster, isSupportOverride: true },
      ])
        await expect(
          service.postApprovedManualJournal(journalId, {}, invalid),
        ).rejects.toThrow(ForbiddenException);
      const other = await prisma.runWithoutTenantScope(
        'isolated unrelated ID fixture',
        () =>
          prisma.tenant.create({
            data: {
              name: 'Unrelated synthetic tenant',
              slug: `p2-unrelated-${randomUUID()}`,
            },
          }),
      );
      try {
        await expect(
          service.getJournalEntry(journalId, {
            ...actors.poster,
            tenantId: other.id,
          }),
        ).rejects.toThrow(NotFoundException);
      } finally {
        await prisma.runWithoutTenantScope(
          'remove isolated unrelated ID fixture',
          () => prisma.tenant.delete({ where: { id: other.id } }),
        );
      }
    },
  );
});

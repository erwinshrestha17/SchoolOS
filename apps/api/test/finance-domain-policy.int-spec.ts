import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import domainTemplateV2 from './fixtures/phase2-domain-template-v2.json';
import templateBaseline from './fixtures/phase2-domain-template-v1.json';
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
import { FinanceService } from '../src/finance/finance.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountingPostingService } from '../src/accounting/accounting-posting.service';
import type { AuthContext } from '../src/auth/auth.types';
import {
  authTestDatabaseUrl,
  IsolatedAuthCls,
} from './helpers/auth-test-isolation';

const describeDatabase = authTestDatabaseUrl ? describe : describe.skip;
describeDatabase(
  'Phase 2 financial correction duties (isolated PostgreSQL)',
  () => {
    const cls = new IsolatedAuthCls() as unknown as ClsService;
    let prisma: PrismaService;
    let audit: AuditService;
    let service: FinanceService;
    let paymentId: string;
    let invoiceId: string;
    let requestId: string;
    let tenantId: string;
    let periodId: string;
    let journalId: string;
    let debitAccountId: string;
    let creditAccountId: string;
    const actors: Record<string, AuthContext> = {};
    const previousUrl = process.env.DATABASE_URL;
    const permissions = [
      'payments:collect',
      'payments:refund:request',
      'payments:reverse:request',
      'payments:refund',
      'payments:reverse',
      'finance:approvals:read',
      'finance:approvals:review',
      'finance:approvals:decide',
    ];
    const scope = <T>(work: () => Promise<T>) =>
      prisma.runWithTenantScope(tenantId, work);
    const itTenant = (name: string, work: () => Promise<void>) => {
      it(name, () => scope(work));
    };
    const request = async (
      type: 'REFUND' | 'REVERSAL' = 'REFUND',
      amount = '40.00',
    ) => {
      const result = await (type === 'REFUND'
        ? service.requestRefund(
            paymentId,
            {
              amount,
              reason: 'Synthetic correction',
              idempotencyKey: randomUUID(),
            },
            actors.preparer,
          )
        : service.requestReversal(
            paymentId,
            { reason: 'Synthetic correction', idempotencyKey: randomUUID() },
            actors.preparer,
          ));
      requestId = result.id;
      return result;
    };
    const review = () =>
      service.reviewApprovalRequest(
        requestId,
        { status: 'REVIEWED', reviewNote: 'Synthetic review' },
        actors.reviewer,
      );
    const approve = () =>
      service.decideApprovalRequest(
        requestId,
        { status: 'APPROVED' },
        actors.approver,
      );
    const ready = async (type: 'REFUND' | 'REVERSAL' = 'REFUND') => {
      await request(type);
      await review();
      await approve();
    };
    const current = () =>
      prisma.financeApprovalRequest.findFirstOrThrow({
        where: { id: requestId, tenantId },
      });

    beforeAll(() => {
      process.env.DATABASE_URL = authTestDatabaseUrl;
      prisma = new PrismaService(cls);
      audit = new AuditService(prisma, cls);
      service = new FinanceService(
        prisma,
        audit,
        {} as never,
        new AccountingPostingService(prisma, audit),
        new EventEmitter2(),
        {} as never,
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
              data: {
                tenantId,
                email: `${name}@example.test`,
                status: 'ACTIVE',
              },
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
              startDate: new Date('2026-01-01'),
              endDate: new Date('2026-12-31'),
            },
          });
          periodId = period.id;
          debitAccountId = (
            await prisma.chartAccount.create({
              data: {
                tenantId,
                code: '1000',
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
        const academicYear = await prisma.academicYear.create({
          data: {
            tenantId,
            name: 'Synthetic 2026',
            startsOn: new Date('2026-01-01'),
            endsOn: new Date('2026-12-31'),
          },
        });
        const classroom = await prisma.class.create({
          data: { tenantId, name: 'Synthetic class', level: 1 },
        });
        const student = await prisma.student.create({
          data: {
            tenantId,
            classId: classroom.id,
            studentSystemId: randomUUID(),
            firstNameEn: 'Synthetic',
            lastNameEn: 'Student',
            gender: 'OTHER',
            dateOfBirth: new Date('2016-01-01'),
            admissionDate: new Date('2026-01-01'),
          },
        });
        const invoice = await prisma.invoice.create({
          data: {
            tenantId,
            studentId: student.id,
            academicYearId: academicYear.id,
            invoiceNumber: 'SYNTHETIC-INVOICE',
            dueDate: new Date(),
            subtotal: 100,
            vatAmount: 0,
            totalAmount: 100,
            status: 'PAID',
            paidAt: new Date(),
          },
        });
        invoiceId = invoice.id;
        const payment = await prisma.payment.create({
          data: {
            tenantId,
            studentId: student.id,
            invoiceId,
            method: 'CASH',
            amount: 100,
            paidAt: new Date(),
            collectedById: actors.preparer.userId,
          },
        });
        paymentId = payment.id;
        await prisma.paymentAllocation.create({
          data: { tenantId, paymentId, invoiceId, amount: 100 },
        });
        const period = await prisma.fiscalPeriod.findFirstOrThrow({
          where: { id: periodId, tenantId },
        });
        journalId = (
          await prisma.journalEntry.create({
            data: {
              tenantId,
              fiscalYearId: period.fiscalYearId,
              fiscalPeriodId: periodId,
              entryDate: new Date(),
              narration: 'Synthetic posted payment source',
              status: 'POSTED',
              sourceModule: 'FINANCE',
              sourceType: 'FEE_PAYMENT',
              sourceId: paymentId,
              entryNumber: 'SYNTHETIC-JE',
              lines: {
                create: [
                  {
                    tenantId,
                    chartAccountId: debitAccountId,
                    lineNumber: 1,
                    side: 'DEBIT',
                    amount: 100,
                    debit: 100,
                    credit: 0,
                  },
                  {
                    tenantId,
                    chartAccountId: creditAccountId,
                    lineNumber: 2,
                    side: 'CREDIT',
                    amount: 100,
                    debit: 0,
                    credit: 100,
                  },
                ],
              },
            },
          })
        ).id;
      });
    });
    afterEach(async () => {
      jest.restoreAllMocks();
      await prisma.runWithoutTenantScope(
        'remove only isolated Phase 2 journal fixtures',
        async () => {
          await prisma.auditLog.deleteMany({ where: { tenantId } });
          await prisma.cashierClose.deleteMany({ where: { tenantId } });
          await prisma.financeApprovalDecision.deleteMany({
            where: { tenantId },
          });
          await prisma.financeApprovalRequestHistory.deleteMany({
            where: { tenantId },
          });
          await prisma.financeApprovalRequest.deleteMany({
            where: { tenantId },
          });
          await prisma.approvalPolicy.deleteMany({ where: { tenantId } });
          await prisma.paymentAllocation.deleteMany({ where: { tenantId } });
          await prisma.paymentRefund.deleteMany({ where: { tenantId } });
          await prisma.payment.deleteMany({ where: { tenantId } });
          await prisma.invoice.deleteMany({ where: { tenantId } });
          await prisma.student.deleteMany({ where: { tenantId } });
          await prisma.class.deleteMany({ where: { tenantId } });
          await prisma.academicYear.deleteMany({ where: { tenantId } });
          await prisma.accountingPostingItem.deleteMany({
            where: { tenantId },
          });
          await prisma.accountingPostingBatch.deleteMany({
            where: { tenantId },
          });
          await prisma.journalLine.deleteMany({ where: { tenantId } });
          await prisma.journalEntry.deleteMany({
            where: { tenantId, reversalOfId: { not: null } },
          });
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
      'requires independent review, approval and execution and replays one exact refund',
      async () => {
        const requested = await request();
        expect(requested.allowedActions).toMatchObject({
          review: false,
          approve: false,
          execute: false,
        });
        expect(requested).not.toHaveProperty('sourceFingerprint');
        expect(requested).not.toHaveProperty('policySnapshot');
        await review();
        const approved = await approve();
        expect(approved.status).toBe('APPROVED');
        expect(approved.allowedActions.execute).toBe(false);
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          0,
        );
        expect(
          (await service.executeApprovalRequest(requestId, actors.poster))
            .status,
        ).toBe('EXECUTED');
        await service.executeApprovalRequest(requestId, actors.poster);
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          1,
        );
        expect(
          await prisma.journalEntry.count({
            where: { tenantId, sourceType: 'PAYMENT_REFUND' },
          }),
        ).toBe(1);
        expect(
          (await prisma.invoice.findFirstOrThrow({ where: { id: invoiceId } }))
            .status,
        ).toBe('PARTIAL');
        expect((await current()).executedById).toBe(actors.poster.userId);
      },
    );
    itTenant(
      'denies all-duty preparer, reviewer and approver self elevation',
      async () => {
        await request();
        await expect(
          service.reviewApprovalRequest(
            requestId,
            { status: 'REVIEWED' },
            actors.preparer,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(approve()).rejects.toBeInstanceOf(ConflictException);
        await review();
        await expect(
          service.decideApprovalRequest(
            requestId,
            { status: 'APPROVED' },
            actors.reviewer,
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await approve();
        for (const actor of [actors.preparer, actors.reviewer, actors.approver])
          await expect(
            service.executeApprovalRequest(requestId, actor),
          ).rejects.toBeInstanceOf(ForbiddenException);
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          0,
        );
      },
    );
    itTenant(
      'rejects direct refund execution without approved request evidence',
      async () => {
        await expect(
          service.refundPayment(
            paymentId,
            { amount: '10.00', reason: 'Bypass', idempotencyKey: randomUUID() },
            actors.poster,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        await ready();
        await expect(
          service.refundPayment(
            paymentId,
            {
              amount: '41.00',
              reason: 'Synthetic correction',
              idempotencyKey: `finance-request:${requestId}`,
            },
            actors.poster,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
        await expect(
          service.refundPayment(
            paymentId,
            {
              amount: '40.00',
              reason: 'Changed reason',
              idempotencyKey: `finance-request:${requestId}`,
            },
            actors.poster,
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );
    itTenant(
      'checks original and remaining amount and refuses reversed or refunded sources',
      async () => {
        await expect(request('REFUND', '100.01')).rejects.toBeInstanceOf(
          ConflictException,
        );
        await expect(request('REFUND', '0.001')).rejects.toBeDefined();
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'REVERSED' },
        });
        await expect(request()).rejects.toBeInstanceOf(ConflictException);
        await prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'SUCCESS' },
        });
        await ready();
        await service.executeApprovalRequest(requestId, actors.poster);
        await expect(request('REFUND', '60.01')).rejects.toBeInstanceOf(
          ConflictException,
        );
        await expect(request('REVERSAL')).rejects.toBeInstanceOf(
          ConflictException,
        );
      },
    );
    itTenant(
      'invalidates pending approval and execution when source or policy changes',
      async () => {
        await ready();
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { totalAmount: 101 },
        });
        await expect(
          service.executeApprovalRequest(requestId, actors.poster),
        ).rejects.toBeInstanceOf(ConflictException);
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { totalAmount: 100 },
        });
        const policy = await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FEE_REVERSAL_REFUND',
            name: 'Changed threshold',
            minApprovals: 2,
          },
        });
        await expect(
          service.executeApprovalRequest(requestId, actors.poster),
        ).rejects.toBeInstanceOf(ConflictException);
        await service.decideApprovalRequest(
          requestId,
          { status: 'REJECTED', reviewNote: 'Policy changed' },
          actors.approver,
        );
        await request();
        await review();
        await prisma.approvalPolicy.update({
          where: { id: policy.id },
          data: { minApprovals: 3 },
        });
        await expect(approve()).rejects.toBeInstanceOf(ConflictException);
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          0,
        );
      },
    );
    itTenant(
      'counts distinct approvals and binds configured approver requirements',
      async () => {
        await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FEE_REVERSAL_REFUND',
            name: 'Two independent decisions',
            minApprovals: 2,
            approverPermissions: ['finance:approvals:decide'],
          },
        });
        await request();
        await review();
        expect((await approve()).status).toBe('REVIEWED');
        await expect(approve()).rejects.toBeInstanceOf(ConflictException);
        expect(
          (
            await service.decideApprovalRequest(
              requestId,
              { status: 'APPROVED' },
              actors.poster2,
            )
          ).status,
        ).toBe('APPROVED');
        expect(
          (await service.executeApprovalRequest(requestId, actors.poster))
            .status,
        ).toBe('EXECUTED');
      },
    );
    itTenant(
      'hides approval and denies execution by users outside configured approver roles',
      async () => {
        await prisma.approvalPolicy.create({
          data: {
            tenantId,
            workflowType: 'FEE_REVERSAL_REFUND',
            name: 'Designated authority',
            approverRoles: [actors.poster2.roles[0]],
            approverPermissions: ['finance:approvals:decide'],
          },
        });
        await request();
        await review();
        const queue = await service.listApprovalRequests({}, actors.approver);
        expect(queue.items[0].allowedActions.approve).toBe(false);
        await expect(approve()).rejects.toBeInstanceOf(ForbiddenException);
        expect(
          (
            await service.decideApprovalRequest(
              requestId,
              { status: 'APPROVED' },
              actors.poster2,
            )
          ).status,
        ).toBe('APPROVED');
        await service.executeApprovalRequest(requestId, actors.poster);
      },
    );
    itTenant(
      'denies execution after fiscal closure and rolls back the processing claim',
      async () => {
        await ready();
        await prisma.fiscalPeriod.update({
          where: { id: periodId },
          data: { status: 'CLOSED' },
        });
        await expect(
          service.executeApprovalRequest(requestId, actors.poster),
        ).rejects.toBeInstanceOf(ConflictException);
        expect((await current()).status).toBe('APPROVED');
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          0,
        );
      },
    );
    itTenant(
      'rolls back refund, ledger, allocation, numbering and request if audit fails',
      async () => {
        await ready();
        const record = audit.record.bind(audit);
        jest.spyOn(audit, 'record').mockImplementation(async (input, tx) => {
          if (input.resource === 'payment_refund')
            throw new Error('Synthetic audit failure');
          return record(input, tx);
        });
        await expect(
          service.executeApprovalRequest(requestId, actors.poster),
        ).rejects.toThrow('Synthetic audit failure');
        expect((await current()).status).toBe('APPROVED');
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          0,
        );
        expect(
          await prisma.journalEntry.count({
            where: { tenantId, sourceType: 'PAYMENT_REFUND' },
          }),
        ).toBe(0);
        expect(
          await prisma.paymentAllocation.count({ where: { tenantId } }),
        ).toBe(1);
        expect(
          await prisma.journalEntrySequence.count({ where: { tenantId } }),
        ).toBe(0);
      },
    );
    itTenant(
      'reverses exactly once with preserved source and idempotent execution history',
      async () => {
        await ready('REVERSAL');
        await service.executeApprovalRequest(requestId, actors.poster);
        await service.executeApprovalRequest(requestId, actors.poster);
        expect((await current()).status).toBe('EXECUTED');
        expect(
          (await prisma.payment.findFirstOrThrow({ where: { id: paymentId } }))
            .status,
        ).toBe('REVERSED');
        expect(
          await prisma.journalEntry.count({
            where: { tenantId, sourceType: 'REVERSAL' },
          }),
        ).toBe(1);
        expect(
          (
            await prisma.journalEntry.findFirstOrThrow({
              where: { id: journalId },
            })
          ).status,
        ).toBe('REVERSED');
      },
    );
    itTenant(
      'rechecks revoked permission and expired approval session inside the transaction',
      async () => {
        await request();
        await review();
        await prisma.refreshToken.updateMany({
          where: { userId: actors.approver.userId },
          data: { expiresAt: new Date(0) },
        });
        await expect(approve()).rejects.toBeInstanceOf(UnauthorizedException);
        await prisma.refreshToken.updateMany({
          where: { userId: actors.approver.userId },
          data: { expiresAt: new Date(Date.now() + 120_000) },
        });
        await prisma.rolePermission.deleteMany({
          where: {
            role: { userRoles: { some: { userId: actors.approver.userId } } },
            permission: { resource: 'finance:approvals', action: 'decide' },
          },
        });
        await expect(approve()).rejects.toBeInstanceOf(ForbiddenException);
        expect((await current()).status).toBe('REVIEWED');
      },
    );
    itTenant(
      'preserves Platform/support separation and tenant scope despite school duty grants',
      async () => {
        await request();
        for (const actor of [
          { ...actors.reviewer, roles: ['platform_super_admin'] },
          { ...actors.reviewer, isSupportOverride: true },
        ])
          await expect(
            service.reviewApprovalRequest(
              requestId,
              { status: 'REVIEWED' },
              actor as AuthContext,
            ),
          ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
          service.reviewApprovalRequest(
            randomUUID(),
            { status: 'REVIEWED' },
            actors.reviewer,
          ),
        ).rejects.toBeInstanceOf(NotFoundException);
      },
    );
    itTenant(
      'prevents concurrent double execution and keeps one financial history',
      async () => {
        await ready();
        const outcomes = await Promise.allSettled([
          service.executeApprovalRequest(requestId, actors.poster),
          service.executeApprovalRequest(requestId, actors.poster2),
        ]);
        expect(outcomes.some((outcome) => outcome.status === 'fulfilled')).toBe(
          true,
        );
        expect(await prisma.paymentRefund.count({ where: { tenantId } })).toBe(
          1,
        );
        expect(
          await prisma.financeApprovalRequestHistory.count({
            where: { tenantId, requestId, action: 'EXECUTED' },
          }),
        ).toBe(1);
      },
    );
    itTenant(
      'rolls back preparation, review and approval evidence when their audit write fails',
      async () => {
        const spy = jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(
            new Error('Synthetic preparation audit failure'),
          );
        await expect(request()).rejects.toThrow(
          'Synthetic preparation audit failure',
        );
        expect(
          await prisma.financeApprovalRequest.count({ where: { tenantId } }),
        ).toBe(0);
        spy.mockRestore();
        await request();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic review audit failure'));
        await expect(review()).rejects.toThrow(
          'Synthetic review audit failure',
        );
        expect((await current()).status).toBe('PENDING');
        jest.restoreAllMocks();
        await review();
        jest
          .spyOn(audit, 'record')
          .mockRejectedValueOnce(new Error('Synthetic approval audit failure'));
        await expect(approve()).rejects.toThrow(
          'Synthetic approval audit failure',
        );
        expect((await current()).status).toBe('REVIEWED');
        expect(
          await prisma.financeApprovalDecision.count({ where: { tenantId } }),
        ).toBe(0);
      },
    );
    itTenant(
      'preserves closed cashier controls after independent approval',
      async () => {
        await ready('REVERSAL');
        const payment = await prisma.payment.findFirstOrThrow({
          where: { id: paymentId },
        });
        await prisma.cashierClose.create({
          data: {
            tenantId,
            closeNumber: 'SYNTHETIC-CLOSED',
            openedAt: new Date(payment.paidAt.getTime() - 1000),
            closedAt: new Date(payment.paidAt.getTime() + 1000),
            grossCollected: 100,
            totalRefunded: 0,
            netCollected: 100,
            paymentCount: 1,
            refundCount: 0,
          },
        });
        await expect(
          service.executeApprovalRequest(requestId, actors.poster),
        ).rejects.toThrow('cashier day is already closed');
        expect((await current()).status).toBe('APPROVED');
        await prisma.cashierClose.deleteMany({ where: { tenantId } });
      },
    );
    itTenant(
      'limits request-only users to their own queue and projects independently allowed actions',
      async () => {
        await request();
        const ownActor = {
          ...actors.preparer,
          permissions: ['payments:refund:request'],
        };
        const otherActor = {
          ...actors.poster,
          permissions: ['payments:refund:request'],
        };
        expect(
          (await service.listApprovalRequests({}, ownActor)).items.map(
            (item) => item.id,
          ),
        ).toEqual([requestId]);
        expect((await service.listApprovalRequests({}, otherActor)).total).toBe(
          0,
        );
        const queue = await service.listApprovalRequests({}, actors.reviewer);
        expect(queue.items[0].allowedActions.review).toBe(true);
        expect(queue.items[0]).not.toHaveProperty('payment');
        expect(queue.items[0]).not.toHaveProperty('policySnapshot');
      },
    );
    itTenant(
      'upgrades exact system templates, preserves modified/custom/Platform roles and replays without drift',
      async () => {
        const baseline = templateBaseline as Record<string, string[]>;
        const beforeRoles: Record<string, string> = {};
        for (const [name, keys] of Object.entries(baseline)) {
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
          const role = await prisma.role.create({
            data: {
              tenantId,
              name,
              isSystem: true,
              rolePermissions: {
                create: grants.map(({ id }) => ({ permissionId: id })),
              },
            },
          });
          beforeRoles[name] = role.id;
        }
        const custom = await prisma.role.create({
          data: { tenantId, name: 'custom-finance', isSystem: false },
        });
        // A template with even one owner change must be retained without being widened.
        const removed = await prisma.permission.findUniqueOrThrow({
          where: { resource_action: { resource: 'roles', action: 'read' } },
        });
        await prisma.rolePermission.delete({
          where: {
            roleId_permissionId: {
              roleId: beforeRoles.hr_manager,
              permissionId: removed.id,
            },
          },
        });
        await prisma.userRole.create({
          data: {
            tenantId,
            userId: actors.poster.userId,
            roleId: beforeRoles.posting_authority,
          },
        });
        const platform = await prisma.runWithoutTenantScope(
          'isolated Platform migration fixture',
          () =>
            prisma.tenant.create({
              data: {
                name: 'Synthetic Platform',
                slug: `p2-template-platform-${randomUUID()}`,
                securityDomain: 'PLATFORM',
              },
            }),
        );
        const pool = new Pool({ connectionString: authTestDatabaseUrl });
        try {
          const sql = readFileSync(
            join(
              __dirname,
              '../prisma/migrations/20260927121500_phase2_domain_templates/migration.sql',
            ),
            'utf8',
          );
          await pool.query(sql);
          const permissionsFor = async (id: string) =>
            (
              await prisma.rolePermission.findMany({
                where: { roleId: id },
                include: { permission: true },
              })
            )
              .map(
                ({ permission }) =>
                  `${permission.resource}:${permission.action}`,
              )
              .sort();
          for (const name of Object.keys(baseline).filter(
            (name) => name !== 'hr_manager',
          ))
            expect(await permissionsFor(beforeRoles[name])).toEqual(
              [...(domainTemplateV2 as Record<string, string[]>)[name]].sort(),
            );
          expect(await permissionsFor(beforeRoles.hr_manager)).toEqual(
            baseline.hr_manager.filter((key) => key !== 'roles:read'),
          );
          expect(await permissionsFor(custom.id)).toEqual([]);
          const clerk = await prisma.role.findUniqueOrThrow({
            where: { tenantId_name: { tenantId, name: 'finance_clerk' } },
          });
          expect(
            await prisma.userRole.count({
              where: { tenantId, roleId: clerk.id },
            }),
          ).toBe(0);
          expect(
            await prisma.userRole.count({
              where: {
                tenantId,
                roleId: beforeRoles.posting_authority,
                userId: actors.poster.userId,
              },
            }),
          ).toBe(1);
          const firstAuditCount = await prisma.auditLog.count({
            where: { tenantId, resource: 'system_role_template' },
          });
          await pool.query(sql);
          expect(
            await prisma.auditLog.count({
              where: { tenantId, resource: 'system_role_template' },
            }),
          ).toBe(firstAuditCount);
          await prisma.runWithoutTenantScope(
            'inspect isolated Platform template boundary',
            async () => {
              expect(
                await prisma.role.count({
                  where: { tenantId: platform.id, name: 'finance_clerk' },
                }),
              ).toBe(0);
            },
          );
        } finally {
          await pool.end();
          await prisma.runWithoutTenantScope(
            'remove isolated Platform migration fixture',
            () => prisma.tenant.delete({ where: { id: platform.id } }),
          );
        }
      },
    );
  },
);

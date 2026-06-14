import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AuthMethod,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import request from 'supertest';
import { ActivityMediaProcessor } from '../src/activity-feed/processors/activity-media.processor';
import type { AuthContext } from '../src/auth/auth.types';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { AppModule } from '../src/app.module';
import { FileRegistryService } from '../src/file-registry/file-registry.service';
import { FinanceProcessor } from '../src/finance/finance.processor';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { PayrollProcessor } from '../src/payroll/payroll.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  createPrismaMock,
  createQueueMock,
  ensureTenantDefaultsWithState,
  type PrismaMock,
} from './test-helpers';

const tenantAId = 'tenant-m3-http-a';
const tenantBId = 'tenant-m3-http-b';
const openedAt = '2026-05-01T00:00:00.000Z';
const closedAt = '2026-05-01T23:59:59.000Z';

const actorA = buildActor(tenantAId, 'cashier-a');
const actorB = buildActor(tenantBId, 'cashier-b');

describe('M3 Fees HTTP isolation hardening (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    seedTenant(prisma, tenantAId);
    seedTenant(prisma, tenantBId);
    seedFinanceData(prisma);
    overrideFinanceQuerySemantics(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('activity-media'))
      .useValue(createQueueMock())
      .overrideProvider(FinanceProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(NotificationsProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(ActivityMediaProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(PayrollProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(FileRegistryService)
      .useValue({
        registerGeneratedFile: jest.fn(async (input) => ({
          id: `asset-${input.entityId ?? 'cashier-close'}`,
          originalFilename: input.originalFilename,
          mimeType: input.mimeType,
          sizeBytes: input.content.length,
        })),
      })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => {
              headers: Record<string, string>;
              auth?: AuthContext;
            };
          };
        }) => {
          const req = context.switchToHttp().getRequest();
          req.auth =
            req.headers['x-test-tenant'] === tenantBId ? actorB : actorA;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('denies cross-tenant invoice adjustment over HTTP before writing lines or ledger entries', async () => {
    const response = await request(app.getHttpServer())
      .post('/fees/invoices/invoice-a-issued/adjustments')
      .set('x-test-tenant', tenantBId)
      .set('authorization', 'Bearer test-token')
      .send({
        direction: 'INCREASE',
        feeHeadId: 'fee-head-a',
        amount: 100,
        vatAmount: 0,
        reason: 'Tenant isolation regression probe',
      });
    expect(response.status).toBe(404);

    expect(prisma.invoiceLine.create).not.toHaveBeenCalled();
    expect(prisma.journalEntry.create).not.toHaveBeenCalled();
  });

  it('rejects paid-invoice scholarship waivers over HTTP without mutating invoice totals', async () => {
    const beforeTotal = findInvoice(prisma, 'invoice-a-paid').totalAmount;

    await request(app.getHttpServer())
      .post('/fees/waivers')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        studentId: 'student-a',
        invoiceId: 'invoice-a-paid',
        amount: 100,
        reason: 'Scholarship approved after full payment',
      })
      .expect(409);

    expect(findInvoice(prisma, 'invoice-a-paid').totalAmount).toBe(beforeTotal);
    expect(prisma.feeWaiver.create).not.toHaveBeenCalled();
  });

  it('allows method-specific cashier closes for the same window and blocks duplicate same-method closes', async () => {
    const cashClose = await request(app.getHttpServer())
      .post('/payments/cashier-close')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        openedAt,
        closedAt,
        paymentMethod: PaymentMethod.CASH,
        actualCashAmount: 1000,
        notes: 'Cash drawer close',
      })
      .expect(201);

    expect(cashClose.body.paymentMethod).toBe(PaymentMethod.CASH);
    expect(cashClose.body.grossCollected).toBe(1000);

    const bankClose = await request(app.getHttpServer())
      .post('/payments/cashier-close')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        openedAt,
        closedAt,
        paymentMethod: PaymentMethod.BANK,
        notes: 'Bank reference close',
      })
      .expect(201);

    expect(bankClose.body.paymentMethod).toBe(PaymentMethod.BANK);
    expect(bankClose.body.grossCollected).toBe(500);

    await request(app.getHttpServer())
      .post('/payments/cashier-close')
      .set('x-test-tenant', tenantAId)
      .set('authorization', 'Bearer test-token')
      .send({
        openedAt,
        closedAt,
        paymentMethod: PaymentMethod.CASH,
        actualCashAmount: 1000,
        notes: 'Duplicate cash close',
      })
      .expect(409);

    expect(
      prisma.__state.cashierCloses.filter(
        (close) => close.tenantId === tenantAId,
      ),
    ).toHaveLength(2);
  });
});

function buildActor(tenantId: string, userId: string): AuthContext {
  return {
    userId,
    tenantId,
    tenantSlug: tenantId,
    email: `${userId}@schoolos.test`,
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: [
      'fees:adjust',
      'fees:discount',
      'fees:manage',
      'payments:close',
      'payments:collect',
      'receipts:read',
      'receipts:manage',
    ],
  };
}

function seedTenant(prisma: PrismaMock, tenantId: string) {
  ensureTenantDefaultsWithState(prisma.__state, tenantId);
  const planId = `plan-${tenantId}`;
  prisma.__state.platformPlans.push({
    id: planId,
    key: 'professional',
    name: 'Professional',
  });
  prisma.__state.platformPlanFeatures.push(
    {
      id: `feature-fees-${tenantId}`,
      planId,
      featureKey: 'module.fees',
      enabled: true,
    },
    {
      id: `feature-cashier-close-${tenantId}`,
      planId,
      featureKey: 'feature.fees.cashier_close',
      enabled: true,
    },
  );
  prisma.__state.tenantSubscriptions.push({
    id: `sub-${tenantId}`,
    tenantId,
    planId,
    status: 'ACTIVE',
    createdAt: new Date('2026-04-01T00:00:00.000Z'),
  });
}

function seedFinanceData(prisma: PrismaMock) {
  prisma.__state.students.push(
    {
      id: 'student-a',
      tenantId: tenantAId,
      studentSystemId: 'ST-A',
      firstNameEn: 'Student',
      lastNameEn: 'A',
    },
    {
      id: 'student-b',
      tenantId: tenantBId,
      studentSystemId: 'ST-B',
      firstNameEn: 'Student',
      lastNameEn: 'B',
    },
  );
  prisma.__state.feeHeads.push(
    {
      id: 'fee-head-a',
      tenantId: tenantAId,
      code: 'TUITION',
      name: 'Tuition',
    },
    {
      id: 'fee-head-b',
      tenantId: tenantBId,
      code: 'TUITION',
      name: 'Tuition',
    },
  );
  prisma.__state.invoices.push(
    buildInvoice({
      id: 'invoice-a-issued',
      tenantId: tenantAId,
      studentId: 'student-a',
      status: InvoiceStatus.ISSUED,
      payments: [],
    }),
    buildInvoice({
      id: 'invoice-a-paid',
      tenantId: tenantAId,
      studentId: 'student-a',
      status: InvoiceStatus.PAID,
      paidAt: new Date('2026-05-01T10:00:00.000Z'),
      payments: [
        {
          id: 'payment-paid',
          tenantId: tenantAId,
          amount: new Prisma.Decimal(1000),
          status: PaymentStatus.SUCCESS,
          refunds: [],
        },
      ],
    }),
    buildInvoice({
      id: 'invoice-b-issued',
      tenantId: tenantBId,
      studentId: 'student-b',
      status: InvoiceStatus.ISSUED,
      payments: [],
    }),
  );
  prisma.__state.payments.push(
    {
      id: 'payment-cash-a',
      tenantId: tenantAId,
      studentId: 'student-a',
      invoiceId: 'invoice-a-issued',
      collectedById: 'cashier-a',
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      amount: new Prisma.Decimal(1000),
      paidAt: new Date('2026-05-01T09:00:00.000Z'),
      createdAt: new Date('2026-05-01T09:00:00.000Z'),
      refunds: [],
      receipt: { receiptNumber: 'RCP-CASH-A' },
      invoice: { status: InvoiceStatus.ISSUED },
    },
    {
      id: 'payment-bank-a',
      tenantId: tenantAId,
      studentId: 'student-a',
      invoiceId: 'invoice-a-issued',
      collectedById: 'cashier-a',
      method: PaymentMethod.BANK,
      status: PaymentStatus.SUCCESS,
      amount: new Prisma.Decimal(500),
      paidAt: new Date('2026-05-01T10:00:00.000Z'),
      createdAt: new Date('2026-05-01T10:00:00.000Z'),
      refunds: [],
      receipt: { receiptNumber: 'RCP-BANK-A' },
      invoice: { status: InvoiceStatus.ISSUED },
    },
    {
      id: 'payment-cash-b',
      tenantId: tenantBId,
      studentId: 'student-b',
      invoiceId: 'invoice-b-issued',
      collectedById: 'cashier-b',
      method: PaymentMethod.CASH,
      status: PaymentStatus.SUCCESS,
      amount: new Prisma.Decimal(900),
      paidAt: new Date('2026-05-01T09:30:00.000Z'),
      createdAt: new Date('2026-05-01T09:30:00.000Z'),
      refunds: [],
      receipt: { receiptNumber: 'RCP-CASH-B' },
      invoice: { status: InvoiceStatus.ISSUED },
    },
  );
}

function buildInvoice(overrides: Record<string, unknown>) {
  return {
    invoiceNumber: `INV-${overrides.id}`,
    academicYearId: 'ay-1',
    dueDate: new Date('2026-05-10T00:00:00.000Z'),
    subtotal: new Prisma.Decimal(1000),
    vatAmount: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(1000),
    issuedAt: new Date('2026-05-01T00:00:00.000Z'),
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    lines: [],
    payments: [],
    ...overrides,
  };
}

function overrideFinanceQuerySemantics(prisma: PrismaMock) {
  prisma.invoice.findFirst = jest.fn((q) =>
    Promise.resolve(
      prisma.__state.invoices.find(
        (invoice) =>
          (!q.where?.tenantId || invoice.tenantId === q.where.tenantId) &&
          (!q.where?.id || invoice.id === q.where.id),
      ) ?? null,
    ),
  );
  prisma.invoiceLine = {
    findFirst: jest.fn((q) =>
      Promise.resolve(
        q.where?.tenantId === tenantAId &&
          q.where?.invoiceId === 'invoice-a-issued' &&
          q.where?.feeHeadId === 'fee-head-a'
          ? { id: 'line-a' }
          : null,
      ),
    ),
    create: jest.fn(async (q) => q.data),
  };
  prisma.payment.findMany = jest.fn((q) => {
    const where = q.where ?? {};
    const paidAt = where.paidAt ?? {};
    const opened = paidAt.gte ? new Date(paidAt.gte).getTime() : -Infinity;
    const closed = paidAt.lte ? new Date(paidAt.lte).getTime() : Infinity;

    return Promise.resolve(
      prisma.__state.payments.filter((payment) => {
        const paidAtTime = new Date(payment.paidAt as Date).getTime();
        return (
          (!where.tenantId || payment.tenantId === where.tenantId) &&
          (!where.method || payment.method === where.method) &&
          (!where.collectedById ||
            payment.collectedById === where.collectedById) &&
          paidAtTime >= opened &&
          paidAtTime <= closed &&
          payment.status !== PaymentStatus.REVERSED
        );
      }),
    );
  });
  prisma.paymentRefund.findMany = jest.fn(() => Promise.resolve([]));
  prisma.cashierClose.findFirst = jest.fn((q) => {
    const where = q.where ?? {};
    const existing = prisma.__state.cashierCloses.find((close) => {
      if (where.closeWindowKey) {
        return (
          close.tenantId === where.tenantId &&
          close.closeWindowKey === where.closeWindowKey
        );
      }
      if (!where.openedAt || !where.closedAt) {
        return (
          (!where.tenantId || close.tenantId === where.tenantId) &&
          (!where.id || close.id === where.id)
        );
      }

      const closeOpened = new Date(close.openedAt as Date).getTime();
      const closeClosed = new Date(close.closedAt as Date).getTime();
      const openedLt = new Date(where.openedAt.lt).getTime();
      const closedGt = new Date(where.closedAt.gt).getTime();
      const requestedMethod = where.AND?.[0]?.OR?.find(
        (item: Record<string, unknown>) => item.paymentMethod,
      )?.paymentMethod;

      return (
        close.tenantId === where.tenantId &&
        (where.collectorUserId === undefined ||
          close.collectorUserId === where.collectorUserId) &&
        closeOpened < openedLt &&
        closeClosed > closedGt &&
        (!requestedMethod ||
          close.paymentMethod === null ||
          close.paymentMethod === requestedMethod)
      );
    });

    return Promise.resolve(existing ?? null);
  });
}

function findInvoice(prisma: PrismaMock, invoiceId: string) {
  return prisma.__state.invoices.find((invoice) => invoice.id === invoiceId)!;
}

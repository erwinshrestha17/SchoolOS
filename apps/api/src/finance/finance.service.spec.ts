import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  FeeFrequency,
  InvoiceStatus,
  Prisma,
} from '@prisma/client';
import {
  resolveInvoiceStatusAfterAdjustment,
  FinanceService,
} from './finance.service';
import { InvoiceAdjustmentDirection } from './dto/create-invoice-adjustment.dto';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: ['fees:adjust'],
};

describe('finance invoice production controls', () => {
  it('voids unpaid invoices with an audit trail', async () => {
    const invoice = buildInvoice({ payments: [] });
    const { service, prisma, auditService } = buildService({
      invoice,
      feeHead: buildFeeHead(),
      updatedInvoice: { ...invoice, status: InvoiceStatus.VOID },
    });

    const result = await service.voidInvoice(
      invoice.id,
      { reason: 'Duplicate bill' },
      actor,
    );

    expect(result.status).toBe(InvoiceStatus.VOID);
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.VOID,
        reportCardBlocked: false,
        hallTicketBlocked: false,
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'void',
        resource: 'invoice',
        resourceId: invoice.id,
        after: expect.objectContaining({ reason: 'Duplicate bill' }),
      }),
    );
  });

  it('blocks voiding invoices with payments', async () => {
    const invoice = buildInvoice({
      payments: [{ amount: new Prisma.Decimal(100) }],
    });
    const { service } = buildService({ invoice, feeHead: buildFeeHead() });

    await expect(
      service.voidInvoice(invoice.id, { reason: 'Duplicate bill' }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('adds an increasing adjustment line and updates totals', async () => {
    const invoice = buildInvoice({ payments: [] });
    const feeHead = buildFeeHead();
    const adjustedInvoice = {
      ...invoice,
      subtotal: new Prisma.Decimal(1100),
      vatAmount: new Prisma.Decimal(130),
      totalAmount: new Prisma.Decimal(1230),
      status: InvoiceStatus.ISSUED,
    };
    const adjustmentLine = { id: 'line-adjustment' };
    const { service, prisma, auditService } = buildService({
      invoice,
      feeHead,
      createdLine: adjustmentLine,
      updatedInvoice: adjustedInvoice,
    });

    const result = await service.createInvoiceAdjustment(
      invoice.id,
      {
        direction: InvoiceAdjustmentDirection.INCREASE,
        feeHeadId: feeHead.id,
        amount: 100,
        vatAmount: 13,
        reason: 'Added lab fee',
      },
      actor,
    );

    expect(result).toEqual({ line: adjustmentLine, invoice: adjustedInvoice });
    expect(prisma.invoiceLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        invoiceId: invoice.id,
        feeHeadId: feeHead.id,
        unitAmount: new Prisma.Decimal(100),
        vatAmount: new Prisma.Decimal(13),
        totalAmount: new Prisma.Decimal(113),
      }),
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: invoice.id },
        data: expect.objectContaining({
          subtotal: new Prisma.Decimal(1100),
          vatAmount: new Prisma.Decimal(130),
          totalAmount: new Prisma.Decimal(1230),
          status: InvoiceStatus.ISSUED,
        }),
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'adjust',
        resource: 'invoice',
        resourceId: invoice.id,
      }),
    );
  });

  it('blocks adjustments that would reduce total below paid amount', async () => {
    const invoice = buildInvoice({
      payments: [{ amount: new Prisma.Decimal(950) }],
      status: InvoiceStatus.PARTIAL,
      totalAmount: new Prisma.Decimal(1000),
    });
    const { service } = buildService({ invoice, feeHead: buildFeeHead() });

    await expect(
      service.createInvoiceAdjustment(
        invoice.id,
        {
          direction: InvoiceAdjustmentDirection.DECREASE,
          feeHeadId: 'fee-head-1',
          amount: 100,
          vatAmount: 0,
          reason: 'Manual correction',
        },
        actor,
      ),
    ).rejects.toThrow('Adjustment would make paid amount exceed invoice total');
  });

  it('rejects missing invoices and fee heads', async () => {
    const { service } = buildService({ invoice: null, feeHead: null });

    await expect(
      service.voidInvoice('missing', { reason: 'Missing' }, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('resolves invoice status after adjustments from paid amount', () => {
    expect(
      resolveInvoiceStatusAfterAdjustment(
        InvoiceStatus.ISSUED,
        new Prisma.Decimal(0),
        new Prisma.Decimal(100),
      ),
    ).toBe(InvoiceStatus.ISSUED);
    expect(
      resolveInvoiceStatusAfterAdjustment(
        InvoiceStatus.ISSUED,
        new Prisma.Decimal(50),
        new Prisma.Decimal(100),
      ),
    ).toBe(InvoiceStatus.PARTIAL);
    expect(
      resolveInvoiceStatusAfterAdjustment(
        InvoiceStatus.PARTIAL,
        new Prisma.Decimal(100),
        new Prisma.Decimal(100),
      ),
    ).toBe(InvoiceStatus.PAID);
  });
});

function buildInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invoice-1',
    tenantId: actor.tenantId,
    status: InvoiceStatus.ISSUED,
    subtotal: new Prisma.Decimal(1000),
    vatAmount: new Prisma.Decimal(117),
    totalAmount: new Prisma.Decimal(1117),
    payments: [],
    ...overrides,
  };
}

function buildFeeHead() {
  return {
    id: 'fee-head-1',
    tenantId: actor.tenantId,
    code: 'TUITION',
    name: 'Tuition',
    frequency: FeeFrequency.MONTHLY,
  };
}

function buildService(options: {
  invoice: unknown;
  feeHead: unknown;
  createdLine?: unknown;
  updatedInvoice?: unknown;
}) {
  const prisma = {
    invoice: {
      findFirst: jest.fn().mockResolvedValue(options.invoice),
      update: jest.fn().mockResolvedValue(options.updatedInvoice),
    },
    feeHead: {
      findFirst: jest.fn().mockResolvedValue(options.feeHead),
    },
    invoiceLine: {
      create: jest.fn().mockResolvedValue(options.createdLine),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  };
  const auditService = {
    record: jest.fn(),
  };
  const communicationsService = {};

  return {
    service: new FinanceService(
      prisma as never,
      auditService as never,
      communicationsService as never,
    ),
    prisma,
    auditService,
  };
}

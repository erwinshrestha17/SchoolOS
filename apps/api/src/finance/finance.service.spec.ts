import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AuthMethod,
  FeeFrequency,
  InvoiceStatus,
  JournalLineSide,
  JournalSourceType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import {
  FinanceService,
  resolveInvoiceStatusAfterAdjustment,
} from './finance.service';
import { UsageService } from '../usage/usage.service';
import { InvoiceAdjustmentDirection } from './dto/create-invoice-adjustment.dto';

const actor = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  userId: 'user-1',
  email: 'accountant@schoolos.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['accountant'],
  permissions: [
    'fees:adjust',
    'fees:manage',
    'payments:collect',
    'payments:refund',
    'payments:reverse',
    'payments:close',
    'receipts:read',
    'receipts:manage',
  ],
};

describe('finance production controls', () => {
  it('creates canteen meal-plan invoices through the M3 invoice and M9 posting boundary', async () => {
    const createdInvoice = {
      id: 'invoice-meal-1',
      invoiceNumber: 'INV-2026-00001',
      studentId: 'student-1',
      totalAmount: new Prisma.Decimal(1200),
      lines: [
        {
          feeHead: { code: 'MEALPLAN', name: 'Canteen Meal Plan' },
          totalAmount: new Prisma.Decimal(1200),
        },
      ],
    };
    const { service, prisma, accountingPostingService } = buildService({
      invoice: null,
      feeHead: null,
      createdInvoice,
    });

    const result = await service.createCanteenMealPlanInvoice(prisma as never, {
      actor,
      studentId: 'student-1',
      mealPlanName: 'Lunch Plan',
      mealType: 'LUNCH',
      amount: new Prisma.Decimal(1200),
      dueDate: new Date('2026-05-06T00:00:00.000Z'),
      servicePeriodStart: new Date('2026-05-06T00:00:00.000Z'),
      servicePeriodEnd: null,
      sourceEnrollmentId: 'enrollment-1',
    });

    expect(result).toEqual({
      id: 'invoice-meal-1',
      invoiceNumber: 'INV-2026-00001',
      sourceEnrollmentId: 'enrollment-1',
    });
    expect(prisma.feeHead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_code: { tenantId: actor.tenantId, code: 'MEALPLAN' },
        },
      }),
    );
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: actor.tenantId,
          studentId: 'student-1',
          totalAmount: new Prisma.Decimal(1200),
        }),
      }),
    );
    expect(accountingPostingService.postInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        invoiceId: 'invoice-meal-1',
        lines: [
          expect.objectContaining({
            accountCode: '4050',
            accountName: 'Canteen Meal Plan',
          }),
        ],
      }),
      actor,
      prisma,
    );
  });

  it('requires discount reason and tenant-owned target references', async () => {
    const feeHead = buildFeeHead();
    const classroom = { id: 'class-1', tenantId: actor.tenantId };
    const feePlan = {
      id: 'plan-1',
      tenantId: actor.tenantId,
      classId: 'class-1',
    };
    const createdDiscount = {
      id: 'discount-1',
      name: 'Sibling discount',
      type: 'SIBLING',
    };
    const { service, prisma, auditService } = buildService({
      invoice: null,
      feeHead,
      classroom,
      feePlan,
      createdDiscount,
    });

    const result = await service.createDiscountRule(
      {
        name: 'Sibling discount',
        reason: 'Approved sibling policy',
        type: 'SIBLING',
        feeHeadId: feeHead.id,
        classId: classroom.id,
        feePlanId: feePlan.id,
        percentOff: 10,
      },
      actor,
    );

    expect(result).toBe(createdDiscount);
    expect(prisma.feeHead.findFirst).toHaveBeenCalledWith({
      where: { id: feeHead.id, tenantId: actor.tenantId },
    });
    expect(prisma.class.findFirst).toHaveBeenCalledWith({
      where: { id: classroom.id, tenantId: actor.tenantId },
    });
    expect(prisma.feePlan.findFirst).toHaveBeenCalledWith({
      where: { id: feePlan.id, tenantId: actor.tenantId },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        resource: 'discount_rule',
        after: expect.objectContaining({
          reason: 'Approved sibling policy',
        }),
      }),
    );
  });

  it('blocks discounts without an auditable reason', async () => {
    const { service } = buildService({
      invoice: null,
      feeHead: buildFeeHead(),
    });

    await expect(
      service.createDiscountRule(
        {
          name: 'Manual discount',
          reason: '',
          type: 'MANUAL',
          feeHeadId: 'fee-head-1',
          amountOff: 100,
        },
        actor,
      ),
    ).rejects.toThrow('Discount reason is required');
  });

  it('blocks waivers when invoice and student do not match', async () => {
    const invoice = buildInvoice({ studentId: 'student-2' });
    const { service } = buildService({
      invoice,
      feeHead: buildFeeHead(),
      student: { id: 'student-1', tenantId: actor.tenantId },
    });

    await expect(
      service.createWaiver(
        {
          studentId: 'student-1',
          invoiceId: invoice.id,
          amount: 100,
          reason: 'Hardship waiver',
        },
        actor,
      ),
    ).rejects.toThrow('Invoice does not belong to the selected student');
  });

  it('blocks duplicate referenced payments for the same invoice', async () => {
    const invoice = buildInvoice({
      payments: [],
      lines: [
        {
          id: 'line-1',
          totalAmount: new Prisma.Decimal(1117),
          feeHead: { code: 'TUITION' },
          description: 'Tuition',
        },
      ],
      student: { id: 'student-1' },
    });
    const { service } = buildService({
      invoice,
      feeHead: buildFeeHead(),
      duplicatePayment: { id: 'payment-duplicate' },
    });

    await expect(
      service.collectPayment(
        {
          invoiceId: invoice.id,
          amount: 100,
          method: PaymentMethod.BANK,
          referenceNumber: 'BANK-REF-001',
        },
        actor,
      ),
    ).rejects.toThrow(
      'has already been used for an active payment in this tenant',
    );
  });

  it('rejects overpayment against the remaining invoice balance', async () => {
    const invoice = buildInvoice({
      totalAmount: new Prisma.Decimal(100),
      payments: [
        buildInvoicePayment({
          amount: new Prisma.Decimal(90),
          refunds: [],
        }),
      ],
      lines: [
        {
          id: 'line-1',
          totalAmount: new Prisma.Decimal(100),
          feeHead: { code: 'TUITION' },
          description: 'Tuition',
        },
      ],
      student: { id: 'student-1' },
    });
    const { service, prisma } = buildService({
      invoice,
      feeHead: buildFeeHead(),
      duplicatePayment: null,
    });

    await expect(
      service.collectPayment(
        {
          invoiceId: invoice.id,
          amount: 20,
          method: PaymentMethod.CASH,
        },
        actor,
      ),
    ).rejects.toThrow('Payment exceeds the remaining balance');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('emits a finance domain event after confirmed payment collection', async () => {
    const invoice = buildInvoice({
      payments: [],
      invoiceNumber: 'INV-2025-2026-00001',
      fiscalYear: '2025/2026',
      billNumber: 'INV-2025-2026-00001',
      lines: [
        {
          id: 'line-1',
          totalAmount: new Prisma.Decimal(1117),
          feeHead: { code: 'TUITION' },
          description: 'Tuition',
        },
      ],
      student: { id: 'student-1' },
    });
    const createdPayment = {
      id: 'payment-1',
      invoiceId: invoice.id,
      amount: new Prisma.Decimal(100),
      method: PaymentMethod.CASH,
      paidAt: new Date('2026-04-27T10:00:00.000Z'),
      receipt: {
        receiptNumber: 'REC-2025-2026-00001',
        pdfUrl: '/api/v1/receipts/REC-2025-2026-00001.pdf',
      },
    };
    const { service, eventEmitter } = buildService({
      invoice,
      feeHead: buildFeeHead(),
      duplicatePayment: null,
      tenant: { id: actor.tenantId, panNumber: 'PAN-123' },
      receiptCount: 0,
      journalCount: 0,
      cashAccount: { id: 'cash' },
      incomeAccount: { id: 'income' },
      createdPayment,
    });

    const result = await service.collectPayment(
      {
        invoiceId: invoice.id,
        amount: 100,
        method: PaymentMethod.CASH,
        referenceNumber: 'COUNTER-001',
      },
      actor,
    );

    expect(result.receiptNumber).toBe('REC-2025-2026-00001');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fees.payment.confirmed',
      expect.objectContaining({
        tenantId: actor.tenantId,
        paymentId: createdPayment.id,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: 100,
      }),
    );
  });

  it('returns tenant-scoped invoice detail with backend-owned totals', async () => {
    const detailedInvoice = buildInvoice({
      invoiceNumber: 'INV-2026-00001',
      fiscalYear: '2026/2027',
      billNumber: 'INV-2026-00001',
      dueDate: new Date('2026-05-15T00:00:00.000Z'),
      issuedAt: new Date('2026-04-27T00:00:00.000Z'),
      reportCardBlocked: false,
      hallTicketBlocked: false,
      billingRunId: 'run-1',
      enrollmentId: 'enrollment-1',
      academicYear: { id: 'ay-1', name: '2083' },
      billingRun: { id: 'run-1', runMonth: 4, runYear: 2026 },
      student: {
        id: 'student-1',
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Erwin',
        lastNameEn: 'Shrestha',
        class: { name: 'Class 1' },
        sectionRef: { name: 'A' },
        guardianLinks: [
          {
            isPrimary: true,
            guardian: {
              fullName: 'Primary Guardian',
              primaryPhone: '9800000000',
            },
          },
        ],
      },
      lines: [
        {
          id: 'line-1',
          feeHeadId: 'fee-head-1',
          description: 'Tuition',
          quantity: 1,
          unitAmount: new Prisma.Decimal(1000),
          vatAmount: new Prisma.Decimal(117),
          totalAmount: new Prisma.Decimal(1117),
          createdAt: new Date('2026-04-27T00:00:00.000Z'),
          feeHead: { id: 'fee-head-1', code: 'TUITION', name: 'Tuition' },
        },
      ],
      payments: [
        {
          id: 'payment-1',
          amount: new Prisma.Decimal(250),
          method: PaymentMethod.CASH,
          referenceNumber: null,
          paidAt: new Date('2026-04-28T00:00:00.000Z'),
          narration: 'Counter collection',
          createdAt: new Date('2026-04-28T00:00:00.000Z'),
          collectedBy: { id: actor.userId, email: actor.email },
          receipt: {
            id: 'receipt-1',
            receiptNumber: 'REC-2026-00001',
            issuedAt: new Date('2026-04-28T00:00:00.000Z'),
            pdfUrl: '/api/v1/receipts/REC-2026-00001.pdf',
          },
          refunds: [
            {
              id: 'refund-1',
              refundNumber: 'RFD-2026-00001',
              amount: new Prisma.Decimal(50),
              refundDate: new Date('2026-04-29T00:00:00.000Z'),
              reason: 'Correction',
              referenceNumber: null,
            },
          ],
        },
      ],
    });
    const { service, prisma } = buildService({
      invoice: detailedInvoice,
      feeHead: buildFeeHead(),
      waivers: [
        {
          id: 'waiver-1',
          feeHeadId: 'fee-head-1',
          amount: new Prisma.Decimal(50),
          reason: 'Approved concession',
          status: 'APPROVED',
          approvedAt: new Date('2026-04-27T00:00:00.000Z'),
          approvedBy: { id: actor.userId, email: actor.email },
        },
      ],
      reconciliationPaymentEntries: [
        { sourceId: 'payment-1', entryNumber: 'JE-2026-00001' },
      ],
    });

    const result = await service.getInvoiceDetail(detailedInvoice.id, actor);

    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: detailedInvoice.id, tenantId: actor.tenantId },
      }),
    );
    expect(result.student).toEqual(
      expect.objectContaining({
        studentSystemId: 'SCH-2026-0001',
        guardianPhone: '9800000000',
      }),
    );
    expect(result.totalAmount).toBe(1117);
    expect(result.paidAmount).toBe(200);
    expect(result.outstandingAmount).toBe(917);
    expect(result.lines[0]).toEqual(
      expect.objectContaining({
        feeHeadName: 'Tuition',
        vatAmount: 117,
        waiverAmount: 50,
      }),
    );
    expect(result.payments[0]).toEqual(
      expect.objectContaining({
        receipt: expect.objectContaining({
          receiptNumber: 'REC-2026-00001',
        }),
        refundedAmount: 50,
        netAmount: 200,
        journalEntryNumber: 'JE-2026-00001',
      }),
    );
  });

  it('builds a tenant-scoped student fee ledger with running balance', async () => {
    const invoice = buildInvoice({
      id: 'invoice-ledger-1',
      invoiceNumber: 'INV-2026-00002',
      totalAmount: new Prisma.Decimal(1000),
      issuedAt: new Date('2026-04-27T00:00:00.000Z'),
      payments: [
        {
          id: 'payment-ledger-1',
          amount: new Prisma.Decimal(400),
          method: PaymentMethod.BANK,
          paidAt: new Date('2026-04-28T00:00:00.000Z'),
          createdAt: new Date('2026-04-28T00:00:00.000Z'),
          receipt: {
            receiptNumber: 'REC-2026-00002',
          },
          refunds: [
            {
              id: 'refund-ledger-1',
              refundNumber: 'RFD-2026-00002',
              amount: new Prisma.Decimal(100),
              refundDate: new Date('2026-04-29T00:00:00.000Z'),
              createdAt: new Date('2026-04-29T00:00:00.000Z'),
            },
          ],
        },
      ],
      lines: [
        {
          id: 'line-ledger-1',
          feeHead: { name: 'Tuition' },
        },
      ],
    });
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: buildFeeHead(),
      student: {
        id: 'student-1',
        tenantId: actor.tenantId,
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'Erwin',
        lastNameEn: 'Shrestha',
        class: { name: 'Class 1' },
        sectionRef: { name: 'A' },
        guardianLinks: [],
      },
      invoices: [invoice],
      waivers: [
        {
          id: 'waiver-ledger-1',
          invoiceId: invoice.id,
          feeHead: { name: 'Tuition' },
          amount: new Prisma.Decimal(100),
          reason: 'Approved concession',
          status: 'APPROVED',
          approvedAt: new Date('2026-04-27T12:00:00.000Z'),
          createdAt: new Date('2026-04-27T12:00:00.000Z'),
          approvedBy: null,
        },
      ],
    });

    const result = await service.getStudentFeeLedger('student-1', actor);

    expect(prisma.student.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-1', tenantId: actor.tenantId },
      }),
    );
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: actor.tenantId, studentId: 'student-1' },
      }),
    );
    expect(result.totalInvoiced).toBe(1000);
    expect(result.totalPaid).toBe(400);
    expect(result.totalRefunded).toBe(100);
    expect(result.totalWaived).toBe(100);
    expect(result.outstandingBalance).toBe(700);
    expect(result.rows.map((row) => row.type)).toEqual([
      'INVOICE',
      'WAIVER',
      'PAYMENT',
      'REFUND',
    ]);
    expect(result.rows.at(-1)?.runningBalance).toBe(700);
    expect(result.rows[1]).toEqual(
      expect.objectContaining({
        type: 'WAIVER',
        affectsBalance: false,
      }),
    );
  });

  it('returns a valid PDF payload for tenant-scoped receipts', async () => {
    const payment = buildPayment({
      paidAt: new Date('2026-04-27T10:00:00.000Z'),
      student: {
        id: 'student-1',
        firstNameEn: 'Erwin',
        lastNameEn: 'Shrestha',
      },
      invoice: buildInvoice({
        invoiceNumber: 'INV-2026-00001',
      }),
    });
    const receipt = {
      receiptNumber: 'REC-2026-00001',
      pdfUrl: '/api/v1/receipts/REC-2026-00001.pdf',
      payment,
    };
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: null,
      receipt,
    });

    const pdf = await service.getReceiptPdf(receipt.receiptNumber, actor);

    expect(prisma.receipt.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: actor.tenantId,
        receiptNumber: receipt.receiptNumber,
      },
      include: {
        payment: {
          include: {
            collectedBy: true,
            invoice: {
              include: {
                lines: {
                  include: {
                    feeHead: true,
                  },
                },
              },
            },
            student: {
              include: {
                class: true,
                sectionRef: true,
              },
            },
            refunds: true,
          },
        },
        tenant: true,
      },
    });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('returns parent-scoped receipt PDFs only for the requested student', async () => {
    const payment = buildPayment({
      paidAt: new Date('2026-04-27T10:00:00.000Z'),
      studentId: 'student-1',
      student: {
        id: 'student-1',
        firstNameEn: 'Erwin',
        lastNameEn: 'Shrestha',
      },
      invoice: buildInvoice({
        invoiceNumber: 'INV-2026-00001',
      }),
    });
    const receipt = {
      receiptNumber: 'REC-2026-00001',
      pdfUrl: '/api/v1/receipts/REC-2026-00001.pdf',
      payment,
    };
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      receipt,
    });

    const pdf = await service.getReceiptPdfForStudent(
      receipt.receiptNumber,
      'student-1',
      actor,
    );

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    await expect(
      service.getReceiptPdfForStudent(
        receipt.receiptNumber,
        'student-other',
        actor,
      ),
    ).rejects.toThrow('Receipt not found for this student');
  });

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

  it('blocks voiding invoices with net payments still applied', async () => {
    const invoice = buildInvoice({
      payments: [buildInvoicePayment({ amount: new Prisma.Decimal(100) })],
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

  it('blocks adjustments that would reduce total below net paid amount', async () => {
    const invoice = buildInvoice({
      payments: [buildInvoicePayment({ amount: new Prisma.Decimal(950) })],
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

  it('creates a partial refund with a dedicated journal entry', async () => {
    const payment = buildPayment({
      amount: new Prisma.Decimal(500),
      invoice: buildInvoice({
        status: InvoiceStatus.PAID,
        totalAmount: new Prisma.Decimal(500),
        paidAt: new Date('2026-04-21T00:00:00.000Z'),
        payments: [
          buildInvoicePayment({
            id: 'payment-1',
            amount: new Prisma.Decimal(500),
          }),
        ],
      }),
    });
    const sourceJournal = buildPaymentJournal({
      amount: new Prisma.Decimal(500),
    });
    const createdRefund = {
      id: 'refund-1',
      refundNumber: 'RFD-2026-00001',
      amount: new Prisma.Decimal(200),
      refundDate: new Date('2026-04-27T00:00:00.000Z'),
    };
    const createdRefundJournal = {
      id: 'journal-refund-1',
      entryNumber: 'JE-2026-00005',
    };
    const updatedInvoice = {
      ...payment.invoice,
      status: InvoiceStatus.PARTIAL,
      paidAt: null,
    };
    const { service, prisma, auditService, accountingPostingService } =
      buildService({
        invoice: null,
        feeHead: null,
        payment,
        sourceJournal,
        createdRefund,
        createdJournalEntry: createdRefundJournal,
        updatedInvoice,
        paymentRefundCount: 0,
        journalCount: 4,
      });

    const result = await service.refundPayment(
      payment.id,
      {
        amount: 200,
        reason: ' Parent requested correction ',
        refundDate: '2026-04-27',
      },
      actor,
    );

    expect(prisma.payment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: payment.id, tenantId: actor.tenantId },
      }),
    );
    expect(result).toEqual({
      refundId: createdRefund.id,
      refundNumber: createdRefund.refundNumber,
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      amount: 200,
      refundDate: createdRefund.refundDate,
      journalEntryNumber: createdRefundJournal.entryNumber,
      remainingRefundableAmount: 300,
      invoiceStatus: InvoiceStatus.PARTIAL,
    });
    expect(prisma.paymentRefund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: actor.tenantId,
        paymentId: payment.id,
        refundNumber: 'RFD-2026-00001',
        amount: new Prisma.Decimal(200),
        reason: 'Parent requested correction',
      }),
    });
    expect(accountingPostingService.postPaymentRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        refundId: createdRefund.id,
        amount: new Prisma.Decimal(200),
        lines: [
          expect.objectContaining({
            chartAccountId: 'income',
            amount: new Prisma.Decimal(200),
          }),
        ],
      }),
      actor,
      expect.anything(),
    );
    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: payment.invoiceId },
      data: {
        status: InvoiceStatus.PARTIAL,
        paidAt: null,
      },
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'refund',
        resource: 'payment_refund',
        resourceId: createdRefund.id,
      }),
    );
  });

  it('requires an auditable refund reason before reversing a payment', async () => {
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: null,
      payment: buildPayment(),
      sourceJournal: buildPaymentJournal(),
    });

    await expect(
      service.refundPayment('payment-1', { amount: 100, reason: '   ' }, actor),
    ).rejects.toThrow('Refund reason is required');
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('blocks refunding more than the remaining refundable amount', async () => {
    const payment = buildPayment({
      amount: new Prisma.Decimal(300),
      refunds: [{ amount: new Prisma.Decimal(200) }],
      invoice: buildInvoice({
        status: InvoiceStatus.PARTIAL,
        totalAmount: new Prisma.Decimal(300),
        payments: [
          buildInvoicePayment({
            id: 'payment-1',
            amount: new Prisma.Decimal(300),
            refunds: [{ amount: new Prisma.Decimal(200) }],
          }),
        ],
      }),
    });
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      payment,
      sourceJournal: buildPaymentJournal({ amount: new Prisma.Decimal(300) }),
    });

    await expect(
      service.refundPayment(
        payment.id,
        { amount: 150, reason: 'Too much originally charged' },
        actor,
      ),
    ).rejects.toThrow('Refund exceeds the remaining refundable amount');
  });

  it('blocks refunding an already fully refunded payment', async () => {
    const payment = buildPayment({
      amount: new Prisma.Decimal(300),
      refunds: [{ amount: new Prisma.Decimal(300) }],
    });
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      payment,
      sourceJournal: buildPaymentJournal({ amount: new Prisma.Decimal(300) }),
    });

    await expect(
      service.refundPayment(
        payment.id,
        { reason: 'Duplicate counter entry' },
        actor,
      ),
    ).rejects.toThrow('Payment has already been fully refunded');
  });

  it('blocks refunding payments attached to voided invoices', async () => {
    const payment = buildPayment({
      invoice: buildInvoice({
        status: InvoiceStatus.VOID,
        totalAmount: new Prisma.Decimal(500),
        payments: [
          buildInvoicePayment({
            id: 'payment-1',
            amount: new Prisma.Decimal(500),
          }),
        ],
      }),
    });
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      payment,
      sourceJournal: buildPaymentJournal({ amount: new Prisma.Decimal(500) }),
    });

    await expect(
      service.refundPayment(
        payment.id,
        { amount: 100, reason: 'Correction' },
        actor,
      ),
    ).rejects.toThrow('Voided invoices cannot be refunded');
  });

  it('blocks refunds in a closed accounting period', async () => {
    const payment = buildPayment({
      invoice: buildInvoice({
        status: InvoiceStatus.PAID,
        totalAmount: new Prisma.Decimal(500),
        payments: [
          buildInvoicePayment({
            id: 'payment-1',
            amount: new Prisma.Decimal(500),
          }),
        ],
      }),
    });
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      payment,
      sourceJournal: buildPaymentJournal({ amount: new Prisma.Decimal(500) }),
      closedPeriod: { id: 'period-1', name: 'FY 2082 Closed' },
    });

    await expect(
      service.refundPayment(
        payment.id,
        { amount: 100, reason: 'Correction', refundDate: '2026-04-27' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('previews and finalizes a cashier close with refund deductions', async () => {
    const paymentRows = [
      buildCashierPayment({
        amount: new Prisma.Decimal(500),
        receipt: { receiptNumber: 'REC-2026-00001' },
      }),
      buildCashierPayment({
        id: 'payment-2',
        method: PaymentMethod.BANK,
        amount: new Prisma.Decimal(300),
        receipt: { receiptNumber: 'REC-2026-00002' },
      }),
    ];
    const refundRows = [
      {
        id: 'refund-1',
        amount: new Prisma.Decimal(100),
        refundDate: new Date('2026-04-27T10:30:00.000Z'),
        payment: {
          method: PaymentMethod.CASH,
          receipt: { receiptNumber: 'REC-2026-00001' },
        },
      },
    ];
    const createdClose = {
      id: 'close-1',
      closeNumber: 'CLS-2026-00001',
      openedAt: new Date('2026-04-27T09:00:00.000Z'),
      closedAt: new Date('2026-04-27T17:00:00.000Z'),
      grossCollected: new Prisma.Decimal(800),
      totalRefunded: new Prisma.Decimal(100),
      netCollected: new Prisma.Decimal(700),
      expectedCashAmount: new Prisma.Decimal(400),
      actualCashAmount: new Prisma.Decimal(390),
      varianceAmount: new Prisma.Decimal(-10),
      varianceReason: 'Cash drawer short by Rs 10 after recount',
      denominationBreakdown: { '100': 3, '50': 1, '20': 2 },
      methodBreakdown: [
        {
          method: PaymentMethod.CASH,
          grossCollected: 500,
          totalRefunded: 100,
          netCollected: 400,
          paymentCount: 1,
          refundCount: 1,
        },
        {
          method: PaymentMethod.BANK,
          grossCollected: 300,
          totalRefunded: 0,
          netCollected: 300,
          paymentCount: 1,
          refundCount: 0,
        },
      ],
      paymentCount: 2,
      refundCount: 1,
      firstReceiptNumber: 'REC-2026-00001',
      lastReceiptNumber: 'REC-2026-00002',
      notes: 'Day close',
      collectorUser: null,
      closedBy: { id: actor.userId, email: actor.email },
    };
    const fileRegistryService = {
      registerGeneratedFile: jest.fn().mockResolvedValue({
        id: 'file-close-1',
        originalFilename: 'DayEndClose_CLS-2026-00001.pdf',
        mimeType: 'application/pdf',
        sizeBytes: BigInt(2048),
      }),
    };
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: null,
      cashierPayments: paymentRows,
      cashierRefunds: refundRows,
      createdCashierClose: createdClose,
      cashierCloseCount: 0,
      fileRegistryService,
    });

    const preview = await service.previewCashierClose(
      {
        openedAt: '2026-04-27T09:00:00.000Z',
        closedAt: '2026-04-27T17:00:00.000Z',
      },
      actor,
    );
    const finalized = await service.finalizeCashierClose(
      {
        openedAt: '2026-04-27T09:00:00.000Z',
        closedAt: '2026-04-27T17:00:00.000Z',
        actualCashAmount: 390,
        varianceReason: 'Cash drawer short by Rs 10 after recount',
        denominationBreakdown: { '100': 3, '50': 1, '20': 2 },
        notes: 'Day close',
      },
      actor,
    );

    expect(preview).toEqual(
      expect.objectContaining({
        grossCollected: 800,
        totalRefunded: 100,
        netCollected: 700,
        paymentCount: 2,
        refundCount: 1,
        expectedCashAmount: 400,
        methodBreakdown: expect.arrayContaining([
          expect.objectContaining({
            method: PaymentMethod.CASH,
            grossCollected: 500,
            totalRefunded: 100,
            netCollected: 400,
          }),
          expect.objectContaining({
            method: PaymentMethod.BANK,
            grossCollected: 300,
            netCollected: 300,
          }),
        ]),
      }),
    );
    expect(prisma.cashierClose.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        closeNumber: 'CLS-2026-00001',
        grossCollected: new Prisma.Decimal(800),
        totalRefunded: new Prisma.Decimal(100),
        netCollected: new Prisma.Decimal(700),
        expectedCashAmount: new Prisma.Decimal(400),
        actualCashAmount: new Prisma.Decimal(390),
        varianceAmount: new Prisma.Decimal(-10),
        varianceReason: 'Cash drawer short by Rs 10 after recount',
        methodBreakdown: expect.arrayContaining([
          expect.objectContaining({
            method: PaymentMethod.CASH,
            netCollected: 400,
          }),
          expect.objectContaining({
            method: PaymentMethod.BANK,
            netCollected: 300,
          }),
        ]),
      }),
      include: {
        collectorUser: true,
        closedBy: true,
      },
    });
    expect(finalized.closeNumber).toBe('CLS-2026-00001');
    expect(Number(finalized.actualCashAmount)).toBe(390);
    expect(Number(finalized.varianceAmount)).toBe(-10);
    expect(finalized.closePdfFile).toEqual({
      fileAssetId: 'file-close-1',
      fileName: 'DayEndClose_CLS-2026-00001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
    });
    expect(fileRegistryService.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        originalFilename: 'DayEndClose_CLS-2026-00001.pdf',
        mimeType: 'application/pdf',
        module: 'fees',
        entityId: 'close-1',
        metadata: expect.objectContaining({
          kind: 'cashier_close_pdf',
          closeId: 'close-1',
          closeNumber: 'CLS-2026-00001',
        }),
      }),
    );
  });

  it('requires a variance reason when actual cash differs from expected cash', async () => {
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      cashierPayments: [
        buildCashierPayment({ amount: new Prisma.Decimal(500) }),
      ],
      cashierRefunds: [],
    });

    await expect(
      service.finalizeCashierClose(
        {
          openedAt: '2026-04-27T09:00:00.000Z',
          closedAt: '2026-04-27T17:00:00.000Z',
          actualCashAmount: 450,
        },
        actor,
      ),
    ).rejects.toThrow('A variance reason is required');
  });

  it('blocks duplicate cashier close windows', async () => {
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      existingCashierClose: { id: 'close-1', closeNumber: 'CLS-2026-00001' },
    });

    await expect(
      service.finalizeCashierClose(
        {
          openedAt: '2026-04-27T09:00:00.000Z',
          closedAt: '2026-04-27T17:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toThrow('This cashier window is already closed for today.');
  });

  it('blocks cashier close races when a duplicate appears inside the transaction', async () => {
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: null,
      cashierPayments: [],
      cashierRefunds: [],
      cashierCloseCount: 0,
    });
    prisma.cashierClose.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'close-race' });

    await expect(
      service.finalizeCashierClose(
        {
          openedAt: '2026-04-27T09:00:00.000Z',
          closedAt: '2026-04-27T17:00:00.000Z',
        },
        actor,
      ),
    ).rejects.toThrow('This cashier window is already closed for today.');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.cashierClose.create).not.toHaveBeenCalled();
  });

  it('builds reconciliation rows and csv export from the same payments', async () => {
    const paymentRows = [
      {
        id: 'payment-1',
        paidAt: new Date('2026-04-27T09:15:00.000Z'),
        amount: new Prisma.Decimal(500),
        method: PaymentMethod.CASH,
        invoiceId: 'invoice-1',
        receipt: { receiptNumber: 'REC-2026-00001' },
        collectedBy: { id: actor.userId, email: actor.email },
        student: {
          id: 'student-1',
          firstNameEn: 'Erwin',
          lastNameEn: 'Shrestha',
          class: { name: 'Grade 1' },
        },
        invoice: { invoiceNumber: 'INV-2026-00001' },
        refunds: [
          {
            id: 'refund-1',
            refundNumber: 'RFD-2026-00001',
            refundDate: new Date('2026-04-27T12:00:00.000Z'),
            amount: new Prisma.Decimal(100),
          },
        ],
      },
    ];
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      reconciliationPayments: paymentRows,
      reconciliationPaymentEntries: [
        { sourceId: 'payment-1', entryNumber: 'JE-2026-00010' },
      ],
      reconciliationRefundEntries: [
        { sourceId: 'refund-1', entryNumber: 'JE-2026-00011' },
      ],
    });

    const summary = await service.getReconciliationSummary(
      {
        openedAt: '2026-04-27T09:00:00.000Z',
        closedAt: '2026-04-27T17:00:00.000Z',
      },
      actor,
    );
    const csv = await service.exportReconciliation(
      {
        openedAt: '2026-04-27T09:00:00.000Z',
        closedAt: '2026-04-27T17:00:00.000Z',
        format: 'csv' as never,
      },
      actor,
    );

    expect(summary.totalRows).toBe(1);
    expect(summary.grossCollected).toBe(500);
    expect(summary.totalRefunded).toBe(100);
    expect(summary.netCollected).toBe(400);
    expect(summary.rows[0]).toEqual(
      expect.objectContaining({
        receiptNumber: 'REC-2026-00001',
        refundNumber: 'RFD-2026-00001',
        journalEntryNumber: 'JE-2026-00010',
        refundJournalEntryNumbers: ['JE-2026-00011'],
      }),
    );
    expect(csv).toContain('REC-2026-00001');
    expect(csv).toContain('RFD-2026-00001');
  });

  it('reports payment gateway readiness without pretending online payments are enabled', async () => {
    const { service, prisma } = buildService({
      invoice: null,
      feeHead: null,
      gatewayProvider: null,
    });

    const result = await service.getPaymentGatewayReadiness(actor);

    expect(prisma.providerConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'PAYMENT_GATEWAY',
          enabled: true,
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        enabled: false,
        status: 'not_configured',
        webhookReady: false,
        paymentIntentReady: false,
        message: 'Online payments are not enabled for this school.',
      }),
    );
  });

  it('marks configured payment gateways ready only when webhook and intent config exist', async () => {
    const { service } = buildService({
      invoice: null,
      feeHead: null,
      gatewayProvider: {
        id: 'provider-1',
        name: 'Nepal Gateway',
        enabled: true,
        environment: 'TEST',
        validationStatus: 'VALID',
        lastValidatedAt: new Date('2026-05-01T00:00:00.000Z'),
        configEncrypted: {
          webhookPath: '/payments/webhooks/nepal-gateway',
          intentUrl: 'https://gateway.test/intent',
          settlementStatusUrl: 'https://gateway.test/settlement',
        },
      },
    });

    const result = await service.getPaymentGatewayReadiness(actor);

    expect(result).toEqual(
      expect.objectContaining({
        enabled: true,
        status: 'ready',
        webhookReady: true,
        paymentIntentReady: true,
        settlementTrackingReady: true,
      }),
    );
  });

  it('rejects missing invoices, fee heads, and source journals', async () => {
    const { service } = buildService({ invoice: null, feeHead: null });

    await expect(
      service.voidInvoice('missing', { reason: 'Missing' }, actor),
    ).rejects.toThrow(NotFoundException);

    const payment = buildPayment({
      invoice: buildInvoice({
        status: InvoiceStatus.PAID,
        totalAmount: new Prisma.Decimal(500),
        payments: [
          buildInvoicePayment({
            id: 'payment-1',
            amount: new Prisma.Decimal(500),
          }),
        ],
      }),
    });
    const missingJournalService = buildService({
      invoice: null,
      feeHead: null,
      payment,
      sourceJournal: null,
    }).service;

    await expect(
      missingJournalService.refundPayment(
        payment.id,
        { amount: 50, reason: 'Correction' },
        actor,
      ),
    ).rejects.toThrow(
      'Original payment journal entry was not found for this payment',
    );
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
    studentId: 'student-1',
    status: InvoiceStatus.ISSUED,
    subtotal: new Prisma.Decimal(1000),
    vatAmount: new Prisma.Decimal(117),
    totalAmount: new Prisma.Decimal(1117),
    paidAt: null,
    payments: [],
    ...overrides,
  };
}

function buildInvoicePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    amount: new Prisma.Decimal(0),
    refunds: [],
    ...overrides,
  };
}

function buildPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    tenantId: actor.tenantId,
    studentId: 'student-1',
    invoiceId: 'invoice-1',
    amount: new Prisma.Decimal(500),
    method: PaymentMethod.CASH,
    refunds: [],
    receipt: {
      receiptNumber: 'REC-2026-00001',
    },
    invoice: buildInvoice({
      id: 'invoice-1',
      status: InvoiceStatus.PAID,
      totalAmount: new Prisma.Decimal(500),
      paidAt: new Date('2026-04-21T00:00:00.000Z'),
      payments: [
        buildInvoicePayment({
          id: 'payment-1',
          amount: new Prisma.Decimal(500),
        }),
      ],
    }),
    ...overrides,
  };
}

function buildPaymentJournal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'journal-payment-1',
    entryNumber: 'JE-2026-00004',
    sourceType: JournalSourceType.FEE_PAYMENT,
    sourceId: 'payment-1',
    lines: [
      {
        chartAccountId: 'cash',
        side: JournalLineSide.DEBIT,
        amount: new Prisma.Decimal(500),
        description: 'Payment receipt REC-2026-00001',
      },
      {
        chartAccountId: 'income',
        side: JournalLineSide.CREDIT,
        amount: new Prisma.Decimal(500),
        description: 'Tuition',
      },
    ],
    ...overrides,
  };
}

function buildCashierPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    method: PaymentMethod.CASH,
    amount: new Prisma.Decimal(0),
    receipt: null,
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
  createdInvoice?: unknown;
  invoiceCount?: number;
  student?: unknown;
  classroom?: unknown;
  feePlan?: unknown;
  createdDiscount?: unknown;
  createdWaiver?: unknown;
  invoiceContainsFeeHead?: boolean;
  payment?: unknown;
  duplicatePayment?: unknown;
  createdPayment?: unknown;
  tenant?: unknown;
  receiptCount?: number;
  cashAccount?: unknown;
  incomeAccount?: unknown;
  sourceJournal?: unknown;
  createdLine?: unknown;
  updatedInvoice?: unknown;
  createdRefund?: unknown;
  createdJournalEntry?: unknown;
  paymentRefundCount?: number;
  journalCount?: number;
  closedPeriod?: unknown;
  cashierPayments?: unknown[];
  cashierRefunds?: unknown[];
  createdCashierClose?: unknown;
  existingCashierClose?: unknown;
  cashierCloseCount?: number;
  cashierCloseList?: unknown[];
  receipt?: unknown;
  invoices?: unknown[];
  waivers?: unknown[];
  reconciliationPayments?: unknown[];
  reconciliationPaymentEntries?: unknown[];
  reconciliationRefundEntries?: unknown[];
  gatewayProvider?: unknown;
  cashierClosePdfFiles?: unknown[];
  fileRegistryService?: unknown;
}) {
  const prisma = {
    student: {
      findFirst: jest.fn().mockResolvedValue(options.student ?? null),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(options.invoice),
      findMany: jest.fn().mockResolvedValue(options.invoices ?? []),
      count: jest.fn().mockResolvedValue(options.invoiceCount ?? 0),
      create: jest.fn().mockResolvedValue(options.createdInvoice),
      update: jest.fn().mockResolvedValue(options.updatedInvoice),
    },
    discountRule: {
      create: jest.fn().mockResolvedValue(options.createdDiscount),
      findMany: jest.fn().mockResolvedValue([]),
    },
    feeWaiver: {
      create: jest.fn().mockResolvedValue(options.createdWaiver),
      findMany: jest.fn().mockResolvedValue(options.waivers ?? []),
    },
    feeHead: {
      findFirst: jest.fn().mockResolvedValue(options.feeHead),
      upsert: jest.fn().mockResolvedValue(
        options.feeHead ?? {
          id: 'fee-head-meal',
          code: 'MEALPLAN',
          name: 'Canteen Meal Plan',
        },
      ),
    },
    academicYear: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ay-1' }),
    },
    feePlan: {
      findFirst: jest.fn().mockResolvedValue(options.feePlan ?? null),
    },
    class: {
      findFirst: jest.fn().mockResolvedValue(options.classroom ?? null),
    },
    payment: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.duplicatePayment ?? options.payment ?? null),
      create: jest.fn().mockResolvedValue(options.createdPayment),
      findMany: jest
        .fn()
        .mockResolvedValue(
          options.cashierPayments ?? options.reconciliationPayments ?? [],
        ),
    },
    paymentRefund: {
      count: jest.fn().mockResolvedValue(options.paymentRefundCount ?? 0),
      create: jest.fn().mockResolvedValue(options.createdRefund),
      findMany: jest.fn().mockResolvedValue(options.cashierRefunds ?? []),
    },
    cashierClose: {
      count: jest.fn().mockResolvedValue(options.cashierCloseCount ?? 0),
      findFirst: jest
        .fn()
        .mockResolvedValue(options.existingCashierClose ?? null),
      create: jest.fn().mockResolvedValue(options.createdCashierClose),
      findMany: jest.fn().mockResolvedValue(options.cashierCloseList ?? []),
    },
    journalEntry: {
      findFirst: jest.fn().mockResolvedValue(options.sourceJournal ?? null),
      count: jest.fn().mockResolvedValue(options.journalCount ?? 0),
      create: jest.fn().mockResolvedValue(options.createdJournalEntry),
      findMany: jest
        .fn()
        .mockImplementation(
          async (args?: { where?: { sourceType?: string } }) => {
            if (args?.where?.sourceType === JournalSourceType.PAYMENT_REFUND) {
              return options.reconciliationRefundEntries ?? [];
            }

            return options.reconciliationPaymentEntries ?? [];
          },
        ),
    },
    providerConfig: {
      findFirst: jest.fn().mockResolvedValue(options.gatewayProvider ?? null),
    },
    invoiceLine: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          options.invoiceContainsFeeHead === false
            ? null
            : { id: 'line-fee-head' },
        ),
      create: jest.fn().mockResolvedValue(options.createdLine),
    },
    receipt: {
      count: jest.fn().mockResolvedValue(options.receiptCount ?? 0),
      findFirst: jest.fn().mockResolvedValue(options.receipt ?? null),
    },
    fileAsset: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(options.cashierClosePdfFiles ?? []),
    },
    tenant: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options.tenant ?? { id: actor.tenantId, name: 'SchoolOS' },
        ),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue(
          options.tenant ?? { id: actor.tenantId, name: 'SchoolOS' },
        ),
    },
    chartAccount: {
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(
          async (args?: { where?: { tenantId_code?: { code?: string } } }) => {
            const code = args?.where?.tenantId_code?.code;

            if (code === '1000' || code === '1010' || code === '1020') {
              return options.cashAccount ?? { id: 'cash' };
            }

            return options.incomeAccount ?? { id: 'income' };
          },
        ),
    },
    accountingPeriod: {
      findFirst: jest.fn().mockResolvedValue(options.closedPeriod ?? null),
    },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  };
  const auditService = {
    record: jest.fn(),
  };
  const communicationsService = {};
  const accountingPostingService = {
    postFeePayment: jest
      .fn()
      .mockResolvedValue(
        options.createdJournalEntry ?? { entryNumber: 'JE-PAY-1' },
      ),
    postFeeWaiver: jest
      .fn()
      .mockResolvedValue(
        options.createdJournalEntry ?? { entryNumber: 'JE-WAV-1' },
      ),
    postInvoice: jest
      .fn()
      .mockResolvedValue(
        options.createdJournalEntry ?? { entryNumber: 'JE-INV-1' },
      ),
    postPaymentRefund: jest
      .fn()
      .mockResolvedValue(
        options.createdJournalEntry ?? { entryNumber: 'JE-RFD-1' },
      ),
  };
  const eventEmitter = {
    emit: jest.fn(),
  };

  return {
    service: new FinanceService(
      prisma as never,
      auditService as never,
      communicationsService as never,
      accountingPostingService as never,
      eventEmitter as never,
      {
        verifyLimit: jest.fn().mockResolvedValue(undefined),
        checkLimit: jest.fn().mockResolvedValue(undefined),
        incrementUsage: jest.fn().mockResolvedValue(undefined),
      } as any,
      options.fileRegistryService as never,
    ),
    prisma,
    auditService,
    eventEmitter,
    accountingPostingService,
  };
}

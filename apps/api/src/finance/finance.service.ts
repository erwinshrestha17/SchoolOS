import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  InvoiceStatus,
  JournalLineSide,
  JournalSourceType,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { CreateFeeWaiverDto } from './dto/create-fee-waiver.dto';
import { GenerateBillingRunDto } from './dto/generate-billing-run.dto';
import { resolveCashAccountCode } from './finance.defaults';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listFeeHeads(actor: AuthContext) {
    return this.prisma.feeHead.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  async createFeeHead(dto: CreateFeeHeadDto, actor: AuthContext) {
    const existing = await this.prisma.feeHead.findUnique({
      where: {
        tenantId_code: {
          tenantId: actor.tenantId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Fee head already exists in this tenant');
    }

    const feeHead = await this.prisma.feeHead.create({
      data: {
        tenantId: actor.tenantId,
        code: dto.code,
        name: dto.name,
        frequency: dto.frequency,
        defaultAmount: new Prisma.Decimal(dto.defaultAmount),
        vatApplicable: dto.vatApplicable ?? true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fee_head',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: feeHead.id,
      after: {
        code: feeHead.code,
        name: feeHead.name,
      },
    });

    return feeHead;
  }

  async listFeePlans(actor: AuthContext) {
    return this.prisma.feePlan.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        class: true,
        items: {
          include: {
            feeHead: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createFeePlan(dto: CreateFeePlanDto, actor: AuthContext) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId: actor.tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (dto.classId) {
      const classroom = await this.prisma.class.findFirst({
        where: { id: dto.classId, tenantId: actor.tenantId },
      });

      if (!classroom) {
        throw new NotFoundException('Class not found in this tenant');
      }
    }

    const feeHeads = await this.prisma.feeHead.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: dto.items.map((item) => item.feeHeadId) },
      },
    });

    if (feeHeads.length !== dto.items.length) {
      throw new NotFoundException(
        'One or more fee heads were not found in this tenant',
      );
    }

    const feePlan = await this.prisma.feePlan.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        classId: dto.classId ?? null,
        code: dto.code,
        name: dto.name,
        items: {
          create: dto.items.map((item) => ({
            tenantId: actor.tenantId,
            feeHeadId: item.feeHeadId,
            amount: new Prisma.Decimal(item.amount),
          })),
        },
      },
      include: {
        items: {
          include: {
            feeHead: true,
          },
        },
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fee_plan',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: feePlan.id,
      after: {
        code: feePlan.code,
        classId: feePlan.classId,
        academicYearId: feePlan.academicYearId,
        itemCount: feePlan.items.length,
      },
    });

    return feePlan;
  }

  async listBillingRuns(actor: AuthContext) {
    return this.prisma.feeBillingRun.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        feePlan: true,
        invoices: true,
      },
      orderBy: [{ generatedAt: 'desc' }],
    });
  }

  async generateBillingRun(dto: GenerateBillingRunDto, actor: AuthContext) {
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: dto.academicYearId, tenantId: actor.tenantId },
    });

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (dto.feePlanId) {
      const feePlan = await this.prisma.feePlan.findFirst({
        where: { id: dto.feePlanId, tenantId: actor.tenantId },
      });

      if (!feePlan) {
        throw new NotFoundException('Fee plan not found in this tenant');
      }
    }

    const assignments = await this.prisma.studentFeeAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        isActive: true,
        ...(dto.feePlanId ? { feePlanId: dto.feePlanId } : {}),
      },
      include: {
        student: true,
        feePlan: {
          include: {
            items: {
              include: {
                feeHead: true,
              },
            },
          },
        },
      },
    });

    if (assignments.length === 0) {
      throw new NotFoundException(
        'No active fee assignments found for this billing run',
      );
    }

    const run = await this.prisma.feeBillingRun.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        feePlanId: dto.feePlanId ?? null,
        runMonth: dto.runMonth,
        runYear: dto.runYear,
        generatedById: actor.userId,
        notes: dto.notes ?? null,
      },
    });

    const invoices: Array<
      Awaited<ReturnType<typeof this.prisma.invoice.create>>
    > = [];

    for (const assignment of assignments) {
      const invoiceNumber = await this.generateInvoiceNumber(actor.tenantId);
      const calculated = await this.calculateInvoiceLines({
        tenantId: actor.tenantId,
        classId: assignment.student.classId,
        feePlanId: assignment.feePlanId,
        items: assignment.feePlan.items,
      });

      invoices.push(
        await this.prisma.invoice.create({
          data: {
            tenantId: actor.tenantId,
            studentId: assignment.studentId,
            academicYearId: dto.academicYearId,
            billingRunId: run.id,
            invoiceNumber,
            dueDate: new Date(dto.dueDate),
            subtotal: calculated.subtotal,
            vatAmount: calculated.vatAmount,
            totalAmount: calculated.totalAmount,
            lines: {
              create: calculated.lines,
            },
          },
          include: {
            student: true,
            lines: true,
          },
        }),
      );
    }

    await this.auditService.record({
      action: 'generate',
      resource: 'fee_billing_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: run.id,
      after: {
        academicYearId: dto.academicYearId,
        feePlanId: dto.feePlanId ?? null,
        invoiceCount: invoices.length,
      },
    });

    return {
      ...run,
      invoices,
    };
  }

  async listDiscountRules(actor: AuthContext) {
    return this.prisma.discountRule.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        feeHead: true,
        class: true,
        feePlan: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createDiscountRule(dto: CreateDiscountRuleDto, actor: AuthContext) {
    const discount = await this.prisma.discountRule.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        type: dto.type,
        feeHeadId: dto.feeHeadId ?? null,
        classId: dto.classId ?? null,
        feePlanId: dto.feePlanId ?? null,
        percentOff:
          dto.percentOff === undefined
            ? null
            : new Prisma.Decimal(dto.percentOff),
        amountOff:
          dto.amountOff === undefined
            ? null
            : new Prisma.Decimal(dto.amountOff),
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'discount_rule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: discount.id,
      after: {
        name: discount.name,
        type: discount.type,
      },
    });

    return discount;
  }

  async listWaivers(actor: AuthContext) {
    return this.prisma.feeWaiver.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        feeHead: true,
        approvedBy: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createWaiver(dto: CreateFeeWaiverDto, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: { id: dto.studentId, tenantId: actor.tenantId },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const invoice = dto.invoiceId
      ? await this.prisma.invoice.findFirst({
          where: { id: dto.invoiceId, tenantId: actor.tenantId },
          include: { payments: true },
        })
      : null;

    if (dto.invoiceId && !invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    const amount = new Prisma.Decimal(dto.amount);

    const waiver = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feeWaiver.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          feeHeadId: dto.feeHeadId ?? null,
          invoiceId: dto.invoiceId ?? null,
          amount,
          reason: dto.reason,
          approvedById: actor.userId,
          approvedAt: new Date(),
        },
      });

      if (invoice) {
        const paidAmount = invoice.payments.reduce(
          (sum, payment) => sum.add(payment.amount),
          new Prisma.Decimal(0),
        );
        const newTotal = invoice.totalAmount.sub(amount);
        const safeTotal = newTotal.gt(0) ? newTotal : new Prisma.Decimal(0);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: invoice.subtotal.sub(amount).gt(0)
              ? invoice.subtotal.sub(amount)
              : new Prisma.Decimal(0),
            totalAmount: safeTotal,
            status: paidAmount.gte(safeTotal)
              ? InvoiceStatus.PAID
              : invoice.status,
          },
        });
      }

      return created;
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fee_waiver',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: waiver.id,
      after: {
        studentId: dto.studentId,
        invoiceId: dto.invoiceId ?? null,
        amount: dto.amount,
      },
    });

    return waiver;
  }

  async listInvoices(actor: AuthContext) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        payments: true,
      },
      orderBy: [{ issuedAt: 'desc' }],
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      dueDate: invoice.dueDate,
      totalAmount: Number(invoice.totalAmount),
      student: {
        id: invoice.student.id,
        name: `${invoice.student.firstNameEn} ${invoice.student.lastNameEn}`.trim(),
      },
      paidAmount: invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      ),
    }));
  }

  async listDefaulters(actor: AuthContext) {
    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        dueDate: { lt: today },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      },
      include: {
        student: {
          include: {
            class: true,
            sectionRef: true,
          },
        },
        payments: true,
      },
      orderBy: [{ dueDate: 'asc' }],
    });

    return invoices.map((invoice) => {
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum + Number(payment.amount),
        0,
      );
      const outstanding = Number(invoice.totalAmount) - paidAmount;
      const daysOverdue = Math.max(
        0,
        Math.floor((today.getTime() - invoice.dueDate.getTime()) / 86_400_000),
      );

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        studentId: invoice.studentId,
        studentName:
          `${invoice.student.firstNameEn} ${invoice.student.lastNameEn}`.trim(),
        className: invoice.student.class.name,
        sectionName: invoice.student.sectionRef?.name ?? null,
        dueDate: invoice.dueDate,
        outstanding,
        daysOverdue,
        agingBucket: getAgingBucket(daysOverdue),
      };
    });
  }

  async assignFeePlansForEnrollment(input: {
    tenantId: string;
    studentId: string;
    academicYearId: string;
    classId: string;
  }) {
    const feePlans = await this.prisma.feePlan.findMany({
      where: {
        tenantId: input.tenantId,
        academicYearId: input.academicYearId,
        isActive: true,
        OR: [{ classId: null }, { classId: input.classId }],
      },
    });

    for (const feePlan of feePlans) {
      await this.prisma.studentFeeAssignment.upsert({
        where: {
          studentId_feePlanId_academicYearId: {
            studentId: input.studentId,
            feePlanId: feePlan.id,
            academicYearId: input.academicYearId,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          tenantId: input.tenantId,
          studentId: input.studentId,
          feePlanId: feePlan.id,
          academicYearId: input.academicYearId,
          isActive: true,
        },
      });
    }
  }

  async createInitialInvoice(input: {
    actor: AuthContext;
    studentId: string;
    academicYearId: string;
    enrollmentId: string;
    dueDate: Date;
  }) {
    const assignments = await this.prisma.studentFeeAssignment.findMany({
      where: {
        tenantId: input.actor.tenantId,
        studentId: input.studentId,
        academicYearId: input.academicYearId,
        isActive: true,
      },
      include: {
        feePlan: {
          include: {
            items: {
              include: {
                feeHead: true,
              },
            },
          },
        },
      },
    });

    const lineSeed = assignments.flatMap(
      (assignment) => assignment.feePlan.items,
    );

    if (lineSeed.length === 0) {
      return null;
    }

    const invoiceNumber = await this.generateInvoiceNumber(
      input.actor.tenantId,
    );
    let subtotal = new Prisma.Decimal(0);
    let vatAmount = new Prisma.Decimal(0);

    for (const item of lineSeed) {
      subtotal = subtotal.add(item.amount);

      if (item.feeHead.vatApplicable) {
        vatAmount = vatAmount.add(item.amount.mul(0.13));
      }
    }

    return this.prisma.invoice.create({
      data: {
        tenantId: input.actor.tenantId,
        studentId: input.studentId,
        academicYearId: input.academicYearId,
        enrollmentId: input.enrollmentId,
        invoiceNumber,
        dueDate: input.dueDate,
        subtotal,
        vatAmount,
        totalAmount: subtotal.add(vatAmount),
        lines: {
          create: lineSeed.map((item) => {
            const lineVat = item.feeHead.vatApplicable
              ? item.amount.mul(0.13)
              : new Prisma.Decimal(0);

            return {
              tenantId: input.actor.tenantId,
              feeHeadId: item.feeHeadId,
              description: item.feeHead.name,
              quantity: 1,
              unitAmount: item.amount,
              vatAmount: lineVat,
              totalAmount: item.amount.add(lineVat),
            };
          }),
        },
      },
      include: {
        lines: true,
      },
    });
  }

  async collectPayment(dto: CollectPaymentDto, actor: AuthContext) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, tenantId: actor.tenantId },
      include: {
        student: true,
        lines: {
          include: {
            feeHead: true,
          },
        },
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    const paidSoFar = invoice.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const paymentAmount = new Prisma.Decimal(dto.amount);
    const remaining = invoice.totalAmount.sub(paidSoFar);

    if (paymentAmount.gt(remaining)) {
      throw new ConflictException('Payment exceeds the remaining balance');
    }

    const receiptNumber = await this.generateReceiptNumber(actor.tenantId);
    const journalEntryNumber = await this.generateJournalEntryNumber(
      actor.tenantId,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: actor.tenantId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          collectedById: actor.userId,
          method: dto.method,
          referenceNumber: dto.referenceNumber ?? null,
          amount: paymentAmount,
          paidAt: new Date(),
          narration: dto.narration ?? null,
          receipt: {
            create: {
              tenantId: actor.tenantId,
              receiptNumber,
              pdfUrl: `/api/v1/receipts/${receiptNumber}.pdf`,
            },
          },
        },
        include: {
          receipt: true,
        },
      });

      const totalPaid = paidSoFar.add(paymentAmount);

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: totalPaid.gte(invoice.totalAmount)
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIAL,
          paidAt: totalPaid.gte(invoice.totalAmount) ? new Date() : null,
        },
      });

      const debitAccount = await tx.chartAccount.findUniqueOrThrow({
        where: {
          tenantId_code: {
            tenantId: actor.tenantId,
            code: resolveCashAccountCode(dto.method),
          },
        },
      });

      const allocatedLines = allocatePaymentAcrossLines(
        invoice.lines.map((line) => ({
          id: line.id,
          totalAmount: line.totalAmount,
          feeHeadCode: line.feeHead.code,
          description: line.description,
        })),
        paymentAmount,
        invoice.totalAmount,
      );

      const creditLines = await Promise.all(
        allocatedLines.map(async (line) => {
          const account = await tx.chartAccount.findUniqueOrThrow({
            where: {
              tenantId_code: {
                tenantId: actor.tenantId,
                code: resolveIncomeAccountCode(line.feeHeadCode),
              },
            },
          });

          return {
            chartAccountId: account.id,
            amount: line.totalAmount,
            description: line.description,
          };
        }),
      );

      await tx.journalEntry.create({
        data: {
          tenantId: actor.tenantId,
          entryNumber: journalEntryNumber,
          entryDate: new Date(),
          narration:
            dto.narration ?? `Fee payment for invoice ${invoice.invoiceNumber}`,
          sourceType: JournalSourceType.FEE_PAYMENT,
          sourceId: payment.id,
          createdById: actor.userId,
          lines: {
            create: [
              {
                tenantId: actor.tenantId,
                chartAccountId: debitAccount.id,
                side: JournalLineSide.DEBIT,
                amount: paymentAmount,
                description: `Payment receipt ${receiptNumber}`,
              },
              ...creditLines.map((line) => ({
                tenantId: actor.tenantId,
                chartAccountId: line.chartAccountId,
                side: JournalLineSide.CREDIT,
                amount: line.amount,
                description: line.description,
              })),
            ],
          },
        },
      });

      return payment;
    });

    await this.auditService.record({
      action: 'collect',
      resource: 'payment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.id,
      after: {
        invoiceId: dto.invoiceId,
        amount: dto.amount,
        method: dto.method,
        receiptNumber: result.receipt?.receiptNumber ?? null,
      },
    });

    return {
      paymentId: result.id,
      invoiceId: dto.invoiceId,
      amount: Number(result.amount),
      method: result.method,
      paidAt: result.paidAt,
      receiptNumber: result.receipt?.receiptNumber ?? null,
    };
  }

  async listPayments(actor: AuthContext) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        receipt: true,
      },
      orderBy: [{ paidAt: 'desc' }],
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      method: payment.method,
      paidAt: payment.paidAt,
      student: {
        id: payment.student.id,
        name: `${payment.student.firstNameEn} ${payment.student.lastNameEn}`.trim(),
      },
      receiptNumber: payment.receipt?.receiptNumber ?? null,
    }));
  }

  async listReceipts(actor: AuthContext) {
    const receipts = await this.prisma.receipt.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        payment: {
          include: {
            invoice: true,
            student: true,
          },
        },
      },
      orderBy: [{ issuedAt: 'desc' }],
    });

    return receipts.map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      pdfUrl: receipt.pdfUrl,
      paymentId: receipt.paymentId,
      amount: Number(receipt.payment.amount),
      method: receipt.payment.method,
      invoiceNumber: receipt.payment.invoice.invoiceNumber,
      student: {
        id: receipt.payment.student.id,
        name: `${receipt.payment.student.firstNameEn} ${receipt.payment.student.lastNameEn}`.trim(),
      },
    }));
  }

  async getReceiptPdf(receiptNumber: string, actor: AuthContext) {
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: actor.tenantId,
        receiptNumber,
      },
      include: {
        payment: {
          include: {
            invoice: true,
            student: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found in this tenant');
    }

    return buildSimpleReceiptPdf([
      'SchoolOS Fee Receipt',
      `Receipt: ${receipt.receiptNumber}`,
      `Invoice: ${receipt.payment.invoice.invoiceNumber}`,
      `Student: ${receipt.payment.student.firstNameEn} ${receipt.payment.student.lastNameEn}`,
      `Amount: Rs ${Number(receipt.payment.amount).toFixed(2)}`,
      `Method: ${receipt.payment.method}`,
      `Paid at: ${receipt.payment.paidAt.toISOString()}`,
    ]);
  }

  async listLedgerEntries(actor: AuthContext) {
    return this.prisma.journalEntry.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        lines: {
          include: {
            chartAccount: true,
          },
        },
      },
      orderBy: [{ entryDate: 'desc' }],
    });
  }

  async listAccounts(actor: AuthContext) {
    return this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ code: 'asc' }],
    });
  }

  private async generateInvoiceNumber(tenantId: string) {
    const count = await this.prisma.invoice.count({
      where: { tenantId },
    });

    return `INV-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateReceiptNumber(tenantId: string) {
    const count = await this.prisma.receipt.count({
      where: { tenantId },
    });

    return `REC-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateJournalEntryNumber(tenantId: string) {
    const count = await this.prisma.journalEntry.count({
      where: { tenantId },
    });

    return `JE-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async calculateInvoiceLines(input: {
    tenantId: string;
    classId: string;
    feePlanId: string;
    items: Array<{
      feeHeadId: string;
      amount: Prisma.Decimal;
      feeHead: {
        id: string;
        code: string;
        name: string;
        vatApplicable: boolean;
      };
    }>;
  }) {
    const discounts = await this.prisma.discountRule.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        OR: [
          { classId: input.classId },
          { feePlanId: input.feePlanId },
          { feeHeadId: { in: input.items.map((item) => item.feeHeadId) } },
        ],
      },
    });

    let subtotal = new Prisma.Decimal(0);
    let vatAmount = new Prisma.Decimal(0);

    const lines = input.items.map((item) => {
      const matchingDiscounts = discounts.filter(
        (discount) =>
          (!discount.classId || discount.classId === input.classId) &&
          (!discount.feePlanId || discount.feePlanId === input.feePlanId) &&
          (!discount.feeHeadId || discount.feeHeadId === item.feeHeadId),
      );
      let discountAmount = new Prisma.Decimal(0);

      for (const discount of matchingDiscounts) {
        if (discount.percentOff) {
          discountAmount = discountAmount.add(
            item.amount.mul(discount.percentOff).div(100),
          );
        }

        if (discount.amountOff) {
          discountAmount = discountAmount.add(discount.amountOff);
        }
      }

      const cappedDiscount = discountAmount.gt(item.amount)
        ? item.amount
        : discountAmount;
      const discountedAmount = item.amount.sub(cappedDiscount);
      const lineVat = item.feeHead.vatApplicable
        ? discountedAmount.mul(0.13)
        : new Prisma.Decimal(0);

      subtotal = subtotal.add(discountedAmount);
      vatAmount = vatAmount.add(lineVat);

      return {
        tenantId: input.tenantId,
        feeHeadId: item.feeHeadId,
        description: cappedDiscount.gt(0)
          ? `${item.feeHead.name} after discount`
          : item.feeHead.name,
        quantity: 1,
        unitAmount: discountedAmount,
        vatAmount: lineVat,
        totalAmount: discountedAmount.add(lineVat),
      };
    });

    return {
      lines,
      subtotal,
      vatAmount,
      totalAmount: subtotal.add(vatAmount),
    };
  }
}

function resolveIncomeAccountCode(feeHeadCode: string) {
  switch (feeHeadCode) {
    case 'ADMISSION':
      return '4010';
    case 'EXAM':
      return '4020';
    case 'TRANSPORT':
      return '4030';
    case 'LIBFINE':
      return '4040';
    default:
      return '4000';
  }
}

function allocatePaymentAcrossLines(
  lines: Array<{
    id: string;
    totalAmount: Prisma.Decimal;
    feeHeadCode: string;
    description: string;
  }>,
  paymentAmount: Prisma.Decimal,
  invoiceTotal: Prisma.Decimal,
) {
  let remaining = paymentAmount;

  return lines.map((line, index) => {
    if (index === lines.length - 1) {
      return { ...line, totalAmount: remaining };
    }

    const proportional = line.totalAmount
      .mul(paymentAmount)
      .div(invoiceTotal)
      .toDecimalPlaces(2);

    remaining = remaining.sub(proportional);

    return { ...line, totalAmount: proportional };
  });
}

function getAgingBucket(daysOverdue: number) {
  if (daysOverdue <= 30) {
    return '1-30';
  }

  if (daysOverdue <= 60) {
    return '31-60';
  }

  if (daysOverdue <= 90) {
    return '61-90';
  }

  return '90+';
}

function buildSimpleReceiptPdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '72 770 Td',
    ...lines.flatMap((line, index) => [
      `(${escapePdfText(line)}) Tj`,
      index === 0 ? '/F1 11 Tf' : '',
      '0 -24 Td',
    ]),
    'ET',
  ]
    .filter(Boolean)
    .join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  const chunks = ['%PDF-1.4\n'];
  const offsets = [0];

  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(chunks.join('')));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(''));
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push('0000000000 65535 f \n');

  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(''), 'utf8');
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

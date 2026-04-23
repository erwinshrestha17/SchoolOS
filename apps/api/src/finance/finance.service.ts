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
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
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

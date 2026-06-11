import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceCompatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getReceiptReprintHistory(receiptId: string, actor: AuthContext) {
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        id: receiptId,
        tenantId: actor.tenantId,
      },
      select: {
        id: true,
        receiptNumber: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found in this tenant');
    }

    const history = await this.prisma.receiptReprintHistory.findMany({
      where: {
        tenantId: actor.tenantId,
        receiptId,
      },
      include: {
        reprintedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ reprintedAt: 'desc' }],
      take: 100,
    });

    await this.auditService.record({
      action: 'read_reprint_history',
      resource: 'receipt',
      resourceId: receipt.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        receiptNumber: receipt.receiptNumber,
        historyCount: history.length,
      },
    });

    return {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      items: history.map((item) => ({
        id: item.id,
        paymentId: item.paymentId,
        studentId: item.studentId,
        fileAssetId: item.fileAssetId,
        reprintedAt: item.reprintedAt,
        reason: item.reason,
        format: item.format,
        delivery: item.delivery,
        reprintedBy: item.reprintedBy
          ? {
              id: item.reprintedBy.id,
              email: item.reprintedBy.email,
            }
          : null,
      })),
    };
  }

  async verifyReceipt(receiptNumber: string, actor: AuthContext) {
    const normalizedReceiptNumber = receiptNumber.trim();

    if (!normalizedReceiptNumber) {
      throw new BadRequestException('Receipt number is required');
    }

    const receipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: actor.tenantId,
        receiptNumber: normalizedReceiptNumber,
      },
      include: {
        tenant: {
          select: {
            name: true,
            panNumber: true,
          },
        },
        payment: {
          include: {
            invoice: true,
            student: true,
            collectedBy: {
              select: {
                id: true,
                email: true,
              },
            },
            refunds: {
              orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found in this tenant');
    }

    const refundedAmount = receipt.payment.refunds.reduce(
      (sum, refund) => sum.add(refund.amount),
      new Prisma.Decimal(0),
    );
    const reversed = Boolean(receipt.payment.reversedAt);
    const status = reversed
      ? 'REVERSED'
      : refundedAmount.gte(receipt.payment.amount)
        ? 'REFUNDED'
        : refundedAmount.gt(0)
          ? 'PARTIALLY_REFUNDED'
          : 'VALID';
    const warnings = [
      reversed ? 'Payment has been reversed' : null,
      refundedAmount.gt(0)
        ? `Refunded amount: ${refundedAmount.toFixed(2)}`
        : null,
    ].filter((warning): warning is string => Boolean(warning));

    await this.auditService.record({
      action: 'verify_receipt',
      resource: 'receipt',
      resourceId: receipt.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        invoiceId: receipt.payment.invoiceId,
        studentId: receipt.payment.studentId,
        status,
      },
    });

    return {
      verified: true,
      status,
      warnings,
      receipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        issuedAt: receipt.issuedAt,
        fiscalYear: receipt.fiscalYear,
        schoolPan: receipt.schoolPan ?? receipt.tenant.panNumber ?? null,
      },
      school: {
        name: receipt.tenant.name,
        panNumber: receipt.tenant.panNumber,
      },
      student: {
        id: receipt.payment.student.id,
        studentSystemId: receipt.payment.student.studentSystemId,
        name: `${receipt.payment.student.firstNameEn} ${receipt.payment.student.lastNameEn}`.trim(),
      },
      invoice: {
        id: receipt.payment.invoice.id,
        invoiceNumber: receipt.payment.invoice.invoiceNumber,
        status: receipt.payment.invoice.status,
        totalAmount: Number(receipt.payment.invoice.totalAmount),
      },
      payment: {
        id: receipt.payment.id,
        method: receipt.payment.method,
        status: receipt.payment.status,
        amount: Number(receipt.payment.amount),
        refundedAmount: Number(refundedAmount),
        netAmount: Number(receipt.payment.amount.sub(refundedAmount)),
        paidAt: receipt.payment.paidAt,
        referenceNumber: receipt.payment.referenceNumber,
        reversedAt: receipt.payment.reversedAt,
        reversalReason: receipt.payment.reversalReason,
        collectedBy: receipt.payment.collectedBy
          ? {
              id: receipt.payment.collectedBy.id,
              email: receipt.payment.collectedBy.email,
            }
          : null,
      },
    };
  }

  async exportStudentFeeLedgerCsv(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: true,
        sectionRef: true,
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
      },
      include: {
        lines: {
          include: {
            feeHead: true,
          },
        },
        payments: {
          include: {
            receipt: true,
            refunds: true,
          },
          orderBy: [{ paidAt: 'asc' }],
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });

    const rows = [
      [
        'Student ID',
        'Student Name',
        'Class',
        'Section',
        'Invoice Number',
        'Due Date',
        'Fee Head',
        'Billed Amount',
        'Paid Amount',
        'Refunded Amount',
        'Balance',
        'Invoice Status',
        'Receipt Numbers',
      ],
    ];

    for (const invoice of invoices) {
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      const refundedAmount = invoice.payments.reduce(
        (sum, payment) =>
          sum.add(
            payment.refunds.reduce(
              (refundSum, refund) => refundSum.add(refund.amount),
              new Prisma.Decimal(0),
            ),
          ),
        new Prisma.Decimal(0),
      );
      const netPaidAmount = paidAmount.sub(refundedAmount);
      const balance = invoice.totalAmount.sub(netPaidAmount);
      const receiptNumbers = invoice.payments
        .map((payment) => payment.receipt?.receiptNumber)
        .filter((value): value is string => Boolean(value))
        .join(' | ');

      for (const line of invoice.lines) {
        rows.push([
          student.studentSystemId,
          `${student.firstNameEn} ${student.lastNameEn}`,
          student.class.name,
          student.sectionRef?.name ?? '',
          invoice.invoiceNumber,
          invoice.dueDate.toISOString().slice(0, 10),
          line.feeHead.name,
          line.totalAmount.toString(),
          netPaidAmount.toString(),
          refundedAmount.toString(),
          balance.toString(),
          invoice.status,
          receiptNumbers,
        ]);
      }
    }

    await this.auditService.record({
      action: 'export',
      resource: 'student_fee_ledger',
      resourceId: student.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        invoiceCount: invoices.length,
      },
    });

    return rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

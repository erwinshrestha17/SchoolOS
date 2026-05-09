import { Injectable, NotFoundException } from '@nestjs/common';
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
        reprintedAt: item.reprintedAt,
        reason: item.reason,
        reprintedBy: item.reprintedBy
          ? {
              id: item.reprintedBy.id,
              email: item.reprintedBy.email,
            }
          : null,
      })),
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

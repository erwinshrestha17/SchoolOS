import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AudienceType,
  ConsentType,
  InvoiceStatus,
  JournalLineSide,
  JournalSourceType,
  NotificationChannel,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { CreateFeeDueScheduleDto } from './dto/create-fee-due-schedule.dto';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { CreateFeeWaiverDto } from './dto/create-fee-waiver.dto';
import {
  CreateInvoiceAdjustmentDto,
  InvoiceAdjustmentDirection,
} from './dto/create-invoice-adjustment.dto';
import { GenerateBillingRunDto } from './dto/generate-billing-run.dto';
import { ProcessFeeDueScheduleDto } from './dto/process-fee-due-schedule.dto';
import { SendDefaulterRemindersDto } from './dto/send-defaulter-reminders.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { resolveCashAccountCode } from './finance.defaults';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
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
            fiscalYear: resolveFiscalYear(new Date(dto.dueDate)),
            billNumber: invoiceNumber,
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

  async listDueSchedules(actor: AuthContext) {
    return this.prisma.feeDueSchedule.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        academicYear: true,
        feePlan: true,
      },
      orderBy: [{ dueDate: 'asc' }],
    });
  }

  async createDueSchedule(dto: CreateFeeDueScheduleDto, actor: AuthContext) {
    const [academicYear, feePlan] = await Promise.all([
      this.prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, tenantId: actor.tenantId },
      }),
      dto.feePlanId
        ? this.prisma.feePlan.findFirst({
            where: { id: dto.feePlanId, tenantId: actor.tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!academicYear) {
      throw new NotFoundException('Academic year not found in this tenant');
    }

    if (dto.feePlanId && !feePlan) {
      throw new NotFoundException('Fee plan not found in this tenant');
    }

    const schedule = await this.prisma.feeDueSchedule.create({
      data: {
        tenantId: actor.tenantId,
        academicYearId: dto.academicYearId,
        feePlanId: dto.feePlanId ?? null,
        name: dto.name,
        scheduleType: dto.scheduleType,
        runMonth: dto.runMonth ?? null,
        runYear: dto.runYear ?? null,
        dueDate: new Date(dto.dueDate),
        reminderDays: dto.reminderDays ?? [7, 1, 0],
        stopOnPaid: dto.stopOnPaid ?? true,
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fee_due_schedule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: schedule.id,
      after: {
        academicYearId: schedule.academicYearId,
        feePlanId: schedule.feePlanId,
        dueDate: schedule.dueDate,
      },
    });

    return schedule;
  }

  async processDueSchedule(
    scheduleId: string,
    dto: ProcessFeeDueScheduleDto,
    actor: AuthContext,
  ) {
    const schedule = await this.prisma.feeDueSchedule.findFirst({
      where: {
        id: scheduleId,
        tenantId: actor.tenantId,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Fee due schedule not found in this tenant');
    }

    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: schedule.academicYearId,
        ...(schedule.feePlanId
          ? {
              lines: {
                some: {
                  feeHead: {
                    feePlanItems: {
                      some: { feePlanId: schedule.feePlanId },
                    },
                  },
                },
              },
            }
          : {}),
        dueDate: { lte: schedule.dueDate },
        status: schedule.stopOnPaid
          ? { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] }
          : undefined,
      },
      include: {
        payments: true,
      },
    });
    const dueInvoiceIds = invoices
      .filter((invoice) => {
        const paidAmount = invoice.payments.reduce(
          (sum, payment) => sum.add(payment.amount),
          new Prisma.Decimal(0),
        );

        return invoice.totalAmount.sub(paidAmount).gt(0);
      })
      .map((invoice) => invoice.id);
    const reminderResult =
      dueInvoiceIds.length === 0
        ? { reminded: 0, deliveryResults: [] }
        : await this.sendDefaulterReminders(
            {
              invoiceIds: dueInvoiceIds,
              message: dto.message,
              channels: [
                NotificationChannel.PUSH,
                NotificationChannel.SMS,
                NotificationChannel.EMAIL,
              ],
            },
            actor,
          );

    await this.prisma.feeDueSchedule.update({
      where: { id: schedule.id },
      data: { lastProcessedAt: today },
    });

    await this.auditService.record({
      action: 'process',
      resource: 'fee_due_schedule',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: schedule.id,
      after: {
        dueInvoiceCount: dueInvoiceIds.length,
        reminded: reminderResult.reminded,
      },
    });

    return {
      scheduleId: schedule.id,
      dueInvoiceCount: dueInvoiceIds.length,
      reminderResult,
    };
  }

  async getCollectionReport(actor: AuthContext) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        payments: true,
        lines: {
          include: {
            feeHead: true,
          },
        },
        student: {
          include: {
            class: true,
          },
        },
      },
    });
    const payments = await this.prisma.payment.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ paidAt: 'asc' }],
    });
    const totalBilled = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount),
      0,
    );
    const totalCollected = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalWaived = (
      await this.prisma.feeWaiver.aggregate({
        where: { tenantId: actor.tenantId, status: 'APPROVED' },
        _sum: { amount: true },
      })
    )._sum.amount;
    const classWise = groupByAmount(
      invoices,
      (invoice) => invoice.student.class.name,
    );
    const feeHeadWise = new Map<string, number>();

    for (const invoice of invoices) {
      for (const line of invoice.lines) {
        feeHeadWise.set(
          line.feeHead.name,
          (feeHeadWise.get(line.feeHead.name) ?? 0) + Number(line.totalAmount),
        );
      }
    }

    return {
      totalBilled,
      totalCollected,
      totalOutstanding: Math.max(0, totalBilled - totalCollected),
      totalWaived: Number(totalWaived ?? 0),
      collectionTrend: groupPaymentsByMonth(payments),
      classWiseBreakdown: Array.from(classWise.entries()).map(
        ([className, amount]) => ({ className, amount }),
      ),
      feeHeadWiseBreakdown: Array.from(feeHeadWise.entries()).map(
        ([feeHeadName, amount]) => ({ feeHeadName, amount }),
      ),
    };
  }

  async recalculateAutomaticDiscounts(actor: AuthContext) {
    const [siblingRule, staffChildRule] = await Promise.all([
      this.prisma.discountRule.findFirst({
        where: {
          tenantId: actor.tenantId,
          type: 'SIBLING',
          isActive: true,
        },
      }),
      this.prisma.discountRule.findFirst({
        where: {
          tenantId: actor.tenantId,
          type: 'STAFF_CHILD',
          isActive: true,
        },
      }),
    ]);
    const siblingGroups = siblingRule
      ? await this.prisma.siblingGroup.findMany({
          where: { tenantId: actor.tenantId },
          include: { members: true },
        })
      : [];
    const affectedSiblingStudents = siblingGroups
      .filter((group) => group.members.length > 1)
      .flatMap((group) =>
        group.members.slice(1).map((member) => member.studentId),
      );

    await this.auditService.record({
      action: 'recalculate',
      resource: 'automatic_discounts',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        siblingRuleId: siblingRule?.id ?? null,
        staffChildRuleId: staffChildRule?.id ?? null,
        affectedSiblingStudents,
      },
    });

    return {
      siblingRuleActive: Boolean(siblingRule),
      staffChildRuleActive: Boolean(staffChildRule),
      affectedSiblingStudents,
      note: 'Automatic discounts are applied during invoice generation; this endpoint reports current recalculation scope.',
    };
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

  async voidInvoice(
    invoiceId: string,
    dto: VoidInvoiceDto,
    actor: AuthContext,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: actor.tenantId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new ConflictException('Invoice is already void');
    }

    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );

    if (paidAmount.gt(0)) {
      throw new ConflictException(
        'Paid invoices must be refunded or reversed before voiding',
      );
    }

    const voided = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.VOID,
        reportCardBlocked: false,
        hallTicketBlocked: false,
      },
    });

    await this.auditService.record({
      action: 'void',
      resource: 'invoice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: invoice.id,
      before: {
        status: invoice.status,
        totalAmount: Number(invoice.totalAmount),
      },
      after: {
        status: voided.status,
        reason: dto.reason,
        approvedBy: dto.approvedBy ?? actor.userId,
      },
    });

    return voided;
  }

  async createInvoiceAdjustment(
    invoiceId: string,
    dto: CreateInvoiceAdjustmentDto,
    actor: AuthContext,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: actor.tenantId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new ConflictException('Void invoices cannot be adjusted');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        'Paid invoices require a refund or reversal workflow before adjustment',
      );
    }

    const feeHead = await this.prisma.feeHead.findFirst({
      where: { id: dto.feeHeadId, tenantId: actor.tenantId },
    });

    if (!feeHead) {
      throw new NotFoundException('Fee head not found in this tenant');
    }

    const paidAmount = invoice.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const adjustmentAmount = new Prisma.Decimal(dto.amount);
    const adjustmentVat = new Prisma.Decimal(dto.vatAmount ?? 0);
    const signedSubtotal =
      dto.direction === InvoiceAdjustmentDirection.INCREASE
        ? adjustmentAmount
        : adjustmentAmount.mul(-1);
    const signedVat =
      dto.direction === InvoiceAdjustmentDirection.INCREASE
        ? adjustmentVat
        : adjustmentVat.mul(-1);
    const newSubtotal = invoice.subtotal.add(signedSubtotal);
    const newVatAmount = invoice.vatAmount.add(signedVat);
    const newTotal = invoice.totalAmount.add(signedSubtotal).add(signedVat);

    if (newSubtotal.lt(0) || newVatAmount.lt(0) || newTotal.lt(0)) {
      throw new ConflictException(
        'Adjustment cannot make invoice totals negative',
      );
    }

    if (paidAmount.gt(newTotal)) {
      throw new ConflictException(
        'Adjustment would make paid amount exceed invoice total',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLine.create({
        data: {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
          feeHeadId: feeHead.id,
          description: `Adjustment: ${dto.reason}`,
          quantity: 1,
          unitAmount: signedSubtotal,
          vatAmount: signedVat,
          totalAmount: signedSubtotal.add(signedVat),
        },
      });

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: newSubtotal,
          vatAmount: newVatAmount,
          totalAmount: newTotal,
          status: resolveInvoiceStatusAfterAdjustment(
            invoice.status,
            paidAmount,
            newTotal,
          ),
          paidAt:
            paidAmount.gte(newTotal) && newTotal.gt(0) ? new Date() : null,
        },
        include: {
          lines: true,
          payments: true,
        },
      });

      return { line, invoice: updated };
    });

    await this.auditService.record({
      action: 'adjust',
      resource: 'invoice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: invoice.id,
      before: {
        subtotal: Number(invoice.subtotal),
        vatAmount: Number(invoice.vatAmount),
        totalAmount: Number(invoice.totalAmount),
        status: invoice.status,
      },
      after: {
        adjustmentLineId: result.line.id,
        direction: dto.direction,
        amount: dto.amount,
        vatAmount: dto.vatAmount ?? 0,
        reason: dto.reason,
        subtotal: Number(result.invoice.subtotal),
        totalAmount: Number(result.invoice.totalAmount),
        status: result.invoice.status,
      },
    });

    return result;
  }

  async listDefaulters(
    actor: AuthContext,
    filters: { classId?: string; feeHeadId?: string } = {},
  ) {
    const today = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        dueDate: { lt: today },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        ...(filters.classId
          ? {
              student: {
                classId: filters.classId,
              },
            }
          : {}),
        ...(filters.feeHeadId
          ? {
              lines: {
                some: {
                  feeHeadId: filters.feeHeadId,
                },
              },
            }
          : {}),
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
        reportCardBlocked: invoice.reportCardBlocked || outstanding > 0,
        hallTicketBlocked: invoice.hallTicketBlocked || outstanding > 0,
      };
    });
  }

  async sendDefaulterReminders(
    dto: SendDefaulterRemindersDto,
    actor: AuthContext,
  ) {
    const defaulters = await this.listDefaulters(actor, {
      classId: dto.classId,
      feeHeadId: dto.feeHeadId,
    });
    const selectedDefaulters = dto.invoiceIds?.length
      ? defaulters.filter((defaulter) =>
          dto.invoiceIds?.includes(defaulter.invoiceId),
        )
      : defaulters;
    const channels = dto.channels?.length
      ? dto.channels
      : [
          NotificationChannel.PUSH,
          NotificationChannel.SMS,
          NotificationChannel.EMAIL,
        ];
    const deliveryResults: Array<{ invoiceId: string; deliveryCount: number }> =
      [];

    for (const defaulter of selectedDefaulters) {
      const delivery = await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'fee_defaulter_reminder',
        sourceId: defaulter.invoiceId,
        audienceType: AudienceType.ALL,
        studentIds: [defaulter.studentId],
        title: 'Fee payment reminder',
        body:
          dto.message ??
          `Outstanding fee balance Rs ${defaulter.outstanding.toFixed(
            2,
          )} is overdue for invoice ${defaulter.invoiceNumber}.`,
        channels,
        requiredConsentTypes: [ConsentType.MESSAGING],
      });

      deliveryResults.push({
        invoiceId: defaulter.invoiceId,
        deliveryCount: delivery.count,
      });
    }

    if (selectedDefaulters.length > 0) {
      await this.prisma.invoice.updateMany({
        where: {
          tenantId: actor.tenantId,
          id: {
            in: selectedDefaulters.map((defaulter) => defaulter.invoiceId),
          },
        },
        data: {
          reportCardBlocked: true,
          hallTicketBlocked: true,
        },
      });
    }

    await this.auditService.record({
      action: 'send',
      resource: 'fee_defaulter_reminders',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        invoiceIds: selectedDefaulters.map((defaulter) => defaulter.invoiceId),
        channels,
      },
    });

    return {
      requested: dto.invoiceIds?.length ?? defaulters.length,
      reminded: selectedDefaulters.length,
      channels,
      deliveryResults,
    };
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
        fiscalYear: resolveFiscalYear(input.dueDate),
        billNumber: invoiceNumber,
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
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
    });
    const receiptVat = invoice.totalAmount.gt(0)
      ? invoice.vatAmount.mul(paymentAmount).div(invoice.totalAmount)
      : new Prisma.Decimal(0);

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
          isAdvance: dto.isAdvance ?? false,
          recognizedAt: dto.recognizedAt ? new Date(dto.recognizedAt) : null,
          metadata: {
            remainingBeforePayment: Number(remaining),
          },
          paidAt: new Date(),
          narration: dto.narration ?? null,
          receipt: {
            create: {
              tenantId: actor.tenantId,
              receiptNumber,
              fiscalYear: resolveFiscalYear(new Date()),
              schoolPan: tenant.panNumber,
              vatAmount: receiptVat,
              metadata: {
                nonReusable: true,
                invoiceFiscalYear: invoice.fiscalYear,
                billNumber: invoice.billNumber ?? invoice.invoiceNumber,
              },
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
      receiptPdfUrl: result.receipt?.pdfUrl ?? null,
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

    return buildSimplePdf([
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

function resolveFiscalYear(date: Date) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  return month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

function groupPaymentsByMonth(
  payments: Array<{ paidAt: Date; amount: Prisma.Decimal }>,
) {
  const grouped = new Map<string, number>();

  for (const payment of payments) {
    const key = payment.paidAt.toISOString().slice(0, 7);
    grouped.set(key, (grouped.get(key) ?? 0) + Number(payment.amount));
  }

  return Array.from(grouped.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));
}

export function resolveInvoiceStatusAfterAdjustment(
  currentStatus: InvoiceStatus,
  paidAmount: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
) {
  if (currentStatus === InvoiceStatus.DRAFT) {
    return InvoiceStatus.DRAFT;
  }

  if (totalAmount.lte(0)) {
    return InvoiceStatus.PAID;
  }

  if (paidAmount.gte(totalAmount)) {
    return InvoiceStatus.PAID;
  }

  if (paidAmount.gt(0)) {
    return InvoiceStatus.PARTIAL;
  }

  return InvoiceStatus.ISSUED;
}

function groupByAmount<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, number>();

  for (const item of items) {
    const amount = Number(
      (item as { totalAmount: Prisma.Decimal }).totalAmount,
    );
    const key = getKey(item);
    grouped.set(key, (grouped.get(key) ?? 0) + amount);
  }

  return grouped;
}

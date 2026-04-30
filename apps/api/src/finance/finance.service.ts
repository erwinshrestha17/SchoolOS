import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AccountingPeriodStatus,
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
import {
  ReconciliationExportFormat,
  ReconciliationQueryDto,
} from '../accounting/dto/reconciliation-query.dto';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CashierCloseWindowDto } from './dto/cashier-close-window.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { CreateCashierCloseDto } from './dto/create-cashier-close.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { CreateFeeDueScheduleDto } from './dto/create-fee-due-schedule.dto';
import { CreateFeeHeadDto } from './dto/create-fee-head.dto';
import { CreateFeePlanDto } from './dto/create-fee-plan.dto';
import { CreatePaymentRefundDto } from './dto/create-payment-refund.dto';
import { CreateFeeWaiverDto } from './dto/create-fee-waiver.dto';
import {
  CreateInvoiceAdjustmentDto,
  InvoiceAdjustmentDirection,
} from './dto/create-invoice-adjustment.dto';
import { GenerateBillingRunDto } from './dto/generate-billing-run.dto';
import { ProcessFeeDueScheduleDto } from './dto/process-fee-due-schedule.dto';
import { SendDefaulterRemindersDto } from './dto/send-defaulter-reminders.dto';
import { ListCashierClosesDto } from './dto/list-cashier-closes.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { resolveCashAccountCode } from './finance.defaults';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly eventEmitter: EventEmitter2,
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

    const dueDate = new Date(dto.dueDate);
    const fiscalYear = resolveFiscalYear(dueDate);
    const result = await this.prisma.$transaction(async (tx) => {
      const run = await tx.feeBillingRun.create({
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
        const invoiceNumber = await this.generateInvoiceNumber(
          actor.tenantId,
          fiscalYear,
          tx,
        );
        const calculated = await this.calculateInvoiceLines(
          {
            tenantId: actor.tenantId,
            classId: assignment.student.classId,
            feePlanId: assignment.feePlanId,
            items: assignment.feePlan.items,
          },
          tx,
        );

        invoices.push(
          await tx.invoice.create({
            data: {
              tenantId: actor.tenantId,
              studentId: assignment.studentId,
              academicYearId: dto.academicYearId,
              billingRunId: run.id,
              invoiceNumber,
              fiscalYear,
              billNumber: invoiceNumber,
              dueDate,
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

      return { run, invoices };
    });

    await this.auditService.record({
      action: 'generate',
      resource: 'fee_billing_run',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.run.id,
      after: {
        academicYearId: dto.academicYearId,
        feePlanId: dto.feePlanId ?? null,
        invoiceCount: result.invoices.length,
      },
    });

    return {
      ...result.run,
      invoices: result.invoices,
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
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Discount reason is required');
    }

    await this.ensureDiscountReferencesBelongToTenant(dto, actor.tenantId);

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
        reason: dto.reason,
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
          include: { payments: { include: { refunds: true } } },
        })
      : null;

    if (dto.invoiceId && !invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    if (dto.invoiceId && invoice?.studentId !== student.id) {
      throw new ConflictException(
        'Invoice does not belong to the selected student',
      );
    }

    if (dto.feeHeadId) {
      const feeHead = await this.prisma.feeHead.findFirst({
        where: { id: dto.feeHeadId, tenantId: actor.tenantId },
      });

      if (!feeHead) {
        throw new NotFoundException('Fee head not found in this tenant');
      }

      if (
        invoice &&
        !(await this.invoiceContainsFeeHead(invoice.id, dto.feeHeadId))
      ) {
        throw new ConflictException(
          'Fee head is not present on the selected invoice',
        );
      }
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
        const paidAmount = sumNetPaidAmount(invoice.payments);
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
        payments: {
          include: { refunds: true },
        },
      },
    });
    const dueInvoiceIds = invoices
      .filter((invoice) => {
        const paidAmount = sumNetPaidAmount(invoice.payments);

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
        payments: {
          include: { refunds: true },
        },
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
      include: { refunds: true },
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
    const totalRefunded = payments.reduce(
      (sum, payment) => sum + Number(sumRefundedAmount(payment.refunds)),
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
      totalRefunded,
      netCollected: totalCollected - totalRefunded,
      totalOutstanding: Math.max(
        0,
        totalBilled -
          Number(totalWaived ?? 0) -
          (totalCollected - totalRefunded),
      ),
      totalWaived: Number(totalWaived ?? 0),
      collectionTrend: groupPaymentsByMonth(payments),
      refundTrend: groupRefundsByMonth(payments),
      netCollectionTrend: groupNetCollectionsByMonth(payments),
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
        payments: {
          include: { refunds: true },
        },
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
      paidAmount: Number(sumNetPaidAmount(invoice.payments)),
    }));
  }

  async getInvoiceDetail(invoiceId: string, actor: AuthContext) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: actor.tenantId,
      },
      include: {
        academicYear: true,
        billingRun: true,
        lines: {
          include: {
            feeHead: true,
          },
          orderBy: [{ createdAt: 'asc' }],
        },
        payments: {
          include: {
            collectedBy: true,
            receipt: true,
            refunds: {
              orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
            },
          },
          orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
        },
        student: {
          include: {
            class: true,
            sectionRef: true,
            guardianLinks: {
              include: {
                guardian: true,
              },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    const [waivers, journalEntries] = await Promise.all([
      this.prisma.feeWaiver.findMany({
        where: {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
        },
        include: {
          approvedBy: true,
          feeHead: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      invoice.payments.length === 0
        ? Promise.resolve([])
        : this.prisma.journalEntry.findMany({
            where: {
              tenantId: actor.tenantId,
              sourceType: JournalSourceType.FEE_PAYMENT,
              sourceId: {
                in: invoice.payments.map((payment) => payment.id),
              },
            },
            orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
          }),
    ]);
    const paymentEntryBySourceId = new Map<string, string>(
      journalEntries.flatMap((entry) =>
        entry.sourceId ? ([[entry.sourceId, entry.entryNumber]] as const) : [],
      ),
    );
    const paidAmount = sumNetPaidAmount(invoice.payments);
    const outstandingAmount = invoice.totalAmount.sub(paidAmount);
    const primaryGuardian =
      invoice.student.guardianLinks.find((link) => link.isPrimary) ??
      invoice.student.guardianLinks[0];

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      fiscalYear: invoice.fiscalYear,
      billNumber: invoice.billNumber,
      status: invoice.status,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      reportCardBlocked: invoice.reportCardBlocked,
      hallTicketBlocked: invoice.hallTicketBlocked,
      academicYear: {
        id: invoice.academicYear.id,
        name: invoice.academicYear.name,
      },
      billingRun: invoice.billingRun
        ? {
            id: invoice.billingRun.id,
            runMonth: invoice.billingRun.runMonth,
            runYear: invoice.billingRun.runYear,
          }
        : null,
      student: {
        id: invoice.student.id,
        studentSystemId: invoice.student.studentSystemId,
        name: formatStudentName(invoice.student),
        className: invoice.student.class.name,
        sectionName: invoice.student.sectionRef?.name ?? null,
        guardianName: primaryGuardian?.guardian.fullName ?? null,
        guardianPhone: primaryGuardian?.guardian.primaryPhone ?? null,
      },
      subtotal: Number(invoice.subtotal),
      vatAmount: Number(invoice.vatAmount),
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(paidAmount),
      outstandingAmount: Math.max(0, Number(outstandingAmount)),
      totalWaivedAmount: waivers.reduce(
        (sum, waiver) => sum + Number(waiver.amount),
        0,
      ),
      lines: invoice.lines.map((line) => {
        const baseAmount = line.unitAmount.mul(line.quantity);
        const matchingWaiverAmount = waivers
          .filter((waiver) => waiver.feeHeadId === line.feeHeadId)
          .reduce(
            (sum, waiver) => sum.add(waiver.amount),
            new Prisma.Decimal(0),
          );

        return {
          id: line.id,
          feeHeadId: line.feeHeadId,
          feeHeadCode: line.feeHead.code,
          feeHeadName: line.feeHead.name,
          description: line.description,
          periodLabel: invoice.billingRun
            ? `${invoice.billingRun.runYear}-${String(invoice.billingRun.runMonth).padStart(2, '0')}`
            : invoice.academicYear.name,
          quantity: line.quantity,
          unitAmount: Number(line.unitAmount),
          baseAmount: Number(baseAmount),
          discountAmount: 0,
          waiverAmount: Number(matchingWaiverAmount),
          lateFeeAmount: 0,
          vatAmount: Number(line.vatAmount),
          totalAmount: Number(line.totalAmount),
          netAmount: Number(line.totalAmount.sub(matchingWaiverAmount)),
        };
      }),
      waivers: waivers.map((waiver) => ({
        id: waiver.id,
        feeHeadId: waiver.feeHeadId,
        feeHeadName: waiver.feeHead?.name ?? null,
        amount: Number(waiver.amount),
        reason: waiver.reason,
        status: waiver.status,
        approvedAt: waiver.approvedAt,
        approvedBy: waiver.approvedBy
          ? {
              id: waiver.approvedBy.id,
              email: waiver.approvedBy.email,
            }
          : null,
      })),
      payments: invoice.payments.map((payment) => {
        const refundedAmount = sumRefundedAmount(payment.refunds);

        return {
          id: payment.id,
          amount: Number(payment.amount),
          refundedAmount: Number(refundedAmount),
          netAmount: Number(payment.amount.sub(refundedAmount)),
          method: payment.method,
          referenceNumber: payment.referenceNumber,
          paidAt: payment.paidAt,
          narration: payment.narration,
          collector: payment.collectedBy
            ? {
                id: payment.collectedBy.id,
                email: payment.collectedBy.email,
              }
            : null,
          receipt: payment.receipt
            ? {
                id: payment.receipt.id,
                receiptNumber: payment.receipt.receiptNumber,
                issuedAt: payment.receipt.issuedAt,
                pdfUrl: payment.receipt.pdfUrl,
              }
            : null,
          refunds: payment.refunds.map((refund) => ({
            id: refund.id,
            refundNumber: refund.refundNumber,
            amount: Number(refund.amount),
            refundDate: refund.refundDate,
            reason: refund.reason,
            referenceNumber: refund.referenceNumber,
          })),
          journalEntryNumber: paymentEntryBySourceId.get(payment.id) ?? null,
        };
      }),
      source: {
        billingRunId: invoice.billingRunId,
        enrollmentId: invoice.enrollmentId,
      },
    };
  }

  async getStudentFeeLedger(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: {
            guardian: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }

    const [invoices, waivers] = await Promise.all([
      this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: student.id,
        },
        include: {
          payments: {
            include: {
              receipt: true,
              refunds: {
                orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
              },
            },
            orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
          },
          lines: {
            include: {
              feeHead: true,
            },
          },
        },
        orderBy: [{ issuedAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.feeWaiver.findMany({
        where: {
          tenantId: actor.tenantId,
          studentId: student.id,
        },
        include: {
          feeHead: true,
          approvedBy: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
    ]);

    const ledgerEvents: Array<{
      id: string;
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'WAIVER' | 'REFUND';
      reference: string;
      description: string;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
      affectsBalance: boolean;
      invoiceId?: string;
      invoiceNumber?: string;
      paymentId?: string;
      receiptNumber?: string | null;
      status?: string;
    }> = [];

    for (const invoice of invoices) {
      ledgerEvents.push({
        id: `invoice:${invoice.id}`,
        date: invoice.issuedAt,
        type: 'INVOICE',
        reference: invoice.invoiceNumber,
        description: `Invoice ${invoice.invoiceNumber}`,
        debit: invoice.totalAmount,
        credit: new Prisma.Decimal(0),
        affectsBalance: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
      });

      for (const payment of invoice.payments) {
        ledgerEvents.push({
          id: `payment:${payment.id}`,
          date: payment.paidAt,
          type: 'PAYMENT',
          reference: payment.receipt?.receiptNumber ?? payment.id,
          description: `${payment.method} payment for ${invoice.invoiceNumber}`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          affectsBalance: true,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          receiptNumber: payment.receipt?.receiptNumber ?? null,
        });

        for (const refund of payment.refunds) {
          ledgerEvents.push({
            id: `refund:${refund.id}`,
            date: refund.refundDate,
            type: 'REFUND',
            reference: refund.refundNumber,
            description: `Refund for ${payment.receipt?.receiptNumber ?? invoice.invoiceNumber}`,
            debit: refund.amount,
            credit: new Prisma.Decimal(0),
            affectsBalance: true,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentId: payment.id,
            receiptNumber: payment.receipt?.receiptNumber ?? null,
          });
        }
      }
    }

    for (const waiver of waivers) {
      ledgerEvents.push({
        id: `waiver:${waiver.id}`,
        date: waiver.approvedAt ?? waiver.createdAt,
        type: 'WAIVER',
        reference: waiver.feeHead?.name ?? waiver.invoiceId ?? 'Waiver',
        description: `${waiver.reason} (already reflected in invoice totals when invoice-linked)`,
        debit: new Prisma.Decimal(0),
        credit: waiver.amount,
        affectsBalance: false,
        invoiceId: waiver.invoiceId ?? undefined,
        status: waiver.status,
      });
    }

    ledgerEvents.sort((left, right) => {
      const byDate = left.date.getTime() - right.date.getTime();

      if (byDate !== 0) {
        return byDate;
      }

      return ledgerEventOrder(left.type) - ledgerEventOrder(right.type);
    });

    let runningBalance = new Prisma.Decimal(0);
    const rows = ledgerEvents.map((event) => {
      if (event.affectsBalance) {
        runningBalance = runningBalance.add(event.debit).sub(event.credit);
      }

      return {
        id: event.id,
        date: event.date,
        type: event.type,
        reference: event.reference,
        description: event.description,
        debit: Number(event.debit),
        credit: Number(event.credit),
        runningBalance: Number(runningBalance),
        affectsBalance: event.affectsBalance,
        invoiceId: event.invoiceId ?? null,
        invoiceNumber: event.invoiceNumber ?? null,
        paymentId: event.paymentId ?? null,
        receiptNumber: event.receiptNumber ?? null,
        status: event.status ?? null,
      };
    });
    const totalInvoiced = invoices.reduce(
      (sum, invoice) => sum.add(invoice.totalAmount),
      new Prisma.Decimal(0),
    );
    const allPayments = invoices.flatMap((invoice) => invoice.payments);
    const totalPaid = allPayments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const totalRefunded = allPayments.reduce(
      (sum, payment) => sum.add(sumRefundedAmount(payment.refunds)),
      new Prisma.Decimal(0),
    );
    const totalWaived = waivers.reduce(
      (sum, waiver) => sum.add(waiver.amount),
      new Prisma.Decimal(0),
    );
    const outstandingBalance = totalInvoiced.sub(totalPaid).add(totalRefunded);
    const primaryGuardian =
      student.guardianLinks.find((link) => link.isPrimary) ??
      student.guardianLinks[0];

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        name: formatStudentName(student),
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? null,
        guardianName: primaryGuardian?.guardian.fullName ?? null,
        guardianPhone: primaryGuardian?.guardian.primaryPhone ?? null,
      },
      openingBalance: 0,
      totalInvoiced: Number(totalInvoiced),
      totalPaid: Number(totalPaid),
      totalWaived: Number(totalWaived),
      totalRefunded: Number(totalRefunded),
      outstandingBalance: Math.max(0, Number(outstandingBalance)),
      rows,
    };
  }

  async voidInvoice(
    invoiceId: string,
    dto: VoidInvoiceDto,
    actor: AuthContext,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: actor.tenantId },
      include: { payments: { include: { refunds: true } } },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    if (invoice.status === InvoiceStatus.VOID) {
      throw new ConflictException('Invoice is already void');
    }

    const paidAmount = sumNetPaidAmount(invoice.payments);

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
      include: { payments: { include: { refunds: true } } },
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

    const paidAmount = sumNetPaidAmount(invoice.payments);
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
          payments: {
            include: { refunds: true },
          },
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
        payments: {
          include: { refunds: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }],
    });

    return invoices.map((invoice) => {
      const paidAmount = Number(sumNetPaidAmount(invoice.payments));
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

    const fiscalYear = resolveFiscalYear(input.dueDate);
    const invoiceNumber = await this.generateInvoiceNumber(
      input.actor.tenantId,
      fiscalYear,
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
        fiscalYear,
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
        payments: {
          include: { refunds: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    const paidSoFar = sumNetPaidAmount(invoice.payments);
    const paymentAmount = new Prisma.Decimal(dto.amount);
    const remaining = invoice.totalAmount.sub(paidSoFar);

    if (paymentAmount.gt(remaining)) {
      throw new ConflictException('Payment exceeds the remaining balance');
    }

    if (dto.referenceNumber) {
      const duplicatePayment = await this.prisma.payment.findFirst({
        where: {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
          method: dto.method,
          referenceNumber: dto.referenceNumber,
        },
      });

      if (duplicatePayment) {
        throw new ConflictException(
          'Payment reference was already recorded for this invoice',
        );
      }
    }

    const fiscalYear = resolveFiscalYear(new Date());
    const receiptNumber = await this.generateReceiptNumber(
      actor.tenantId,
      fiscalYear,
    );
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
              fiscalYear,
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

    this.eventEmitter.emit('fees.payment.confirmed', {
      tenantId: actor.tenantId,
      actor,
      paymentId: result.id,
      invoiceId: dto.invoiceId,
      studentId: invoice.studentId,
      amount: Number(result.amount),
      method: result.method,
      receiptNumber: result.receipt?.receiptNumber ?? null,
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

  async refundPayment(
    paymentId: string,
    dto: CreatePaymentRefundDto,
    actor: AuthContext,
  ) {
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException('Refund reason is required');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: {
        receipt: true,
        refunds: true,
        invoice: {
          include: {
            payments: {
              include: { refunds: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found in this tenant');
    }

    if (payment.invoice.status === InvoiceStatus.VOID) {
      throw new ConflictException('Voided invoices cannot be refunded');
    }

    const sourceJournal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceType: JournalSourceType.FEE_PAYMENT,
        sourceId: payment.id,
      },
      include: {
        lines: {
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!sourceJournal || sourceJournal.lines.length === 0) {
      throw new ConflictException(
        'Original payment journal entry was not found for this payment',
      );
    }

    const refundedSoFar = sumRefundedAmount(payment.refunds);
    const refundableAmount = payment.amount.sub(refundedSoFar);

    if (refundableAmount.lte(0)) {
      throw new ConflictException('Payment has already been fully refunded');
    }

    const refundAmount =
      dto.amount === undefined
        ? refundableAmount
        : new Prisma.Decimal(dto.amount);

    if (refundAmount.gt(refundableAmount)) {
      throw new ConflictException(
        'Refund exceeds the remaining refundable amount',
      );
    }

    const refundDate = dto.refundDate ? new Date(dto.refundDate) : new Date();
    await this.ensurePostingPeriodIsOpen(actor.tenantId, refundDate);

    const refundNumber = await this.generateRefundNumber(actor.tenantId);
    const journalEntryNumber = await this.generateJournalEntryNumber(
      actor.tenantId,
    );
    const reversedDebitLines = allocateJournalLinesForRefund(
      sourceJournal.lines.filter(
        (line) => line.side === JournalLineSide.CREDIT,
      ),
      refundAmount,
      payment.amount,
      JournalLineSide.DEBIT,
      actor.tenantId,
    );
    const reversedCreditLines = allocateJournalLinesForRefund(
      sourceJournal.lines.filter((line) => line.side === JournalLineSide.DEBIT),
      refundAmount,
      payment.amount,
      JournalLineSide.CREDIT,
      actor.tenantId,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.create({
        data: {
          tenantId: actor.tenantId,
          paymentId: payment.id,
          refundNumber,
          amount: refundAmount,
          refundDate,
          reason,
          referenceNumber: dto.referenceNumber?.trim() || null,
          narration: dto.narration?.trim() || null,
          createdById: actor.userId,
        },
      });

      const journalEntry = await tx.journalEntry.create({
        data: {
          tenantId: actor.tenantId,
          entryNumber: journalEntryNumber,
          entryDate: refundDate,
          narration:
            dto.narration?.trim() ||
            `Refund ${refundNumber} for payment ${payment.receipt?.receiptNumber ?? payment.id}`,
          sourceType: JournalSourceType.PAYMENT_REFUND,
          sourceId: refund.id,
          createdById: actor.userId,
          lines: {
            create: [...reversedDebitLines, ...reversedCreditLines],
          },
        },
      });

      const netPaidAmount = sumNetPaidAmount(
        payment.invoice.payments.map((invoicePayment) =>
          invoicePayment.id === payment.id
            ? {
                ...invoicePayment,
                refunds: [...invoicePayment.refunds, { amount: refundAmount }],
              }
            : invoicePayment,
        ),
      );
      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: resolveInvoiceStatusAfterAdjustment(
            payment.invoice.status,
            netPaidAmount,
            payment.invoice.totalAmount,
          ),
          paidAt:
            netPaidAmount.gte(payment.invoice.totalAmount) &&
            payment.invoice.totalAmount.gt(0)
              ? (payment.invoice.paidAt ?? refundDate)
              : null,
        },
      });

      return { refund, journalEntry, updatedInvoice };
    });

    await this.auditService.record({
      action: 'refund',
      resource: 'payment_refund',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.refund.id,
      before: {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        refundableAmount: Number(refundableAmount),
      },
      after: {
        refundNumber: result.refund.refundNumber,
        amount: Number(result.refund.amount),
        journalEntryNumber: result.journalEntry.entryNumber,
        invoiceStatus: result.updatedInvoice.status,
      },
    });

    return {
      refundId: result.refund.id,
      refundNumber: result.refund.refundNumber,
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      amount: Number(result.refund.amount),
      refundDate: result.refund.refundDate,
      journalEntryNumber: result.journalEntry.entryNumber,
      remainingRefundableAmount: Number(refundableAmount.sub(refundAmount)),
      invoiceStatus: result.updatedInvoice.status,
    };
  }

  async previewCashierClose(query: CashierCloseWindowDto, actor: AuthContext) {
    const window = resolveWindow(query.openedAt, query.closedAt);
    const summary = await this.buildCashierCloseSummary(
      {
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        collectorUserId: query.collectorUserId,
        paymentMethod: query.paymentMethod,
      },
      actor,
    );

    await this.auditService.record({
      action: 'preview',
      resource: 'cashier_close',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        collectorUserId: query.collectorUserId ?? null,
        paymentMethod: query.paymentMethod ?? null,
        grossCollected: summary.grossCollected,
        totalRefunded: summary.totalRefunded,
        netCollected: summary.netCollected,
      },
    });

    return summary;
  }

  async listCashierCloses(query: ListCashierClosesDto, actor: AuthContext) {
    const closes = await this.prisma.cashierClose.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(query.openedFrom
          ? { openedAt: { gte: new Date(query.openedFrom) } }
          : {}),
        ...(query.closedTo
          ? { closedAt: { lte: new Date(query.closedTo) } }
          : {}),
        ...(query.collectorUserId
          ? { collectorUserId: query.collectorUserId }
          : {}),
        ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      },
      include: {
        collectorUser: true,
        closedBy: true,
      },
      orderBy: [{ closedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return closes.map((close) => ({
      id: close.id,
      closeNumber: close.closeNumber,
      openedAt: close.openedAt,
      closedAt: close.closedAt,
      collectorUser: close.collectorUser
        ? {
            id: close.collectorUser.id,
            email: close.collectorUser.email,
          }
        : null,
      paymentMethod: close.paymentMethod,
      grossCollected: Number(close.grossCollected),
      totalRefunded: Number(close.totalRefunded),
      netCollected: Number(close.netCollected),
      paymentCount: close.paymentCount,
      refundCount: close.refundCount,
      firstReceiptNumber: close.firstReceiptNumber,
      lastReceiptNumber: close.lastReceiptNumber,
      notes: close.notes,
      closedBy: close.closedBy
        ? {
            id: close.closedBy.id,
            email: close.closedBy.email,
          }
        : null,
      createdAt: close.createdAt,
    }));
  }

  async finalizeCashierClose(dto: CreateCashierCloseDto, actor: AuthContext) {
    const window = resolveWindow(dto.openedAt, dto.closedAt);
    const existing = await this.prisma.cashierClose.findFirst({
      where: {
        tenantId: actor.tenantId,
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        collectorUserId: dto.collectorUserId ?? null,
        paymentMethod: dto.paymentMethod ?? null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Cashier close ${existing.closeNumber} already exists for the selected window`,
      );
    }

    const summary = await this.buildCashierCloseSummary(
      {
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        collectorUserId: dto.collectorUserId,
        paymentMethod: dto.paymentMethod,
      },
      actor,
    );
    const closeNumber = await this.generateCashierCloseNumber(actor.tenantId);

    const close = await this.prisma.cashierClose.create({
      data: {
        tenantId: actor.tenantId,
        closeNumber,
        openedAt: window.openedAt,
        closedAt: window.closedAt,
        collectorUserId: dto.collectorUserId ?? null,
        paymentMethod: dto.paymentMethod ?? null,
        grossCollected: new Prisma.Decimal(summary.grossCollected),
        totalRefunded: new Prisma.Decimal(summary.totalRefunded),
        netCollected: new Prisma.Decimal(summary.netCollected),
        paymentCount: summary.paymentCount,
        refundCount: summary.refundCount,
        firstReceiptNumber: summary.firstReceiptNumber,
        lastReceiptNumber: summary.lastReceiptNumber,
        notes: dto.notes ?? null,
        closedById: actor.userId,
      },
      include: {
        collectorUser: true,
        closedBy: true,
      },
    });

    await this.auditService.record({
      action: 'finalize',
      resource: 'cashier_close',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: close.id,
      after: {
        closeNumber: close.closeNumber,
        openedAt: close.openedAt,
        closedAt: close.closedAt,
        collectorUserId: close.collectorUserId,
        paymentMethod: close.paymentMethod,
        grossCollected: Number(close.grossCollected),
        totalRefunded: Number(close.totalRefunded),
        netCollected: Number(close.netCollected),
      },
    });

    return {
      id: close.id,
      closeNumber: close.closeNumber,
      openedAt: close.openedAt,
      closedAt: close.closedAt,
      grossCollected: Number(close.grossCollected),
      totalRefunded: Number(close.totalRefunded),
      netCollected: Number(close.netCollected),
      paymentCount: close.paymentCount,
      refundCount: close.refundCount,
      firstReceiptNumber: close.firstReceiptNumber,
      lastReceiptNumber: close.lastReceiptNumber,
      notes: close.notes,
      collectorUser: close.collectorUser
        ? {
            id: close.collectorUser.id,
            email: close.collectorUser.email,
          }
        : null,
      closedBy: close.closedBy
        ? {
            id: close.closedBy.id,
            email: close.closedBy.email,
          }
        : null,
    };
  }

  async getReconciliationSummary(
    query: ReconciliationQueryDto,
    actor: AuthContext,
  ) {
    const rows = await this.buildReconciliationRows(query, actor);

    return {
      openedAt: query.openedAt,
      closedAt: query.closedAt,
      totalRows: rows.length,
      grossCollected: rows.reduce((sum, row) => sum + row.grossAmount, 0),
      totalRefunded: rows.reduce((sum, row) => sum + row.refundedAmount, 0),
      netCollected: rows.reduce((sum, row) => sum + row.netAmount, 0),
      rows,
    };
  }

  async exportReconciliation(
    query: ReconciliationQueryDto,
    actor: AuthContext,
  ) {
    const rows = await this.buildReconciliationRows(query, actor);
    const payload = {
      generatedAt: new Date().toISOString(),
      openedAt: query.openedAt,
      closedAt: query.closedAt,
      totalRows: rows.length,
      rows,
    };

    if (query.format === ReconciliationExportFormat.JSON) {
      return payload;
    }

    return buildReconciliationCsv(payload.rows);
  }

  async listPayments(actor: AuthContext) {
    const payments = await this.prisma.payment.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        student: true,
        receipt: true,
        refunds: true,
      },
      orderBy: [{ paidAt: 'desc' }],
    });

    return payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      refundedAmount: Number(sumRefundedAmount(payment.refunds)),
      refundableAmount: Number(
        payment.amount.sub(sumRefundedAmount(payment.refunds)),
      ),
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
            refunds: true,
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
      refundedAmount: Number(sumRefundedAmount(receipt.payment.refunds)),
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
            refunds: true,
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

  private async buildCashierCloseSummary(
    input: {
      openedAt: Date;
      closedAt: Date;
      collectorUserId?: string;
      paymentMethod?: PaymentMethod;
    },
    actor: AuthContext,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: actor.tenantId,
        paidAt: {
          gte: input.openedAt,
          lte: input.closedAt,
        },
        invoice: {
          status: { not: InvoiceStatus.VOID },
        },
        ...(input.collectorUserId
          ? { collectedById: input.collectorUserId }
          : {}),
        ...(input.paymentMethod ? { method: input.paymentMethod } : {}),
      },
      include: {
        receipt: true,
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
    const refunds = await this.prisma.paymentRefund.findMany({
      where: {
        tenantId: actor.tenantId,
        refundDate: {
          gte: input.openedAt,
          lte: input.closedAt,
        },
        payment: {
          invoice: {
            status: { not: InvoiceStatus.VOID },
          },
          ...(input.collectorUserId
            ? { collectedById: input.collectorUserId }
            : {}),
          ...(input.paymentMethod ? { method: input.paymentMethod } : {}),
        },
      },
      include: {
        payment: {
          include: {
            receipt: true,
          },
        },
      },
      orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
    });
    const grossCollected = payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    );
    const totalRefunded = refunds.reduce(
      (sum, refund) => sum + Number(refund.amount),
      0,
    );

    return {
      openedAt: input.openedAt,
      closedAt: input.closedAt,
      collectorUserId: input.collectorUserId ?? null,
      paymentMethod: input.paymentMethod ?? null,
      grossCollected,
      totalRefunded,
      netCollected: grossCollected - totalRefunded,
      paymentCount: payments.length,
      refundCount: refunds.length,
      firstReceiptNumber: payments[0]?.receipt?.receiptNumber ?? null,
      lastReceiptNumber: payments.at(-1)?.receipt?.receiptNumber ?? null,
    };
  }

  private async buildReconciliationRows(
    query: ReconciliationQueryDto,
    actor: AuthContext,
  ) {
    const window = resolveWindow(query.openedAt, query.closedAt);
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: actor.tenantId,
        paidAt: {
          gte: window.openedAt,
          lte: window.closedAt,
        },
        invoice: {
          status: { not: InvoiceStatus.VOID },
          ...(query.studentId ? { studentId: query.studentId } : {}),
          ...(query.classId
            ? {
                student: {
                  classId: query.classId,
                },
              }
            : {}),
        },
        ...(query.collectorUserId
          ? { collectedById: query.collectorUserId }
          : {}),
        ...(query.paymentMethod ? { method: query.paymentMethod } : {}),
      },
      include: {
        receipt: true,
        collectedBy: true,
        student: {
          include: {
            class: true,
          },
        },
        invoice: true,
        refunds: {
          where: {
            refundDate: {
              gte: window.openedAt,
              lte: window.closedAt,
            },
          },
          orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
    const paymentEntryRecords = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        sourceType: JournalSourceType.FEE_PAYMENT,
        sourceId: {
          in: payments.map((payment) => payment.id),
        },
      },
      orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
    });
    const refundIds = payments.flatMap((payment) =>
      payment.refunds.map((refund) => refund.id),
    );
    const refundEntryRecords =
      refundIds.length === 0
        ? []
        : await this.prisma.journalEntry.findMany({
            where: {
              tenantId: actor.tenantId,
              sourceType: JournalSourceType.PAYMENT_REFUND,
              sourceId: {
                in: refundIds,
              },
            },
            orderBy: [{ entryDate: 'asc' }, { createdAt: 'asc' }],
          });
    const paymentEntryBySourceId = new Map(
      paymentEntryRecords.map((entry) => [entry.sourceId, entry.entryNumber]),
    );
    const refundEntriesBySourceId = new Map<string, string[]>();

    for (const entry of refundEntryRecords) {
      if (!entry.sourceId) {
        continue;
      }

      refundEntriesBySourceId.set(entry.sourceId, [
        ...(refundEntriesBySourceId.get(entry.sourceId) ?? []),
        entry.entryNumber,
      ]);
    }

    return payments.map((payment) => {
      const refundedAmount = Number(sumRefundedAmount(payment.refunds));
      const refundNumbers = payment.refunds.map(
        (refund) => refund.refundNumber,
      );
      const refundDates = payment.refunds.map((refund) =>
        refund.refundDate.toISOString(),
      );
      const refundJournalEntryNumbers = payment.refunds.flatMap(
        (refund) => refundEntriesBySourceId.get(refund.id) ?? [],
      );
      const statusMarkers =
        refundedAmount <= 0
          ? ['collected']
          : refundedAmount >= Number(payment.amount)
            ? ['fully_refunded']
            : ['partially_refunded'];

      return {
        paymentId: payment.id,
        paymentDate: payment.paidAt.toISOString(),
        refundDate: refundDates.at(-1) ?? null,
        receiptNumber: payment.receipt?.receiptNumber ?? null,
        refundNumber:
          refundNumbers.length > 0 ? refundNumbers.join(', ') : null,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoice.invoiceNumber,
        student: {
          id: payment.student.id,
          name: `${payment.student.firstNameEn} ${payment.student.lastNameEn}`.trim(),
          className: payment.student.class.name,
        },
        collector: payment.collectedBy
          ? {
              id: payment.collectedBy.id,
              email: payment.collectedBy.email,
            }
          : null,
        method: payment.method,
        grossAmount: Number(payment.amount),
        refundedAmount,
        netAmount: Number(payment.amount) - refundedAmount,
        journalEntryNumber: paymentEntryBySourceId.get(payment.id) ?? null,
        refundJournalEntryNumbers,
        statusMarkers,
      };
    });
  }

  private async generateInvoiceNumber(
    tenantId: string,
    fiscalYear = resolveFiscalYear(new Date()),
    client: Pick<Prisma.TransactionClient, 'invoice'> = this.prisma,
  ) {
    const count = await client.invoice.count({
      where: { tenantId, fiscalYear },
    });

    return `INV-${formatFiscalYearForNumber(fiscalYear)}-${String(
      count + 1,
    ).padStart(5, '0')}`;
  }

  private async generateReceiptNumber(
    tenantId: string,
    fiscalYear = resolveFiscalYear(new Date()),
    client: Pick<Prisma.TransactionClient, 'receipt'> = this.prisma,
  ) {
    const count = await client.receipt.count({
      where: { tenantId, fiscalYear },
    });

    return `REC-${formatFiscalYearForNumber(fiscalYear)}-${String(
      count + 1,
    ).padStart(5, '0')}`;
  }

  private async generateCashierCloseNumber(tenantId: string) {
    const count = await this.prisma.cashierClose.count({
      where: { tenantId },
    });

    return `CLS-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateRefundNumber(tenantId: string) {
    const count = await this.prisma.paymentRefund.count({
      where: { tenantId },
    });

    return `RFD-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateJournalEntryNumber(tenantId: string) {
    const count = await this.prisma.journalEntry.count({
      where: { tenantId },
    });

    return `JE-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async ensurePostingPeriodIsOpen(tenantId: string, entryDate: Date) {
    const closedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        tenantId,
        status: AccountingPeriodStatus.CLOSED,
        startsOn: { lte: entryDate },
        endsOn: { gte: entryDate },
      },
    });

    if (closedPeriod) {
      throw new ConflictException(
        `Cannot post refund to closed accounting period "${closedPeriod.name}"`,
      );
    }
  }

  private async calculateInvoiceLines(
    input: {
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
    },
    client: Pick<Prisma.TransactionClient, 'discountRule'> = this.prisma,
  ) {
    const discounts = await client.discountRule.findMany({
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

  private async ensureDiscountReferencesBelongToTenant(
    dto: CreateDiscountRuleDto,
    tenantId: string,
  ) {
    if (!dto.feeHeadId && !dto.classId && !dto.feePlanId) {
      throw new BadRequestException(
        'Discount must target at least one fee head, class, or fee plan',
      );
    }

    if (!dto.percentOff && !dto.amountOff) {
      throw new BadRequestException(
        'Discount must include a percentage or fixed amount',
      );
    }

    const [feeHead, classroom, feePlan] = await Promise.all([
      dto.feeHeadId
        ? this.prisma.feeHead.findFirst({
            where: { id: dto.feeHeadId, tenantId },
          })
        : Promise.resolve(null),
      dto.classId
        ? this.prisma.class.findFirst({
            where: { id: dto.classId, tenantId },
          })
        : Promise.resolve(null),
      dto.feePlanId
        ? this.prisma.feePlan.findFirst({
            where: { id: dto.feePlanId, tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (dto.feeHeadId && !feeHead) {
      throw new NotFoundException('Fee head not found in this tenant');
    }

    if (dto.classId && !classroom) {
      throw new NotFoundException('Class not found in this tenant');
    }

    if (dto.feePlanId && !feePlan) {
      throw new NotFoundException('Fee plan not found in this tenant');
    }

    if (feePlan?.classId && dto.classId && feePlan.classId !== dto.classId) {
      throw new ConflictException(
        'Discount class does not match the selected fee plan',
      );
    }
  }

  private async invoiceContainsFeeHead(invoiceId: string, feeHeadId: string) {
    const line = await this.prisma.invoiceLine.findFirst({
      where: { invoiceId, feeHeadId },
      select: { id: true },
    });

    return Boolean(line);
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

function formatStudentName(student: {
  firstNameEn: string;
  lastNameEn: string;
}) {
  return `${student.firstNameEn} ${student.lastNameEn}`.trim();
}

function ledgerEventOrder(type: 'INVOICE' | 'PAYMENT' | 'WAIVER' | 'REFUND') {
  switch (type) {
    case 'INVOICE':
      return 1;
    case 'WAIVER':
      return 2;
    case 'PAYMENT':
      return 3;
    case 'REFUND':
      return 4;
  }
}

function sumRefundedAmount(refunds: Array<{ amount: Prisma.Decimal }>) {
  return refunds.reduce(
    (sum, refund) => sum.add(refund.amount),
    new Prisma.Decimal(0),
  );
}

function sumNetPaidAmount(
  payments: Array<{
    amount: Prisma.Decimal;
    refunds: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return payments.reduce(
    (sum, payment) =>
      sum.add(payment.amount).sub(sumRefundedAmount(payment.refunds)),
    new Prisma.Decimal(0),
  );
}

function allocateJournalLinesForRefund(
  lines: Array<{
    chartAccountId: string;
    amount: Prisma.Decimal;
    description: string | null;
  }>,
  refundAmount: Prisma.Decimal,
  paymentAmount: Prisma.Decimal,
  side: JournalLineSide,
  tenantId: string,
) {
  let remaining = refundAmount;

  return lines.map((line, index) => {
    const amount =
      index === lines.length - 1
        ? remaining
        : line.amount.mul(refundAmount).div(paymentAmount).toDecimalPlaces(2);

    remaining = remaining.sub(amount);

    return {
      tenantId,
      chartAccountId: line.chartAccountId,
      side,
      amount,
      description: line.description,
    };
  });
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

function formatFiscalYearForNumber(fiscalYear: string) {
  return fiscalYear.replace(/[^0-9]+/g, '-');
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

function groupRefundsByMonth(
  payments: Array<{
    refunds: Array<{ refundDate: Date; amount: Prisma.Decimal }>;
  }>,
) {
  const grouped = new Map<string, number>();

  for (const payment of payments) {
    for (const refund of payment.refunds) {
      const key = refund.refundDate.toISOString().slice(0, 7);
      grouped.set(key, (grouped.get(key) ?? 0) + Number(refund.amount));
    }
  }

  return Array.from(grouped.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));
}

function groupNetCollectionsByMonth(
  payments: Array<{
    paidAt: Date;
    amount: Prisma.Decimal;
    refunds: Array<{ refundDate: Date; amount: Prisma.Decimal }>;
  }>,
) {
  const grouped = new Map<string, number>();

  for (const payment of payments) {
    const paymentKey = payment.paidAt.toISOString().slice(0, 7);
    grouped.set(
      paymentKey,
      (grouped.get(paymentKey) ?? 0) + Number(payment.amount),
    );

    for (const refund of payment.refunds) {
      const refundKey = refund.refundDate.toISOString().slice(0, 7);
      grouped.set(
        refundKey,
        (grouped.get(refundKey) ?? 0) - Number(refund.amount),
      );
    }
  }

  return Array.from(grouped.entries()).map(([month, amount]) => ({
    month,
    amount,
  }));
}

function resolveWindow(openedAt: string, closedAt: string) {
  const resolvedOpenedAt = new Date(openedAt);
  const resolvedClosedAt = new Date(closedAt);

  if (Number.isNaN(resolvedOpenedAt.getTime())) {
    throw new BadRequestException('openedAt must be a valid ISO date');
  }

  if (Number.isNaN(resolvedClosedAt.getTime())) {
    throw new BadRequestException('closedAt must be a valid ISO date');
  }

  if (resolvedOpenedAt >= resolvedClosedAt) {
    throw new BadRequestException('openedAt must be earlier than closedAt');
  }

  return {
    openedAt: resolvedOpenedAt,
    closedAt: resolvedClosedAt,
  };
}

function buildReconciliationCsv(
  rows: Array<{
    paymentDate: string;
    refundDate: string | null;
    receiptNumber: string | null;
    refundNumber: string | null;
    invoiceNumber: string;
    student: { name: string; className: string };
    collector: { email: string | null } | null;
    method: string;
    grossAmount: number;
    refundedAmount: number;
    netAmount: number;
    journalEntryNumber: string | null;
    refundJournalEntryNumbers: string[];
    statusMarkers: string[];
  }>,
) {
  const lines = [
    [
      'paymentDate',
      'refundDate',
      'receiptNumber',
      'refundNumber',
      'invoiceNumber',
      'studentName',
      'className',
      'collectorEmail',
      'method',
      'grossAmount',
      'refundedAmount',
      'netAmount',
      'journalEntryNumber',
      'refundJournalEntryNumbers',
      'statusMarkers',
    ].join(','),
    ...rows.map((row) =>
      [
        row.paymentDate,
        row.refundDate ?? '',
        row.receiptNumber ?? '',
        row.refundNumber ?? '',
        row.invoiceNumber,
        escapeCsv(row.student.name),
        escapeCsv(row.student.className),
        escapeCsv(row.collector?.email ?? ''),
        row.method,
        row.grossAmount.toFixed(2),
        row.refundedAmount.toFixed(2),
        row.netAmount.toFixed(2),
        row.journalEntryNumber ?? '',
        escapeCsv(row.refundJournalEntryNumbers.join('; ')),
        escapeCsv(row.statusMarkers.join('; ')),
      ].join(','),
    ),
  ];

  return lines.join('\n');
}

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
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

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  AccountingPeriodStatus,
  AudienceType,
  ConsentType,
  InvoiceStatus,
  JournalLineSide,
  JournalSourceType,
  NotificationChannel,
  PaymentMethod,
  PaymentStatus,
  OnlinePaymentIntentStatus,
  Prisma,
  ChartAccountType,
  FeeFrequency,
  FileAsset,
  AuthMethod,
  FinanceRequestType,
  FinanceRequestStatus,
  FinanceRequestHistoryAction,
  ReceiptFileStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import type { AuthContext } from '../auth/auth.types';
import {
  ReconciliationExportFormat,
  ReconciliationQueryDto,
} from '../accounting/dto/reconciliation-query.dto';
import { UsageService } from '../usage/usage.service';
import {
  buildReceiptPdf,
  buildCashierClosePdf,
} from '../common/pdf/simple-pdf';
import { loadSchoolLogoForPdf } from '../common/pdf/school-logo-loader';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { EntitlementsService } from '../plans/entitlements.service';
import {
  getParentStudentIds,
  getStudentOwnId,
} from '../common/security/parent-scope';
import { ConfigService } from '../config/config.service';
import {
  decryptSensitiveField,
  isEncryptedSensitiveField,
} from '../common/security/field-encryption';
import { CashierCloseWindowDto } from './dto/cashier-close-window.dto';
import { CollectPaymentDto } from './dto/collect-payment.dto';
import { InitiateOnlinePaymentDto } from './dto/initiate-online-payment.dto';
import { CreateFinanceRequestDto } from './dto/create-finance-request.dto';
import { ReviewFinanceRequestDto } from './dto/review-finance-request.dto';
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
import { ReprintReceiptDto } from './dto/reprint-receipt.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { DuesQueryDto } from './dto/dues-query.dto';
import { FeeAgingBucket, ListDefaultersDto } from './dto/list-defaulters.dto';
import { FinanceDashboardSummaryQueryDto } from './dto/finance-dashboard-summary-query.dto';
import { FinanceReportQueryDto } from './dto/finance-report-query.dto';
import { StudentFeeLedgerQueryDto } from './dto/student-fee-ledger-query.dto';
import {
  BaseFinanceListQueryDto,
  ListBillingRunsQueryDto,
  ListDiscountRulesQueryDto,
  ListFinanceApprovalRequestsQueryDto,
  ListInvoicesQueryDto,
  ListLedgerEntriesQueryDto,
  ListPaymentsQueryDto,
  ListReceiptsQueryDto,
  ListWaiversQueryDto,
} from './dto/list-finance-records.query.dto';
import {
  PARENT_SANDBOX_PAYMENT_PROVIDERS,
  type ParentSandboxPaymentProvider,
} from './sandbox-payment-provider';
import {
  NEPAL_TIME_ZONE,
  zonedNepalDateTimeToUtc,
  type FinanceDashboardSummary,
  type StudentCollectionContext,
} from '@schoolos/core';

interface CollectedPaymentWithReceipt {
  id: string;
  invoiceId: string;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  paidAt: Date;
  receipt: {
    id: string;
    receiptNumber: string;
    fileAssetId: string | null;
    fileStatus: ReceiptFileStatus;
  } | null;
}

export interface FeeCollectionReportRow {
  receiptNumber: string;
  paymentDate: Date;
  studentSystemId: string;
  studentName: string;
  className: string;
  sectionName: string;
  guardianName: string;
  guardianPhone: string;
  invoiceNumber: string;
  feeHeadName: string | null;
  paymentMethod: PaymentMethod;
  collectedBy: string;
  grossAmount: number;
  discountAmount: number;
  waiverAmount: number;
  paidAmount: number;
  refundAmount: number;
  netCollectedAmount: number;
  status: InvoiceStatus;
}

export interface DefaulterAgingReportRow {
  studentSystemId: string;
  studentName: string;
  className: string;
  sectionName: string;
  guardianName: string;
  guardianPhone: string;
  invoiceNumber: string;
  feeHeadName: string | null;
  dueDate: Date;
  invoiceAmount: number;
  paidAmount: number;
  waiverAmount: number;
  refundAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
  agingBucket: string;
  lastPaymentDate: Date | null;
  status: InvoiceStatus;
}

export interface CashierCloseMethodBreakdown extends Prisma.JsonObject {
  method: PaymentMethod;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  paymentCount: number;
  refundCount: number;
}

export interface CashierClosePdfFileSummary {
  fileAssetId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface CashierCloseSummary {
  openedAt: Date;
  closedAt: Date;
  collectorUserId: string | null;
  paymentMethod: PaymentMethod | null;
  grossCollected: number;
  totalRefunded: number;
  netCollected: number;
  expectedCashAmount: number;
  actualCashAmount: number | null;
  varianceAmount: number | null;
  varianceReason: string | null;
  denominationBreakdown: Record<string, unknown> | null;
  methodBreakdown: CashierCloseMethodBreakdown[];
  paymentCount: number;
  refundCount: number;
  firstReceiptNumber: string | null;
  lastReceiptNumber: string | null;
  closePdfFile?: CashierClosePdfFileSummary | null;
}

type CashierCloseWithUsers = Prisma.CashierCloseGetPayload<{
  include: {
    collectorUser: { select: { id: true; email: true } };
    closedBy: { select: { id: true; email: true } };
  };
}>;

interface CollectionStudentSearchRow {
  id: string;
  studentSystemId: string;
  firstNameEn: string;
  lastNameEn: string;
  className: string;
  sectionName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  openInvoiceCount: bigint;
  totalOutstanding: Prisma.Decimal;
}

interface PaymentMethodReportRow {
  method: PaymentMethod;
  paymentCount: bigint;
  refundCount: bigint;
  grossAmount: Prisma.Decimal;
  refundedAmount: Prisma.Decimal;
  netAmount: Prisma.Decimal;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly eventEmitter: EventEmitter2,
    private readonly usageService: UsageService,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    private readonly fileRegistryService?: FileRegistryService,
    @Optional()
    private readonly entitlementsService?: EntitlementsService,
  ) {}

  async getDashboardSummary(
    query: FinanceDashboardSummaryQueryDto,
    actor: AuthContext,
  ): Promise<FinanceDashboardSummary> {
    assertAnyFinancePermission(actor, [
      'fees:manage',
      'payments:collect',
      'payments:close',
      'payments:refund',
      'payments:reverse',
      'receipts:read',
    ]);

    const timeZoneSetting = await this.prisma.tenantSetting.findUnique({
      where: {
        tenantId_key: {
          tenantId: actor.tenantId,
          key: 'timezone',
        },
      },
      select: { value: true },
    });
    const configuredTimeZone =
      typeof timeZoneSetting?.value === 'string'
        ? timeZoneSetting.value
        : NEPAL_TIME_ZONE;

    if (configuredTimeZone !== NEPAL_TIME_ZONE) {
      throw new BadRequestException(
        `Finance summaries require the supported school timezone ${NEPAL_TIME_ZONE}.`,
      );
    }
    if (query.timeZone && query.timeZone !== configuredTimeZone) {
      throw new BadRequestException(
        'Requested timezone does not match the configured school timezone.',
      );
    }

    const period = resolveFinanceSummaryPeriod(query, configuredTimeZone);
    const openInvoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
    };
    const overdueInvoiceWhere: Prisma.InvoiceWhereInput = {
      ...openInvoiceWhere,
      dueDate: { lt: period.endExclusiveUtc },
    };
    const periodDateWhere = {
      gte: period.startUtc,
      lt: period.endExclusiveUtc,
    };

    const [
      periodPaymentAggregate,
      periodRefundAggregate,
      outstandingInvoiceAggregate,
      outstandingPaymentAggregate,
      outstandingRefundAggregate,
      overdueInvoiceAggregate,
      overduePaymentAggregate,
      overdueRefundAggregate,
      overdueStudentRows,
      pendingApprovalCount,
      receiptsIssued,
      latestClose,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          tenantId: actor.tenantId,
          status: PaymentStatus.SUCCESS,
          paidAt: periodDateWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          tenantId: actor.tenantId,
          refundDate: periodDateWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: openInvoiceWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          tenantId: actor.tenantId,
          status: PaymentStatus.SUCCESS,
          invoice: openInvoiceWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          tenantId: actor.tenantId,
          payment: {
            status: PaymentStatus.SUCCESS,
            invoice: openInvoiceWhere,
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.aggregate({
        where: overdueInvoiceWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          tenantId: actor.tenantId,
          status: PaymentStatus.SUCCESS,
          invoice: overdueInvoiceWhere,
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          tenantId: actor.tenantId,
          payment: {
            status: PaymentStatus.SUCCESS,
            invoice: overdueInvoiceWhere,
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ studentCount: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT "studentId")::bigint AS "studentCount"
        FROM "Invoice"
        WHERE "tenantId" = ${actor.tenantId}
          AND "status" IN ('ISSUED', 'PARTIAL')
          AND "dueDate" < ${period.endExclusiveUtc}
      `),
      this.prisma.financeApprovalRequest.count({
        where: {
          tenantId: actor.tenantId,
          status: FinanceRequestStatus.PENDING,
        },
      }),
      this.prisma.receipt.count({
        where: {
          tenantId: actor.tenantId,
          issuedAt: periodDateWhere,
        },
      }),
      this.prisma.cashierClose.findFirst({
        where: {
          tenantId: actor.tenantId,
          closedAt: {
            gte: period.startUtc,
            lt: period.endExclusiveUtc,
          },
        },
        orderBy: [{ closedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          closeNumber: true,
          closedAt: true,
        },
      }),
    ]);

    const unclosedPaymentCount = await this.prisma.payment.count({
      where: {
        tenantId: actor.tenantId,
        status: PaymentStatus.SUCCESS,
        paidAt: {
          gte:
            latestClose && latestClose.closedAt > period.startUtc
              ? latestClose.closedAt
              : period.startUtc,
          lt: period.endExclusiveUtc,
        },
      },
    });

    const grossCollected = decimalOrZero(periodPaymentAggregate._sum.amount);
    const periodRefunded = decimalOrZero(periodRefundAggregate._sum.amount);
    const outstandingAmount = calculateOutstandingAmount(
      outstandingInvoiceAggregate._sum.totalAmount,
      outstandingPaymentAggregate._sum.amount,
      outstandingRefundAggregate._sum.amount,
    );
    const overdueAmount = calculateOutstandingAmount(
      overdueInvoiceAggregate._sum.totalAmount,
      overduePaymentAggregate._sum.amount,
      overdueRefundAggregate._sum.amount,
    );
    const cashierState =
      latestClose && unclosedPaymentCount === 0
        ? 'CLOSED'
        : unclosedPaymentCount > 0
          ? 'OPEN'
          : 'NOT_STARTED';

    return {
      period: {
        fromDate: period.fromDate,
        toDate: period.toDate,
        timeZone: configuredTimeZone,
        startUtc: period.startUtc.toISOString(),
        endExclusiveUtc: period.endExclusiveUtc.toISOString(),
      },
      collectedToday: {
        grossAmount: grossCollected.toFixed(2),
        refundedAmount: periodRefunded.toFixed(2),
        netAmount: grossCollected.sub(periodRefunded).toFixed(2),
      },
      outstanding: {
        amount: outstandingAmount.toFixed(2),
      },
      overdue: {
        studentCount: Number(overdueStudentRows[0]?.studentCount ?? 0),
        amount: overdueAmount.toFixed(2),
      },
      pendingApprovalCount,
      cashierClose: {
        state: cashierState,
        latestCloseId: latestClose?.id ?? null,
        latestCloseNumber: latestClose?.closeNumber ?? null,
        latestClosedAt: latestClose?.closedAt.toISOString() ?? null,
        unclosedPaymentCount,
      },
      receiptsIssued,
      generatedAt: new Date().toISOString(),
    };
  }

  async reprintReceipt(
    receiptId: string,
    dto: ReprintReceiptDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'receipts:manage');
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException(
        'A reason is required to reprint this receipt.',
      );
    }
    const idempotencyKey = dto.idempotencyKey.trim();
    const existingHistory = await this.prisma.receiptReprintHistory.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
      },
    });
    if (existingHistory?.fileAssetId) {
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'receipt_reprint',
        resourceId: existingHistory.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          receiptId: existingHistory.receiptId,
          fileAssetId: existingHistory.fileAssetId,
        },
      });
      return {
        receiptId: existingHistory.receiptId,
        reprintHistoryId: existingHistory.id,
        fileAssetId: existingHistory.fileAssetId,
        fileName: `Receipt_Reprint.pdf`,
        disposition: 'REPLAYED' as const,
      };
    }
    if (existingHistory) {
      throw new ConflictException(
        'This receipt reprint is already processing or unavailable. Retry with a new request after checking its status.',
      );
    }

    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, tenantId: actor.tenantId },
      include: {
        payment: {
          include: {
            student: { include: { class: true, sectionRef: true } },
            invoice: {
              include: {
                lines: { include: { feeHead: true } },
              },
            },
            collectedBy: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found in this tenant');
    }
    if (!this.fileRegistryService) {
      throw new ConflictException(
        'Protected receipt reprint is temporarily unavailable.',
      );
    }

    const school = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });
    const logo = await loadSchoolLogoForPdf(
      this.prisma,
      this.fileRegistryService,
      actor,
    );

    const student = receipt.payment.student;
    const invoice = receipt.payment.invoice;

    const pdf = buildReceiptPdf({
      schoolName: school?.name || 'SchoolOS',
      panNumber: school?.panNumber,
      receiptNumber: receipt.receiptNumber,
      invoiceNumber: invoice.invoiceNumber,
      paymentDate: receipt.payment.paidAt,
      method: receipt.payment.method,
      cashierName: receipt.payment.collectedBy?.email || 'System',
      student: {
        id: student.studentSystemId,
        name: `${student.firstNameEn} ${student.lastNameEn}`,
        className: student.class.name,
        sectionName: student.sectionRef?.name,
      },
      lines: invoice.lines.map((l) => ({
        name: l.feeHead.name,
        amount: Number(l.totalAmount),
      })),
      subtotal: Number(invoice.subtotal),
      discount: 0,
      total: Number(invoice.totalAmount),
      paidAmount: Number(receipt.payment.amount),
      balance: Number(invoice.totalAmount.sub(receipt.payment.amount)),
      isReprint: true,
      qrToken: receipt.receiptNumber,
      logo,
    });
    const fileName = `Receipt_${receipt.receiptNumber}_Reprint.pdf`;
    let history: Prisma.ReceiptReprintHistoryGetPayload<object> | null =
      existingHistory;
    if (!history) {
      try {
        history = await this.prisma.receiptReprintHistory.create({
          data: {
            tenantId: actor.tenantId,
            receiptId: receipt.id,
            paymentId: receipt.paymentId,
            studentId: receipt.payment.studentId,
            reprintedById: actor.userId,
            reason,
            format: 'pdf',
            delivery: 'download',
            idempotencyKey,
            metadata: {
              receiptNumber: receipt.receiptNumber,
              fileName,
              state: 'PROCESSING',
            },
          },
        });
      } catch (error) {
        if (!isPrismaUniqueConstraintError(error)) {
          throw error;
        }
        history = await this.prisma.receiptReprintHistory.findFirst({
          where: {
            tenantId: actor.tenantId,
            idempotencyKey,
          },
        });
        if (!history) {
          throw error;
        }
        if (history.fileAssetId) {
          return {
            receiptId: history.receiptId,
            reprintHistoryId: history.id,
            fileAssetId: history.fileAssetId,
            fileName,
            disposition: 'REPLAYED' as const,
          };
        }
        throw new ConflictException(
          'This receipt reprint is already processing or unavailable. Retry with a new request after checking its status.',
        );
      }
    }

    let fileAsset: FileAsset;
    try {
      fileAsset = await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: fileName,
        content: pdf,
        mimeType: 'application/pdf',
        module: 'fees',
        entityId: receipt.id,
        metadata: {
          kind: 'receipt_reprint',
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          paymentId: receipt.paymentId,
          studentId: receipt.payment.studentId,
        },
      });
    } catch {
      await this.prisma.receiptReprintHistory.update({
        where: { id: history.id },
        data: {
          metadata: {
            receiptNumber: receipt.receiptNumber,
            fileName,
            state: 'UNAVAILABLE',
          },
        },
      });
      throw new ConflictException(
        'Receipt reprint file is temporarily unavailable. Retry later.',
      );
    }

    history = await this.prisma.receiptReprintHistory.update({
      where: { id: history.id },
      data: {
        fileAssetId: fileAsset.id,
        metadata: {
          receiptNumber: receipt.receiptNumber,
          fileName,
          fileAssetId: fileAsset.id,
          state: 'AVAILABLE',
        },
      },
    });

    await this.auditService.record({
      action: 'reprint',
      resource: 'receipt',
      resourceId: receipt.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        reason,
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        studentId: receipt.payment.studentId,
        reprintHistoryId: history.id,
        fileAssetId: fileAsset.id,
      },
    });

    return {
      receiptId: receipt.id,
      reprintHistoryId: history.id,
      fileAssetId: fileAsset.id,
      fileName,
      disposition: 'SUCCEEDED' as const,
    };
  }

  async getDuesTableReport(query: DuesQueryDto, actor: AuthContext) {
    assertFinancePermission(actor, 'fees:manage');
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      status: query.status
        ? query.status
        : { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.classId || query.sectionId
        ? {
            student: {
              ...(query.classId ? { classId: query.classId } : {}),
              ...(query.sectionId ? { sectionId: query.sectionId } : {}),
            },
          }
        : {}),
      ...(query.feeHeadId
        ? {
            lines: {
              some: { feeHeadId: query.feeHeadId },
            },
          }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.feePeriodId
        ? {
            billingRun: {
              is: {
                feePlanId: query.feePeriodId,
              },
            },
          }
        : {}),
    };

    const [invoices, totalCount] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          student: { include: { class: true, sectionRef: true } },
          billingRun: true,
          lines: { include: { feeHead: true } },
          payments: { include: { refunds: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const waivers = await this.prisma.feeWaiver.findMany({
      where: {
        tenantId: actor.tenantId,
        invoiceId: { in: invoices.map((i) => i.id) },
      },
    });

    const waiverMap = new Map<string, Prisma.Decimal>();
    for (const w of waivers) {
      if (w.invoiceId) {
        const key = `${w.invoiceId}_${w.feeHeadId || 'all'}`;
        waiverMap.set(
          key,
          (waiverMap.get(key) || new Prisma.Decimal(0)).add(w.amount),
        );
      }
    }

    const allRows = invoices.flatMap((invoice) => {
      const netPaidTotal = sumNetPaidAmount(invoice.payments);
      let remainingPaid = netPaidTotal;

      return invoice.lines
        .filter(
          (line) => !query.feeHeadId || line.feeHeadId === query.feeHeadId,
        )
        .map((line) => {
          const lineWaiver =
            waiverMap.get(`${invoice.id}_${line.feeHeadId}`) ||
            waiverMap.get(`${invoice.id}_all`)?.div(invoice.lines.length) ||
            new Prisma.Decimal(0);

          const lineBilled = line.totalAmount;
          const linePayable = lineBilled.sub(lineWaiver);

          let linePaid = new Prisma.Decimal(0);
          if (remainingPaid.gt(0)) {
            if (remainingPaid.gte(linePayable)) {
              linePaid = linePayable;
              remainingPaid = remainingPaid.sub(linePayable);
            } else {
              linePaid = remainingPaid;
              remainingPaid = new Prisma.Decimal(0);
            }
          }

          const outstanding = linePayable.sub(linePaid);
          const agingBucket = getAgingBucket(invoice.dueDate);

          return {
            studentId: invoice.studentId,
            studentName: `${invoice.student.firstNameEn} ${invoice.student.lastNameEn}`,
            studentSystemId: invoice.student.studentSystemId,
            className: invoice.student.class.name,
            sectionName: invoice.student.sectionRef?.name || '-',
            feeHeadId: line.feeHeadId,
            feeHead: line.feeHead.name,
            billingPeriod: invoice.billingRun
              ? {
                  month: invoice.billingRun.runMonth,
                  year: invoice.billingRun.runYear,
                  label: `${invoice.billingRun.runYear}-${String(invoice.billingRun.runMonth).padStart(2, '0')}`,
                }
              : null,
            originalAmount: Number(lineBilled),
            discountAmount: 0,
            fineAmount: 0,
            paidAmount: Number(linePaid),
            remainingDue: Number(outstanding),
            status: resolveDuesRowStatus(
              invoice.dueDate,
              linePaid,
              outstanding,
            ),
            billed: Number(lineBilled),
            waived: Number(lineWaiver),
            paid: Number(linePaid),
            outstanding: Number(outstanding),
            dueDate: invoice.dueDate,
            invoiceNumber: invoice.invoiceNumber,
            agingBucket,
          };
        });
    });

    const filteredRows = query.agingBucket
      ? allRows.filter((r) => r.agingBucket === query.agingBucket)
      : allRows;

    return {
      rows: filteredRows,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalBilled: filteredRows.reduce((sum, r) => sum + r.billed, 0),
        totalWaived: filteredRows.reduce((sum, r) => sum + r.waived, 0),
        totalPaid: filteredRows.reduce((sum, r) => sum + r.paid, 0),
        totalOutstanding: filteredRows.reduce(
          (sum, r) => sum + r.outstanding,
          0,
        ),
      },
    };
  }

  async listFeeHeads(actor: AuthContext) {
    return this.prisma.feeHead.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ code: 'asc' }],
      take: 100,
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
      take: 100,
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

  async listBillingRuns(query: ListBillingRunsQueryDto, actor: AuthContext) {
    const pagination = resolveFinancePagination(query);
    const where: Prisma.FeeBillingRunWhereInput = {
      tenantId: actor.tenantId,
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.feePlanId ? { feePlanId: query.feePlanId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.runYear ? { runYear: query.runYear } : {}),
      ...(query.runMonth ? { runMonth: query.runMonth } : {}),
      ...(query.search
        ? {
            OR: [
              {
                feePlan: {
                  is: {
                    name: {
                      contains: query.search.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                feePlan: {
                  is: {
                    code: {
                      contains: query.search.trim(),
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'generatedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [runs, total] = await Promise.all([
      this.prisma.feeBillingRun.findMany({
        where,
        include: {
          academicYear: true,
          feePlan: true,
          _count: { select: { invoices: true } },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.feeBillingRun.count({ where }),
    ]);

    return buildFinancePage(
      runs.map(({ _count, ...run }) => ({
        ...run,
        invoiceCount: _count.invoices,
      })),
      total,
      pagination,
    );
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

        const invoice = await tx.invoice.create({
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
            lines: { include: { feeHead: true } },
          },
        });
        invoices.push(invoice);

        await this.postInvoiceToLedger(invoice, actor, tx);
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

  async listDiscountRules(
    query: ListDiscountRulesQueryDto,
    actor: AuthContext,
  ) {
    const pagination = resolveFinancePagination(query);
    const where: Prisma.DiscountRuleWhereInput = {
      tenantId: actor.tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            name: {
              contains: query.search.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [items, total] = await Promise.all([
      this.prisma.discountRule.findMany({
        where,
        include: {
          feeHead: true,
          class: true,
          feePlan: true,
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.discountRule.count({ where }),
    ]);
    return buildFinancePage(items, total, pagination);
  }

  async createDiscountRule(dto: CreateDiscountRuleDto, actor: AuthContext) {
    assertFinancePermission(actor, 'fees:discount');
    const reason = dto.reason?.trim();

    if (!reason) {
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
        reason,
      },
    });

    return discount;
  }

  async listWaivers(query: ListWaiversQueryDto, actor: AuthContext) {
    const pagination = resolveFinancePagination(query);
    const where: Prisma.FeeWaiverWhereInput = {
      tenantId: actor.tenantId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                reason: {
                  contains: query.search.trim(),
                  mode: 'insensitive',
                },
              },
              {
                student: {
                  is: {
                    OR: [
                      {
                        firstNameEn: {
                          contains: query.search.trim(),
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastNameEn: {
                          contains: query.search.trim(),
                          mode: 'insensitive',
                        },
                      },
                      {
                        studentSystemId: {
                          contains: query.search.trim(),
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [items, total] = await Promise.all([
      this.prisma.feeWaiver.findMany({
        where,
        include: {
          student: true,
          feeHead: true,
          approvedBy: { select: { id: true, email: true } },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.feeWaiver.count({ where }),
    ]);
    return buildFinancePage(items, total, pagination);
  }

  async createWaiver(dto: CreateFeeWaiverDto, actor: AuthContext) {
    assertFinancePermission(actor, 'fees:discount');
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException('Waiver reason is required');
    }

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

    if (invoice?.status === InvoiceStatus.VOID) {
      throw new ConflictException('Void invoices cannot receive waivers');
    }

    if (invoice?.status === InvoiceStatus.PAID) {
      throw new ConflictException(
        'Paid invoices require a refund or reversal workflow before waiver',
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
        !(await this.invoiceContainsFeeHead(
          invoice.id,
          dto.feeHeadId,
          actor.tenantId,
        ))
      ) {
        throw new ConflictException(
          'Fee head is not present on the selected invoice',
        );
      }
    }

    const amount = new Prisma.Decimal(dto.amount);
    const paidAmount = invoice ? sumNetPaidAmount(invoice.payments) : null;
    const newSubtotal = invoice ? invoice.subtotal.sub(amount) : null;
    const newTotal = invoice ? invoice.totalAmount.sub(amount) : null;

    if (invoice && newSubtotal?.lt(0)) {
      throw new ConflictException('Waiver cannot make invoice totals negative');
    }

    if (invoice && newTotal?.lt(0)) {
      throw new ConflictException('Waiver cannot make invoice totals negative');
    }

    if (invoice && paidAmount && newTotal && paidAmount.gt(newTotal)) {
      throw new ConflictException(
        'Waiver would make paid amount exceed invoice total',
      );
    }

    const waiver = await this.prisma.$transaction(async (tx) => {
      const created = await tx.feeWaiver.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          feeHeadId: dto.feeHeadId ?? null,
          invoiceId: dto.invoiceId ?? null,
          amount,
          reason,
          approvedById: actor.userId,
          approvedAt: new Date(),
        },
      });

      if (invoice && paidAmount && newSubtotal && newTotal) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: newSubtotal,
            totalAmount: newTotal,
            status: resolveInvoiceStatusAfterAdjustment(
              invoice.status,
              paidAmount,
              newTotal,
            ),
            paidAt:
              paidAmount.gte(newTotal) && newTotal.gt(0) ? new Date() : null,
          },
        });
      }

      await this.accountingPostingService.postFeeWaiver(
        {
          tenantId: actor.tenantId,
          waiverId: created.id,
          studentId: dto.studentId,
          invoiceId: dto.invoiceId,
          amount,
          reason,
        },
        actor,
        tx,
      );

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
        reason,
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
      take: 100,
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

  async getCollectionReport(
    actor: AuthContext,
    query: FinanceReportQueryDto = {},
  ) {
    assertFinancePermission(actor, 'fees:manage');
    const period = resolveOptionalFinanceReportPeriod(query);
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      ...(period
        ? {
            issuedAt: {
              gte: period.startUtc,
              lt: period.endExclusiveUtc,
            },
          }
        : {}),
    };
    const paymentWhere: Prisma.PaymentWhereInput = {
      tenantId: actor.tenantId,
      status: PaymentStatus.SUCCESS,
      ...(period
        ? {
            paidAt: {
              gte: period.startUtc,
              lt: period.endExclusiveUtc,
            },
          }
        : {}),
    };
    const refundWhere: Prisma.PaymentRefundWhereInput = {
      tenantId: actor.tenantId,
      ...(period
        ? {
            refundDate: {
              gte: period.startUtc,
              lt: period.endExclusiveUtc,
            },
          }
        : {}),
    };
    const waiverWhere: Prisma.FeeWaiverWhereInput = {
      tenantId: actor.tenantId,
      status: 'APPROVED',
      ...(period
        ? {
            createdAt: {
              gte: period.startUtc,
              lt: period.endExclusiveUtc,
            },
          }
        : {}),
    };
    const paymentDateSql = period
      ? Prisma.sql`AND "paidAt" >= ${period.startUtc} AND "paidAt" < ${period.endExclusiveUtc}`
      : Prisma.empty;
    const refundDateSql = period
      ? Prisma.sql`AND "refundDate" >= ${period.startUtc} AND "refundDate" < ${period.endExclusiveUtc}`
      : Prisma.empty;
    const invoiceDateSql = period
      ? Prisma.sql`AND i."issuedAt" >= ${period.startUtc} AND i."issuedAt" < ${period.endExclusiveUtc}`
      : Prisma.empty;
    const [
      invoiceAggregate,
      paymentAggregate,
      refundAggregate,
      waiverAggregate,
      collectionTrendRows,
      refundTrendRows,
      classWiseRows,
      feeHeadWiseRows,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: invoiceWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.aggregate({
        where: refundWhere,
        _sum: { amount: true },
      }),
      this.prisma.feeWaiver.aggregate({
        where: waiverWhere,
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{ month: string; amount: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT to_char(date_trunc('month', "paidAt"), 'YYYY-MM') AS "month",
                 COALESCE(SUM("amount"), 0) AS "amount"
          FROM "Payment"
          WHERE "tenantId" = ${actor.tenantId} AND "status" = 'SUCCESS'
          ${paymentDateSql}
          GROUP BY date_trunc('month', "paidAt")
          ORDER BY date_trunc('month', "paidAt") ASC
        `,
      ),
      this.prisma.$queryRaw<Array<{ month: string; amount: Prisma.Decimal }>>(
        Prisma.sql`
          SELECT to_char(date_trunc('month', "refundDate"), 'YYYY-MM') AS "month",
                 COALESCE(SUM("amount"), 0) AS "amount"
          FROM "PaymentRefund"
          WHERE "tenantId" = ${actor.tenantId}
          ${refundDateSql}
          GROUP BY date_trunc('month', "refundDate")
          ORDER BY date_trunc('month', "refundDate") ASC
        `,
      ),
      this.prisma.$queryRaw<
        Array<{ className: string; amount: Prisma.Decimal }>
      >(Prisma.sql`
        SELECT c."name" AS "className",
               COALESCE(SUM(i."totalAmount"), 0) AS "amount"
        FROM "Invoice" i
        JOIN "Student" s ON s."id" = i."studentId" AND s."tenantId" = i."tenantId"
        JOIN "Class" c ON c."id" = s."classId" AND c."tenantId" = i."tenantId"
        WHERE i."tenantId" = ${actor.tenantId}
        ${invoiceDateSql}
        GROUP BY c."id", c."name"
        ORDER BY c."name" ASC
      `),
      this.prisma.$queryRaw<
        Array<{ feeHeadName: string; amount: Prisma.Decimal }>
      >(Prisma.sql`
        SELECT f."name" AS "feeHeadName",
               COALESCE(SUM(l."totalAmount"), 0) AS "amount"
        FROM "InvoiceLine" l
        JOIN "Invoice" i ON i."id" = l."invoiceId" AND i."tenantId" = l."tenantId"
        JOIN "FeeHead" f ON f."id" = l."feeHeadId" AND f."tenantId" = l."tenantId"
        WHERE l."tenantId" = ${actor.tenantId}
        ${invoiceDateSql}
        GROUP BY f."id", f."name"
        ORDER BY f."name" ASC
      `),
    ]);
    const totalBilled = decimalOrZero(invoiceAggregate._sum.totalAmount);
    const totalCollected = decimalOrZero(paymentAggregate._sum.amount);
    const totalRefunded = decimalOrZero(refundAggregate._sum.amount);
    const totalWaived = decimalOrZero(waiverAggregate._sum.amount);
    const refundTrend = new Map(
      refundTrendRows.map((row) => [row.month, decimalOrZero(row.amount)]),
    );

    return {
      totalBilled: totalBilled.toFixed(2),
      totalCollected: totalCollected.toFixed(2),
      totalRefunded: totalRefunded.toFixed(2),
      netCollected: totalCollected.sub(totalRefunded).toFixed(2),
      totalOutstanding: Prisma.Decimal.max(
        new Prisma.Decimal(0),
        totalBilled.sub(totalCollected).add(totalRefunded),
      ).toFixed(2),
      totalWaived: totalWaived.toFixed(2),
      collectionTrend: collectionTrendRows.map((row) => ({
        month: row.month,
        amount: decimalOrZero(row.amount).toFixed(2),
      })),
      refundTrend: refundTrendRows.map((row) => ({
        month: row.month,
        amount: decimalOrZero(row.amount).toFixed(2),
      })),
      netCollectionTrend: collectionTrendRows.map((row) => ({
        month: row.month,
        amount: decimalOrZero(row.amount)
          .sub(refundTrend.get(row.month) ?? 0)
          .toFixed(2),
      })),
      classWiseBreakdown: classWiseRows.map((row) => ({
        className: row.className,
        amount: decimalOrZero(row.amount).toFixed(2),
      })),
      feeHeadWiseBreakdown: feeHeadWiseRows.map((row) => ({
        feeHeadName: row.feeHeadName,
        amount: decimalOrZero(row.amount).toFixed(2),
      })),
      period: period
        ? {
            fromDate: period.fromDate,
            toDate: period.toDate,
            timeZone: NEPAL_TIME_ZONE,
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
  }

  async getPaymentMethodReport(
    actor: AuthContext,
    query: FinanceReportQueryDto = {},
  ) {
    assertFinancePermission(actor, 'fees:manage');
    const period = resolveOptionalFinanceReportPeriod(query);
    const paymentDateSql = period
      ? Prisma.sql`AND p."paidAt" >= ${period.startUtc} AND p."paidAt" < ${period.endExclusiveUtc}`
      : Prisma.empty;
    const refundDateSql = period
      ? Prisma.sql`AND r."refundDate" >= ${period.startUtc} AND r."refundDate" < ${period.endExclusiveUtc}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<PaymentMethodReportRow[]>(
      Prisma.sql`
        WITH method_events AS (
          SELECT
            p."method",
            COUNT(p."id")::bigint AS "paymentCount",
            0::bigint AS "refundCount",
            COALESCE(SUM(p."amount"), 0) AS "grossAmount",
            0::decimal AS "refundedAmount"
          FROM "Payment" p
          WHERE p."tenantId" = ${actor.tenantId}
            AND p."status" = 'SUCCESS'
            ${paymentDateSql}
          GROUP BY p."method"

          UNION ALL

          SELECT
            p."method",
            0::bigint AS "paymentCount",
            COUNT(r."id")::bigint AS "refundCount",
            0::decimal AS "grossAmount",
            COALESCE(SUM(r."amount"), 0) AS "refundedAmount"
          FROM "PaymentRefund" r
          INNER JOIN "Payment" p
            ON p."id" = r."paymentId"
           AND p."tenantId" = r."tenantId"
          WHERE r."tenantId" = ${actor.tenantId}
            ${refundDateSql}
          GROUP BY p."method"
        )
        SELECT
          "method",
          SUM("paymentCount")::bigint AS "paymentCount",
          SUM("refundCount")::bigint AS "refundCount",
          SUM("grossAmount") AS "grossAmount",
          SUM("refundedAmount") AS "refundedAmount",
          SUM("grossAmount") - SUM("refundedAmount") AS "netAmount"
        FROM method_events
        GROUP BY "method"
        ORDER BY "method" ASC
      `,
    );

    return {
      rows: rows.map((row) => ({
        method: row.method,
        paymentCount: Number(row.paymentCount),
        refundCount: Number(row.refundCount),
        grossAmount: decimalOrZero(row.grossAmount).toFixed(2),
        refundedAmount: decimalOrZero(row.refundedAmount).toFixed(2),
        netAmount: decimalOrZero(row.netAmount).toFixed(2),
      })),
      period: period
        ? {
            fromDate: period.fromDate,
            toDate: period.toDate,
            timeZone: NEPAL_TIME_ZONE,
          }
        : null,
      generatedAt: new Date().toISOString(),
    };
  }

  async getFeeCollectionReportRows(
    actor: AuthContext,
    filters: {
      fromDate: string;
      toDate: string;
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
      collectorUserId?: string;
      paymentMethod?: string;
      feeHeadId?: string;
    },
  ) {
    const from = new Date(filters.fromDate);
    const to = new Date(filters.toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('fromDate and toDate must be valid dates');
    }

    if (
      filters.paymentMethod &&
      !Object.values(PaymentMethod).includes(
        filters.paymentMethod as PaymentMethod,
      )
    ) {
      throw new BadRequestException(
        `Invalid payment method: ${filters.paymentMethod}`,
      );
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: actor.tenantId,
        paidAt: { gte: from, lte: to },
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.collectorUserId
          ? { collectedById: filters.collectorUserId }
          : {}),
        ...(filters.paymentMethod
          ? { method: filters.paymentMethod as PaymentMethod }
          : {}),
        ...(filters.academicYearId ||
        filters.classId ||
        filters.sectionId ||
        filters.feeHeadId
          ? {
              invoice: {
                ...(filters.academicYearId
                  ? { academicYearId: filters.academicYearId }
                  : {}),
                ...(filters.classId || filters.sectionId
                  ? {
                      student: {
                        ...(filters.classId
                          ? { classId: filters.classId }
                          : {}),
                        ...(filters.sectionId
                          ? { sectionId: filters.sectionId }
                          : {}),
                      },
                    }
                  : {}),
                ...(filters.feeHeadId
                  ? {
                      lines: {
                        some: { feeHeadId: filters.feeHeadId },
                      },
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: {
        receipt: true,
        collectedBy: { select: { id: true, email: true } },
        refunds: true,
        student: {
          include: {
            class: true,
            sectionRef: true,
            guardianLinks: {
              include: {
                guardian: true,
              },
            },
          },
        },
        invoice: {
          include: {
            lines: {
              include: {
                feeHead: true,
              },
            },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    const rows = payments.map((p) => {
      const primaryGuardianLink =
        p.student.guardianLinks.find((l) => l.isPrimary) ||
        p.student.guardianLinks[0];
      const guardian = primaryGuardianLink?.guardian;

      const refundAmount = p.refunds.reduce(
        (sum, r) => sum.add(r.amount),
        new Prisma.Decimal(0),
      );

      const grossAmount = p.invoice.lines.reduce(
        (sum, l) => sum.add(l.unitAmount.mul(l.quantity)),
        new Prisma.Decimal(0),
      );

      const discountAmount = new Prisma.Decimal(0);
      const waiverAmount = new Prisma.Decimal(0);

      const paidAmount = p.amount;
      const netCollectedAmount = paidAmount.sub(refundAmount);

      return {
        receiptNumber: p.receipt?.receiptNumber || '-',
        paymentDate: p.paidAt,
        studentSystemId: p.student.studentSystemId,
        studentName: formatStudentName(p.student),
        className: p.student.class.name,
        sectionName: p.student.sectionRef?.name || '-',
        guardianName: guardian?.fullName || '-',
        guardianPhone: guardian?.primaryPhone || '-',
        invoiceNumber: p.invoice.invoiceNumber,
        feeHeadName:
          p.invoice.lines.length === 1 ? p.invoice.lines[0].feeHead.name : null,
        paymentMethod: p.method,
        collectedBy: p.collectedBy?.email || 'System',
        grossAmount: Number(grossAmount),
        discountAmount: Number(discountAmount),
        waiverAmount: Number(waiverAmount),
        paidAmount: Number(paidAmount),
        refundAmount: Number(refundAmount),
        netCollectedAmount: Number(netCollectedAmount),
        status: p.invoice.status,
      } satisfies FeeCollectionReportRow;
    });

    const summary = {
      totalReceipts: rows.length,
      totalGrossAmount: rows.reduce((sum, r) => sum + r.grossAmount, 0),
      totalDiscountAmount: rows.reduce((sum, r) => sum + r.discountAmount, 0),
      totalWaiverAmount: rows.reduce((sum, r) => sum + r.waiverAmount, 0),
      totalPaidAmount: rows.reduce((sum, r) => sum + r.paidAmount, 0),
      totalRefundAmount: rows.reduce((sum, r) => sum + r.refundAmount, 0),
      totalNetCollectedAmount: rows.reduce(
        (sum, r) => sum + r.netCollectedAmount,
        0,
      ),
      paymentMethodBreakdown: this.groupBySimple(
        rows,
        'paymentMethod',
        'paidAmount',
      ),
      collectorBreakdown: this.groupBySimple(rows, 'collectedBy', 'paidAmount'),
    };

    return { rows, summary };
  }

  async getDefaulterAgingReportRows(
    actor: AuthContext,
    filters: {
      asOfDate: string;
      academicYearId?: string;
      classId?: string;
      sectionId?: string;
      studentId?: string;
      feeHeadId?: string;
      minOutstanding?: number;
      agingBucket?: string;
    },
  ) {
    const asOf = new Date(filters.asOfDate);
    if (isNaN(asOf.getTime())) {
      throw new BadRequestException('asOfDate must be a valid date');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        issuedAt: { lte: asOf },
        dueDate: { lt: asOf },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
        ...(filters.studentId ? { studentId: filters.studentId } : {}),
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters.classId || filters.sectionId
          ? {
              student: {
                ...(filters.classId ? { classId: filters.classId } : {}),
                ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
              },
            }
          : {}),
        ...(filters.feeHeadId
          ? {
              lines: {
                some: { feeHeadId: filters.feeHeadId },
              },
            }
          : {}),
      },
      include: {
        student: {
          include: {
            class: true,
            sectionRef: true,
            guardianLinks: {
              include: { guardian: true },
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        lines: {
          include: { feeHead: true },
        },
        payments: {
          include: { refunds: true },
          where: { paidAt: { lte: asOf } },
        },
      },
    });

    const waivers = await this.prisma.feeWaiver.findMany({
      where: {
        tenantId: actor.tenantId,
        createdAt: { lte: asOf },
        invoiceId: { in: invoices.map((i) => i.id) },
      },
    });

    const waiverMap = new Map<string, Prisma.Decimal>();
    for (const w of waivers) {
      if (w.invoiceId) {
        const current = waiverMap.get(w.invoiceId) || new Prisma.Decimal(0);
        waiverMap.set(w.invoiceId, current.add(w.amount));
      }
    }

    const rows = invoices
      .map((invoice) => {
        const paidAmount = sumNetPaidAmount(invoice.payments);
        const waiverAmount = waiverMap.get(invoice.id) || new Prisma.Decimal(0);
        const outstandingAmount = invoice.totalAmount
          .sub(paidAmount)
          .sub(waiverAmount);

        if (outstandingAmount.lte(0)) return null;
        if (
          filters.minOutstanding &&
          outstandingAmount.lt(filters.minOutstanding)
        )
          return null;

        const daysOverdue = Math.floor(
          (asOf.getTime() - invoice.dueDate.getTime()) / 86_400_000,
        );
        const bucket = this.calculateAgingBucket(daysOverdue);

        if (filters.agingBucket && bucket !== filters.agingBucket) return null;

        const primaryGuardianLink = invoice.student.guardianLinks[0];
        const guardian = primaryGuardianLink?.guardian;

        const lastPayment =
          invoice.payments.length > 0
            ? invoice.payments[invoice.payments.length - 1].paidAt
            : null;

        return {
          studentSystemId: invoice.student.studentSystemId,
          studentName: formatStudentName(invoice.student),
          className: invoice.student.class.name,
          sectionName: invoice.student.sectionRef?.name || '-',
          guardianName: guardian?.fullName || '-',
          guardianPhone: guardian?.primaryPhone || '-',
          invoiceNumber: invoice.invoiceNumber,
          feeHeadName:
            invoice.lines.length === 1 ? invoice.lines[0].feeHead.name : null,
          dueDate: invoice.dueDate,
          invoiceAmount: Number(invoice.totalAmount),
          paidAmount: Number(paidAmount),
          waiverAmount: Number(waiverAmount),
          refundAmount: 0,
          outstandingAmount: Number(outstandingAmount),
          daysOverdue,
          agingBucket: bucket,
          lastPaymentDate: lastPayment,
          status: invoice.status,
        } satisfies DefaulterAgingReportRow;
      })
      .filter((r): r is DefaulterAgingReportRow => r !== null);

    const summary = {
      totalDefaulters: new Set(rows.map((r) => r.studentSystemId)).size,
      totalOutstanding: rows.reduce((sum, r) => sum + r.outstandingAmount, 0),
      bucket0To30Total: rows
        .filter((r) => r.agingBucket === '0-30')
        .reduce((sum, r) => sum + r.outstandingAmount, 0),
      bucket31To60Total: rows
        .filter((r) => r.agingBucket === '31-60')
        .reduce((sum, r) => sum + r.outstandingAmount, 0),
      bucket61To90Total: rows
        .filter((r) => r.agingBucket === '61-90')
        .reduce((sum, r) => sum + r.outstandingAmount, 0),
      bucket90PlusTotal: rows
        .filter((r) => r.agingBucket === '90+')
        .reduce((sum, r) => sum + r.outstandingAmount, 0),
      classBreakdown: this.groupBySimple(
        rows,
        'className',
        'outstandingAmount',
      ),
      feeHeadBreakdown: this.groupBySimple(
        rows,
        'feeHeadName',
        'outstandingAmount',
      ),
    };

    return { rows, summary };
  }

  private calculateAgingBucket(daysOverdue: number) {
    if (daysOverdue <= 30) return '0-30';
    if (daysOverdue <= 60) return '31-60';
    if (daysOverdue <= 90) return '61-90';
    return '90+';
  }

  private groupBySimple<T>(rows: T[], key: keyof T, sumKey: keyof T) {
    const grouped = new Map<string, number>();
    for (const row of rows) {
      const k = String(row[key] ?? 'Unknown');
      grouped.set(k, (grouped.get(k) ?? 0) + Number(row[sumKey]));
    }
    return Array.from(grouped.entries()).map(([label, value]) => ({
      label,
      value,
    }));
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

  async listInvoices(query: ListInvoicesQueryDto, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:collect');
    const pagination = resolveFinancePagination(query);
    const search = query.search?.trim();
    const where: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status
        ? { status: query.status }
        : query.outstandingOnly
          ? { status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] } }
          : {}),
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.classId ? { student: { classId: query.classId } } : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: new Date(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: new Date(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                student: {
                  is: {
                    OR: [
                      {
                        firstNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        studentSystemId: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'issuedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          student: true,
          payments: {
            include: {
              refunds: true,
              receipt: true,
            },
            orderBy: { paidAt: 'desc' },
          },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const items = invoices.map((invoice) => {
      const lastPayment = invoice.payments[0];
      const receipt = lastPayment?.receipt;
      const paidAmount = sumNetPaidAmount(invoice.payments);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate,
        issuedAt: invoice.issuedAt,
        totalAmount: Number(invoice.totalAmount),
        student: {
          id: invoice.student.id,
          name: `${invoice.student.firstNameEn} ${invoice.student.lastNameEn}`.trim(),
          studentSystemId: invoice.student.studentSystemId,
        },
        paidAmount: Number(paidAmount),
        outstandingAmount: Math.max(
          0,
          Number(invoice.totalAmount.sub(paidAmount)),
        ),
        receiptId: receipt?.id || null,
        receiptNumber: receipt?.receiptNumber || null,
      };
    });
    return buildFinancePage(items, total, pagination);
  }

  async getInvoiceDetail(invoiceId: string, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:collect');

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
            collectedBy: { select: { id: true, email: true } },
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
          approvedBy: { select: { id: true, email: true } },
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
        entry.sourceId && entry.entryNumber
          ? ([[entry.sourceId, entry.entryNumber]] as const)
          : [],
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
                fileAssetId: payment.receipt.fileAssetId,
                fileStatus: payment.receipt.fileStatus,
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

  async getStudentCollectionContext(
    studentId: string,
    actor: AuthContext,
  ): Promise<StudentCollectionContext> {
    assertFinancePermission(actor, 'payments:collect');

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

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: student.id,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      },
      include: {
        payments: {
          include: {
            refunds: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { issuedAt: 'asc' }],
    });

    const primaryGuardian =
      student.guardianLinks.find((link) => link.isPrimary) ??
      student.guardianLinks[0];

    return {
      student: {
        id: student.id,
        studentSystemId: student.studentSystemId,
        name: formatStudentName(student),
        className: student.class?.name ?? null,
        sectionName: student.sectionRef?.name ?? null,
        guardianName: primaryGuardian?.guardian.fullName ?? null,
        guardianPhone: primaryGuardian?.guardian.primaryPhone ?? null,
      },
      invoices: invoices
        .map((invoice) => {
          const paidAmount = sumNetPaidAmount(invoice.payments);
          const outstandingAmount = invoice.totalAmount.sub(paidAmount);

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            dueDate: invoice.dueDate.toISOString(),
            totalAmount: Number(invoice.totalAmount),
            paidAmount: Number(paidAmount),
            outstandingAmount: Math.max(0, Number(outstandingAmount)),
          };
        })
        .filter((invoice) => invoice.outstandingAmount > 0),
    };
  }

  async searchCollectionStudents(
    query: string | undefined,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:collect');
    const normalizedQuery = query?.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return { items: [], generatedAt: new Date().toISOString() };
    }

    const likeQuery = `%${normalizedQuery.replace(/[%_]/g, '\\$&')}%`;
    const rows = await this.prisma.$queryRaw<CollectionStudentSearchRow[]>(
      Prisma.sql`
        WITH invoice_balances AS (
          SELECT
            i."id",
            i."studentId",
            GREATEST(
              i."totalAmount" - COALESCE(payment_totals."netPaid", 0),
              0
            ) AS "outstanding"
          FROM "Invoice" i
          LEFT JOIN LATERAL (
            SELECT COALESCE(
              SUM(p."amount" - COALESCE(refund_totals."amount", 0)),
              0
            ) AS "netPaid"
            FROM "Payment" p
            LEFT JOIN LATERAL (
              SELECT COALESCE(SUM(pr."amount"), 0) AS "amount"
              FROM "PaymentRefund" pr
              WHERE pr."tenantId" = p."tenantId"
                AND pr."paymentId" = p."id"
            ) refund_totals ON TRUE
            WHERE p."tenantId" = i."tenantId"
              AND p."invoiceId" = i."id"
              AND p."status" = 'SUCCESS'
          ) payment_totals ON TRUE
          WHERE i."tenantId" = ${actor.tenantId}
            AND i."status" IN ('ISSUED', 'PARTIAL')
        )
        SELECT
          s."id",
          s."studentSystemId",
          s."firstNameEn",
          s."lastNameEn",
          c."name" AS "className",
          sec."name" AS "sectionName",
          primary_guardian."fullName" AS "guardianName",
          primary_guardian."primaryPhone" AS "guardianPhone",
          COUNT(ib."id")::bigint AS "openInvoiceCount",
          SUM(ib."outstanding") AS "totalOutstanding"
        FROM "Student" s
        INNER JOIN "Class" c
          ON c."id" = s."classId"
         AND c."tenantId" = s."tenantId"
        LEFT JOIN "Section" sec
          ON sec."id" = s."sectionId"
         AND sec."tenantId" = s."tenantId"
        INNER JOIN invoice_balances ib
          ON ib."studentId" = s."id"
         AND ib."outstanding" > 0
        LEFT JOIN LATERAL (
          SELECT g."fullName", g."primaryPhone"
          FROM "StudentGuardian" sg
          INNER JOIN "Guardian" g
            ON g."id" = sg."guardianId"
           AND g."tenantId" = sg."tenantId"
          WHERE sg."tenantId" = s."tenantId"
            AND sg."studentId" = s."id"
          ORDER BY sg."isPrimary" DESC, sg."createdAt" ASC
          LIMIT 1
        ) primary_guardian ON TRUE
        WHERE s."tenantId" = ${actor.tenantId}
          AND (
            s."studentSystemId" ILIKE ${likeQuery} ESCAPE '\\'
            OR s."firstNameEn" ILIKE ${likeQuery} ESCAPE '\\'
            OR s."lastNameEn" ILIKE ${likeQuery} ESCAPE '\\'
            OR CONCAT(s."firstNameEn", ' ', s."lastNameEn") ILIKE ${likeQuery} ESCAPE '\\'
            OR COALESCE(primary_guardian."primaryPhone", '') ILIKE ${likeQuery} ESCAPE '\\'
            OR EXISTS (
              SELECT 1
              FROM "Invoice" search_invoice
              WHERE search_invoice."tenantId" = s."tenantId"
                AND search_invoice."studentId" = s."id"
                AND search_invoice."invoiceNumber" ILIKE ${likeQuery} ESCAPE '\\'
            )
          )
        GROUP BY
          s."id",
          s."studentSystemId",
          s."firstNameEn",
          s."lastNameEn",
          c."name",
          sec."name",
          primary_guardian."fullName",
          primary_guardian."primaryPhone"
        HAVING SUM(ib."outstanding") > 0
        ORDER BY
          CASE
            WHEN s."studentSystemId" ILIKE ${`${normalizedQuery}%`} THEN 0
            ELSE 1
          END,
          s."firstNameEn" ASC,
          s."lastNameEn" ASC
        LIMIT 20
      `,
    );

    return {
      items: rows.map((row) => ({
        id: row.id,
        studentSystemId: row.studentSystemId,
        name: `${row.firstNameEn} ${row.lastNameEn}`.trim(),
        className: row.className,
        sectionName: row.sectionName,
        guardianName: row.guardianName,
        guardianPhone: row.guardianPhone,
        openInvoiceCount: Number(row.openInvoiceCount),
        totalOutstanding: decimalOrZero(row.totalOutstanding).toFixed(2),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async searchLedgerStudents(query: string | undefined, actor: AuthContext) {
    assertFinancePermission(actor, 'ledger:read');
    const normalizedQuery = query?.trim();

    if (!normalizedQuery || normalizedQuery.length < 2) {
      return { items: [], generatedAt: new Date().toISOString() };
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        invoices: { some: { tenantId: actor.tenantId } },
        OR: [
          {
            studentSystemId: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            firstNameEn: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            lastNameEn: {
              contains: normalizedQuery,
              mode: 'insensitive',
            },
          },
          {
            invoices: {
              some: {
                tenantId: actor.tenantId,
                invoiceNumber: {
                  contains: normalizedQuery,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            guardianLinks: {
              some: {
                tenantId: actor.tenantId,
                guardian: {
                  tenantId: actor.tenantId,
                  primaryPhone: {
                    contains: normalizedQuery,
                    mode: 'insensitive',
                  },
                },
              },
            },
          },
        ],
      },
      include: {
        class: true,
        sectionRef: true,
        guardianLinks: {
          include: { guardian: true },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
        _count: { select: { invoices: true } },
      },
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
      take: 20,
    });

    return {
      items: students.map((student) => ({
        id: student.id,
        studentSystemId: student.studentSystemId,
        name: formatStudentName(student),
        className: student.class.name,
        sectionName: student.sectionRef?.name ?? null,
        guardianName: student.guardianLinks[0]?.guardian.fullName ?? null,
        guardianPhone: student.guardianLinks[0]?.guardian.primaryPhone ?? null,
        invoiceCount: student._count.invoices,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async getStudentFeeLedger(
    studentId: string,
    actor: AuthContext,
    filters?: {
      fromDate?: string;
      toDate?: string;
      academicYearId?: string;
      status?: string;
    },
  ) {
    const ledgerInvoiceStatus =
      filters?.status &&
      Object.values(InvoiceStatus).includes(filters.status as InvoiceStatus)
        ? (filters.status as InvoiceStatus)
        : undefined;

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
          ...(filters?.academicYearId
            ? { academicYearId: filters.academicYearId }
            : {}),
          ...(ledgerInvoiceStatus ? { status: ledgerInvoiceStatus } : {}),
          ...(filters?.fromDate || filters?.toDate
            ? {
                issuedAt: {
                  ...(filters.fromDate
                    ? { gte: new Date(filters.fromDate) }
                    : {}),
                  ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
                },
              }
            : {}),
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
          ...(filters?.academicYearId
            ? { academicYearId: filters.academicYearId }
            : {}),
          ...(filters?.fromDate || filters?.toDate
            ? {
                createdAt: {
                  ...(filters.fromDate
                    ? { gte: new Date(filters.fromDate) }
                    : {}),
                  ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
                },
              }
            : {}),
        },
        include: {
          feeHead: true,
          approvedBy: { select: { id: true, email: true } },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
    ]);

    const ledgerEvents: Array<{
      id: string;
      date: Date;
      type: 'INVOICE' | 'PAYMENT' | 'WAIVER' | 'REFUND' | 'REVERSAL';
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
          description: `${payment.method} payment for ${invoice.invoiceNumber}${payment.status === PaymentStatus.REVERSED ? ' (REVERSED)' : ''}`,
          debit: new Prisma.Decimal(0),
          credit: payment.amount,
          affectsBalance: true,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: payment.id,
          receiptNumber: payment.receipt?.receiptNumber ?? null,
          status: payment.status,
        });

        if (payment.status === PaymentStatus.REVERSED) {
          ledgerEvents.push({
            id: `reversal:${payment.id}`,
            date: payment.reversedAt ?? payment.paidAt,
            type: 'REVERSAL',
            reference: payment.receipt?.receiptNumber ?? payment.id,
            description: `REVERSAL: ${payment.reversalReason ?? 'Payment voided'}`,
            debit: payment.amount,
            credit: new Prisma.Decimal(0),
            affectsBalance: true,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentId: payment.id,
            receiptNumber: payment.receipt?.receiptNumber ?? null,
          });
        }

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
    const totalPaid = allPayments.reduce((sum, payment) => {
      if (payment.status === PaymentStatus.REVERSED) return sum;
      return sum.add(payment.amount);
    }, new Prisma.Decimal(0));
    const totalRefunded = allPayments.reduce((sum, payment) => {
      if (payment.status === PaymentStatus.REVERSED) return sum;
      return sum.add(sumRefundedAmount(payment.refunds));
    }, new Prisma.Decimal(0));
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

  async getStudentFeeLedgerPage(
    studentId: string,
    query: StudentFeeLedgerQueryDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'ledger:read');

    if (Boolean(query.fromDate) !== Boolean(query.toDate)) {
      throw new BadRequestException(
        'Both fromDate and toDate are required for a student ledger range.',
      );
    }

    const period =
      query.fromDate && query.toDate
        ? resolveFinanceSummaryPeriod(
            { fromDate: query.fromDate, toDate: query.toDate },
            NEPAL_TIME_ZONE,
          )
        : null;
    const ledger = await this.getStudentFeeLedger(studentId, actor, {
      academicYearId: query.academicYearId,
      status: query.invoiceStatus,
    });
    const matchingRows = ledger.rows.filter((row) => {
      const rowDate = new Date(row.date);
      return (
        (!period ||
          (rowDate >= period.startUtc && rowDate < period.endExclusiveUtc)) &&
        (!query.transactionType || row.type === query.transactionType)
      );
    });
    const orderedRows =
      query.sortDirection === 'asc'
        ? matchingRows
        : [...matchingRows].reverse();
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;
    const rows = orderedRows.slice(skip, skip + limit);

    return {
      ...ledger,
      rows,
      total: matchingRows.length,
      page,
      limit,
      hasNextPage: skip + rows.length < matchingRows.length,
      filters: {
        fromDate: query.fromDate ?? null,
        toDate: query.toDate ?? null,
        academicYearId: query.academicYearId ?? null,
        invoiceStatus: query.invoiceStatus ?? null,
        transactionType: query.transactionType ?? null,
        sortDirection: query.sortDirection ?? 'desc',
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async exportStudentFeeLedgerCsv(studentId: string, actor: AuthContext) {
    const ledger = await this.getStudentFeeLedger(studentId, actor);
    const headers = [
      'Date',
      'Type',
      'Reference',
      'Description',
      'Debit',
      'Credit',
      'Running Balance',
    ];

    const rows = ledger.rows.map((r) => ({
      Date: r.date.toISOString().split('T')[0],
      Type: r.type,
      Reference: r.reference,
      Description: r.description,
      Debit: r.debit,
      Credit: r.credit,
      'Running Balance': r.runningBalance,
    }));

    await this.auditService.record({
      action: 'export',
      resource: 'student_fee_ledger',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { studentId },
    });

    return toCsv(rows, headers);
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
    assertFinancePermission(actor, 'fees:adjust');
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException('Adjustment reason is required');
    }

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
          description: `Adjustment: ${reason}`,
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

      await this.accountingPostingService.postInvoiceAdjustment(
        {
          tenantId: actor.tenantId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          feeHeadId: feeHead.id,
          feeHeadCode: feeHead.code,
          amount: signedSubtotal.add(signedVat),
          reason,
        },
        actor,
        tx,
      );

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
        reason,
        subtotal: Number(result.invoice.subtotal),
        totalAmount: Number(result.invoice.totalAmount),
        status: result.invoice.status,
      },
    });

    return result;
  }

  async calculateLateFeesForTenant(tenantId: string) {
    const [enabledSetting, graceSetting, lateFeeHead] = await Promise.all([
      this.prisma.tenantSetting.findUnique({
        where: { tenantId_key: { tenantId, key: 'late_fee_enabled' } },
      }),
      this.prisma.tenantSetting.findUnique({
        where: { tenantId_key: { tenantId, key: 'late_fee_grace_days' } },
      }),
      this.prisma.feeHead.findFirst({
        where: {
          tenantId,
          code: 'LATEFEE',
          isActive: true,
        },
      }),
    ]);

    if (enabledSetting?.value !== true && enabledSetting?.value !== 'true') {
      return { disabled: true, applied: 0, skipped: 0 };
    }

    if (!lateFeeHead || new Prisma.Decimal(lateFeeHead.defaultAmount).lte(0)) {
      return { disabled: true, applied: 0, skipped: 0 };
    }

    const graceDays =
      typeof graceSetting?.value === 'number'
        ? Math.max(Math.floor(graceSetting.value), 0)
        : typeof graceSetting?.value === 'string'
          ? Math.max(Math.floor(Number(graceSetting.value)), 0) || 0
          : 0;
    const cutoff = startOfToday();
    cutoff.setDate(cutoff.getDate() - graceDays);

    const overdueInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        dueDate: { lt: cutoff },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      },
      include: {
        lines: true,
        payments: { include: { refunds: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    });

    let applied = 0;
    let skipped = 0;
    const amount = new Prisma.Decimal(lateFeeHead.defaultAmount);

    for (const invoice of overdueInvoices) {
      const paidAmount = sumNetPaidAmount(invoice.payments);
      if (invoice.totalAmount.sub(paidAmount).lte(0)) {
        skipped += 1;
        continue;
      }

      const alreadyApplied = invoice.lines.some(
        (line) =>
          line.feeHeadId === lateFeeHead.id &&
          line.description.startsWith('Automatic late fee'),
      );
      if (alreadyApplied) {
        skipped += 1;
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.invoiceLine.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            feeHeadId: lateFeeHead.id,
            description: `Automatic late fee for overdue invoice ${invoice.invoiceNumber}`,
            quantity: 1,
            unitAmount: amount,
            vatAmount: new Prisma.Decimal(0),
            totalAmount: amount,
          },
        });

        const newSubtotal = invoice.subtotal.add(amount);
        const newTotal = invoice.totalAmount.add(amount);
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: newSubtotal,
            totalAmount: newTotal,
            status: resolveInvoiceStatusAfterAdjustment(
              invoice.status,
              paidAmount,
              newTotal,
            ),
          },
        });
      });

      applied += 1;
    }

    await this.auditService.record({
      action: 'calculate_late_fees',
      resource: 'invoice',
      tenantId,
      userId: null,
      after: {
        applied,
        skipped,
        graceDays,
        cutoff: cutoff.toISOString(),
        lateFeeHeadId: lateFeeHead.id,
        amount: Number(amount),
      },
    });

    return { disabled: false, applied, skipped };
  }

  async listDefaulters(actor: AuthContext, filters: ListDefaultersDto = {}) {
    const today = new Date();
    const overdueFilter = resolveDefaulterOverdueFilter(filters, today);
    const pagination = resolveFinancePagination(filters);
    const search = filters.search?.trim();
    const where: Prisma.InvoiceWhereInput = {
      tenantId: actor.tenantId,
      dueDate: overdueFilter,
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
      ...(search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                student: {
                  is: {
                    OR: [
                      {
                        firstNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        studentSystemId: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] =
      filters.sortBy === 'studentName'
        ? [
            {
              student: {
                firstNameEn: filters.sortDirection ?? 'asc',
              },
            },
            { id: 'asc' },
          ]
        : [
            {
              [filters.sortBy === 'outstanding' ? 'totalAmount' : 'dueDate']:
                filters.sortDirection ?? 'asc',
            },
            { id: 'asc' },
          ];
    const [
      invoices,
      total,
      invoiceAmountAggregate,
      paymentAmountAggregate,
      refundAmountAggregate,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
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
        orderBy,
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.aggregate({
        where,
        _sum: { totalAmount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          tenantId: actor.tenantId,
          status: PaymentStatus.SUCCESS,
          invoice: where,
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.aggregate({
        where: {
          tenantId: actor.tenantId,
          payment: {
            status: PaymentStatus.SUCCESS,
            invoice: where,
          },
        },
        _sum: { amount: true },
      }),
    ]);

    const items = invoices
      .map((invoice) => {
        const paidAmount = Number(sumNetPaidAmount(invoice.payments));
        const outstanding = Number(invoice.totalAmount) - paidAmount;
        const daysOverdue = Math.max(
          0,
          Math.floor(
            (today.getTime() - invoice.dueDate.getTime()) / 86_400_000,
          ),
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
      })
      .filter((defaulter) => defaulter.outstanding > 0);

    return {
      filters: {
        classId: filters.classId ?? null,
        feeHeadId: filters.feeHeadId ?? null,
        agingBucket: filters.agingBucket ?? null,
        minDaysOverdue: filters.minDaysOverdue ?? null,
        maxDaysOverdue: filters.maxDaysOverdue ?? null,
      },
      total,
      page: pagination.page,
      limit: pagination.limit,
      hasNextPage: pagination.skip + items.length < total,
      totalOutstanding: Number(
        calculateOutstandingAmount(
          invoiceAmountAggregate._sum.totalAmount,
          paymentAmountAggregate._sum.amount,
          refundAmountAggregate._sum.amount,
        ),
      ),
      segments: buildDefaulterSegmentSummary(items),
      items,
    };
  }

  async sendDefaulterReminders(
    dto: SendDefaulterRemindersDto,
    actor: AuthContext,
  ) {
    const defaulterResult = await this.listDefaulters(actor, {
      classId: dto.classId,
      feeHeadId: dto.feeHeadId,
      agingBucket: dto.agingBucket,
      minDaysOverdue: dto.minDaysOverdue,
      maxDaysOverdue: dto.maxDaysOverdue,
      page: 1,
      limit: 100,
    });
    const defaulters = defaulterResult.items;
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
        title: `Fee payment reminder (${defaulter.agingBucket} overdue)`,
        body:
          dto.message ??
          `Outstanding fee balance Rs ${defaulter.outstanding.toFixed(
            2,
          )} is ${defaulter.daysOverdue} days overdue for invoice ${defaulter.invoiceNumber}.`,
        channels,
        requiredConsentTypes: [ConsentType.MESSAGING],
        communicationCategory: 'ESSENTIAL',
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
        filters: defaulterResult.filters,
        segments: buildDefaulterSegmentSummary(selectedDefaulters),
        channels,
      },
    });

    return {
      requested: dto.invoiceIds?.length ?? defaulters.length,
      reminded: selectedDefaulters.length,
      filters: defaulterResult.filters,
      segments: buildDefaulterSegmentSummary(selectedDefaulters),
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

  async createCanteenMealPlanInvoice(
    tx: Prisma.TransactionClient,
    input: {
      actor: AuthContext;
      studentId: string;
      mealPlanName: string;
      mealType: string;
      amount: Prisma.Decimal;
      dueDate: Date;
      servicePeriodStart: Date;
      servicePeriodEnd?: Date | null;
      sourceEnrollmentId: string;
    },
  ) {
    const academicYear = await tx.academicYear.findFirst({
      where: { tenantId: input.actor.tenantId, isCurrent: true },
      select: { id: true },
    });

    if (!academicYear) {
      throw new NotFoundException(
        'Current academic year is required for meal plan fee invoice',
      );
    }

    const feeHead = await tx.feeHead.upsert({
      where: {
        tenantId_code: { tenantId: input.actor.tenantId, code: 'MEALPLAN' },
      },
      update: {},
      create: {
        tenantId: input.actor.tenantId,
        name: 'Canteen Meal Plan',
        code: 'MEALPLAN',
        frequency: FeeFrequency.MONTHLY,
        defaultAmount: input.amount,
        vatApplicable: false,
      },
    });
    const invoiceNumber = await this.generateInvoiceNumber(
      input.actor.tenantId,
      resolveFiscalYear(input.dueDate),
      tx,
    );
    const serviceWindow = [
      input.servicePeriodStart.toISOString().slice(0, 10),
      input.servicePeriodEnd?.toISOString().slice(0, 10),
    ]
      .filter(Boolean)
      .join(' to ');
    const description = `Canteen meal plan: ${input.mealPlanName} (${input.mealType})${serviceWindow ? ` for ${serviceWindow}` : ''}`;

    const invoice = await tx.invoice.create({
      data: {
        tenantId: input.actor.tenantId,
        studentId: input.studentId,
        academicYearId: academicYear.id,
        invoiceNumber,
        fiscalYear: resolveFiscalYear(input.dueDate),
        billNumber: invoiceNumber,
        dueDate: input.dueDate,
        status: InvoiceStatus.ISSUED,
        subtotal: input.amount,
        vatAmount: new Prisma.Decimal(0),
        totalAmount: input.amount,
        lines: {
          create: {
            tenantId: input.actor.tenantId,
            feeHeadId: feeHead.id,
            description,
            unitAmount: input.amount,
            vatAmount: new Prisma.Decimal(0),
            totalAmount: input.amount,
          },
        },
      },
      include: {
        lines: { include: { feeHead: true } },
      },
    });

    await this.postInvoiceToLedger(invoice, input.actor, tx);

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      sourceEnrollmentId: input.sourceEnrollmentId,
    };
  }

  async collectPayment(dto: CollectPaymentDto, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:collect');
    const idempotencyKey = dto.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new BadRequestException(
        'An idempotency key is required to collect a payment.',
      );
    }
    const existingPayment = await this.prisma.payment.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: actor.tenantId,
          idempotencyKey,
        },
      },
      include: { receipt: true },
    });

    if (existingPayment) {
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'payment',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: existingPayment.id,
        after: {
          invoiceId: existingPayment.invoiceId,
          idempotencyKey,
        },
      });
      return mapCollectedPaymentResult(existingPayment, 'REPLAYED');
    }

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
          method: dto.method,
          referenceNumber: dto.referenceNumber.trim(),
          status: { not: PaymentStatus.REVERSED },
        },
      });

      if (duplicatePayment) {
        throw new ConflictException(
          `Payment reference ${dto.referenceNumber} has already been used for an active payment in this tenant`,
        );
      }
    }

    await this.usageService.checkLimit(actor.tenantId, 'receipts.generated', 1);

    const fiscalYear = resolveFiscalYear(new Date());
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: actor.tenantId },
    });

    let result: CollectedPaymentWithReceipt;

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const receiptNumber = await this.generateReceiptNumber(
          actor.tenantId,
          fiscalYear,
          tx,
        );

        const receiptVat = invoice.totalAmount.gt(0)
          ? invoice.vatAmount.mul(paymentAmount).div(invoice.totalAmount)
          : new Prisma.Decimal(0);
        const payment = await tx.payment.create({
          data: {
            tenantId: actor.tenantId,
            studentId: invoice.studentId,
            invoiceId: invoice.id,
            collectedById: actor.userId,
            method: dto.method,
            status: PaymentStatus.SUCCESS,
            referenceNumber: dto.referenceNumber ?? null,
            amount: paymentAmount,
            isAdvance: dto.isAdvance ?? false,
            recognizedAt: dto.recognizedAt ? new Date(dto.recognizedAt) : null,
            metadata: {
              remainingBeforePayment: Number(remaining),
            },
            paidAt: new Date(),
            narration: dto.narration ?? null,
            idempotencyKey,
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
                pdfUrl: null,
                fileStatus: ReceiptFileStatus.PENDING,
              },
            },
          },
          include: {
            receipt: true,
          },
        });

        await this.usageService.incrementUsage(
          actor.tenantId,
          'receipts.generated',
          1,
        );

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

        await Promise.all(
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

        await this.accountingPostingService.postFeePayment(
          {
            tenantId: actor.tenantId,
            paymentId: payment.id,
            invoiceNumber: invoice.invoiceNumber,
            receiptNumber,
            paymentAmount,
            paymentMethod: dto.method,
            paymentAccountCode: resolveCashAccountCode(dto.method),
            narration: dto.narration,
            lines: [], // Lines no longer needed for payment in accrual model
          },
          actor,
          tx,
        );

        return payment;
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        const existingPayment = await this.prisma.payment.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: actor.tenantId,
              idempotencyKey,
            },
          },
          include: { receipt: true },
        });

        if (existingPayment) {
          await this.auditService.record({
            action: 'idempotent_replay',
            resource: 'payment',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: existingPayment.id,
            after: {
              invoiceId: existingPayment.invoiceId,
              idempotencyKey,
              concurrent: true,
            },
          });
          return mapCollectedPaymentResult(existingPayment, 'REPLAYED');
        }
      }

      throw error;
    }

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

    return mapCollectedPaymentResult(result, 'SUCCEEDED');
  }

  async requestRefund(
    paymentId: string,
    dto: CreateFinanceRequestDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:collect');
    const idempotencyKey = dto.idempotencyKey.trim();
    const replay = await this.prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
      },
      include: {
        payment: true,
        requestedBy: { select: { id: true, email: true } },
        history: { orderBy: [{ createdAt: 'asc' }] },
      },
    });
    if (replay) {
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'finance_approval_request',
        resourceId: replay.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          paymentId: replay.paymentId,
          type: replay.type,
        },
      });
      return { ...replay, disposition: 'REPLAYED' as const };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found in this tenant');
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new ConflictException('Reversed payments cannot be refunded');
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

    // Check for pending requests
    const pendingRequest = await this.prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        paymentId,
        status: FinanceRequestStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new ConflictException(
        'A pending approval request already exists for this payment',
      );
    }

    let request;
    try {
      request = await this.prisma.financeApprovalRequest.create({
        data: {
          tenantId: actor.tenantId,
          type: FinanceRequestType.REFUND,
          paymentId,
          idempotencyKey,
          amount: refundAmount,
          reason: dto.reason.trim(),
          status: FinanceRequestStatus.PENDING,
          requestedById: actor.userId,
          history: {
            create: {
              tenantId: actor.tenantId,
              action: FinanceRequestHistoryAction.REQUESTED,
              status: FinanceRequestStatus.PENDING,
              actorUserId: actor.userId,
              note: dto.reason.trim(),
            },
          },
        },
        include: {
          payment: true,
          requestedBy: { select: { id: true, email: true } },
          history: true,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
      const concurrentReplay =
        await this.prisma.financeApprovalRequest.findFirst({
          where: {
            tenantId: actor.tenantId,
            idempotencyKey,
          },
          include: {
            payment: true,
            requestedBy: { select: { id: true, email: true } },
            history: { orderBy: [{ createdAt: 'asc' }] },
          },
        });
      if (!concurrentReplay) {
        throw new ConflictException(
          'The refund request could not be recorded safely. Retry with the same request key.',
        );
      }
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'finance_approval_request',
        resourceId: concurrentReplay.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          paymentId: concurrentReplay.paymentId,
          type: concurrentReplay.type,
          concurrent: true,
        },
      });
      return { ...concurrentReplay, disposition: 'REPLAYED' as const };
    }

    await this.auditService.record({
      action: 'create',
      resource: 'finance_approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        paymentId,
        type: FinanceRequestType.REFUND,
        amount: Number(refundAmount),
        reason: dto.reason,
      },
    });

    return { ...request, disposition: 'SUCCEEDED' as const };
  }

  async requestReversal(
    paymentId: string,
    dto: CreateFinanceRequestDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:collect');
    const idempotencyKey = dto.idempotencyKey.trim();
    const replay = await this.prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
      },
      include: {
        payment: true,
        requestedBy: { select: { id: true, email: true } },
        history: { orderBy: [{ createdAt: 'asc' }] },
      },
    });
    if (replay) {
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'finance_approval_request',
        resourceId: replay.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          paymentId: replay.paymentId,
          type: replay.type,
        },
      });
      return { ...replay, disposition: 'REPLAYED' as const };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found in this tenant');
    }

    if (payment.status === PaymentStatus.REVERSED) {
      throw new ConflictException('Payment is already reversed');
    }

    if (payment.refunds.length > 0) {
      throw new ConflictException(
        'Cannot reverse a payment that has been partially or fully refunded',
      );
    }

    // Check for pending requests
    const pendingRequest = await this.prisma.financeApprovalRequest.findFirst({
      where: {
        tenantId: actor.tenantId,
        paymentId,
        status: FinanceRequestStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new ConflictException(
        'A pending approval request already exists for this payment',
      );
    }

    let request;
    try {
      request = await this.prisma.financeApprovalRequest.create({
        data: {
          tenantId: actor.tenantId,
          type: FinanceRequestType.REVERSAL,
          paymentId,
          idempotencyKey,
          amount: null,
          reason: dto.reason.trim(),
          status: FinanceRequestStatus.PENDING,
          requestedById: actor.userId,
          history: {
            create: {
              tenantId: actor.tenantId,
              action: FinanceRequestHistoryAction.REQUESTED,
              status: FinanceRequestStatus.PENDING,
              actorUserId: actor.userId,
              note: dto.reason.trim(),
            },
          },
        },
        include: {
          payment: true,
          requestedBy: { select: { id: true, email: true } },
          history: true,
        },
      });
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
      const concurrentReplay =
        await this.prisma.financeApprovalRequest.findFirst({
          where: {
            tenantId: actor.tenantId,
            idempotencyKey,
          },
          include: {
            payment: true,
            requestedBy: { select: { id: true, email: true } },
            history: { orderBy: [{ createdAt: 'asc' }] },
          },
        });
      if (!concurrentReplay) {
        throw new ConflictException(
          'The reversal request could not be recorded safely. Retry with the same request key.',
        );
      }
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'finance_approval_request',
        resourceId: concurrentReplay.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          paymentId: concurrentReplay.paymentId,
          type: concurrentReplay.type,
          concurrent: true,
        },
      });
      return { ...concurrentReplay, disposition: 'REPLAYED' as const };
    }

    await this.auditService.record({
      action: 'create',
      resource: 'finance_approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        paymentId,
        type: FinanceRequestType.REVERSAL,
        reason: dto.reason,
      },
    });

    return { ...request, disposition: 'SUCCEEDED' as const };
  }

  async listApprovalRequests(
    query: ListFinanceApprovalRequestsQueryDto,
    actor: AuthContext,
  ) {
    // Permission: either refund or reverse allows listing requests
    const hasRefundPerm = actor.permissions.includes('payments:refund');
    const hasReversePerm = actor.permissions.includes('payments:reverse');
    const hasAdmin = actor.roles.includes('admin');
    if (!hasRefundPerm && !hasReversePerm && !hasAdmin) {
      throw new ForbiddenException(
        'You do not have permission to view approval requests',
      );
    }

    const pagination = resolveFinancePagination(query);
    const search = query.search?.trim();
    const where: Prisma.FinanceApprovalRequestWhereInput = {
      tenantId: actor.tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              {
                payment: {
                  is: {
                    OR: [
                      {
                        referenceNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        student: {
                          is: {
                            OR: [
                              {
                                firstNameEn: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                              {
                                lastNameEn: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                              {
                                studentSystemId: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'createdAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [items, total] = await Promise.all([
      this.prisma.financeApprovalRequest.findMany({
        where,
        include: {
          payment: {
            include: {
              student: true,
              invoice: true,
            },
          },
          requestedBy: { select: { id: true, email: true } },
          reviewedBy: { select: { id: true, email: true } },
          history: {
            orderBy: [{ createdAt: 'asc' }],
          },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.financeApprovalRequest.count({ where }),
    ]);
    return buildFinancePage(items, total, pagination);
  }

  async reviewApprovalRequest(
    requestId: string,
    dto: ReviewFinanceRequestDto,
    actor: AuthContext,
  ) {
    const request = await this.prisma.financeApprovalRequest.findFirst({
      where: { id: requestId, tenantId: actor.tenantId },
    });

    if (!request) {
      throw new NotFoundException('Approval request not found');
    }

    if (request.status !== FinanceRequestStatus.PENDING) {
      throw new ConflictException('This request has already been reviewed');
    }

    // Gate by specific action permission
    if (request.type === FinanceRequestType.REFUND) {
      assertFinancePermission(actor, 'payments:refund');
    } else {
      assertFinancePermission(actor, 'payments:reverse');
    }
    if (
      request.requestedById === actor.userId &&
      !actor.roles.includes('platform_super_admin')
    ) {
      throw new ForbiddenException(
        'A finance request must be reviewed by a different authorized user.',
      );
    }
    const reviewNote = dto.reviewNote?.trim() || null;
    if (dto.status === FinanceRequestStatus.REJECTED && !reviewNote) {
      throw new BadRequestException(
        'A review note is required to reject a finance request.',
      );
    }

    if (dto.status === FinanceRequestStatus.REJECTED) {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.financeApprovalRequest.updateMany({
          where: {
            id: request.id,
            tenantId: actor.tenantId,
            status: FinanceRequestStatus.PENDING,
          },
          data: {
            status: FinanceRequestStatus.REJECTED,
            reviewedById: actor.userId,
            reviewedAt: new Date(),
            reviewNote,
            failureMessage: null,
          },
        });
        if (claim.count !== 1) {
          throw new ConflictException(
            'This finance request was already reviewed.',
          );
        }
        await tx.financeApprovalRequestHistory.create({
          data: {
            tenantId: actor.tenantId,
            requestId: request.id,
            action: FinanceRequestHistoryAction.REJECTED,
            status: FinanceRequestStatus.REJECTED,
            actorUserId: actor.userId,
            note: reviewNote,
          },
        });
        return tx.financeApprovalRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: {
            payment: true,
            requestedBy: { select: { id: true, email: true } },
            reviewedBy: { select: { id: true, email: true } },
            history: { orderBy: [{ createdAt: 'asc' }] },
          },
        });
      });
      await this.auditService.record({
        action: 'reject',
        resource: 'finance_approval_request',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: request.id,
        after: { status: rejected.status, reviewNote },
      });
      return rejected;
    }

    const claim = await this.prisma.financeApprovalRequest.updateMany({
      where: {
        id: request.id,
        tenantId: actor.tenantId,
        status: FinanceRequestStatus.PENDING,
      },
      data: {
        status: FinanceRequestStatus.PROCESSING,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        reviewNote,
        failureMessage: null,
      },
    });
    if (claim.count !== 1) {
      throw new ConflictException('This finance request was already reviewed.');
    }
    await this.prisma.financeApprovalRequestHistory.create({
      data: {
        tenantId: actor.tenantId,
        requestId: request.id,
        action: FinanceRequestHistoryAction.REVIEW_STARTED,
        status: FinanceRequestStatus.PROCESSING,
        actorUserId: actor.userId,
        note: reviewNote,
      },
    });

    try {
      const executionIdempotencyKey = `finance-request:${request.id}`;
      if (request.type === FinanceRequestType.REFUND) {
        await this.refundPayment(
          request.paymentId,
          {
            amount: request.amount ? Number(request.amount) : undefined,
            reason: request.reason,
            idempotencyKey: executionIdempotencyKey,
          },
          actor,
        );
      } else {
        await this.reversePayment(
          request.paymentId,
          {
            reason: request.reason,
            idempotencyKey: executionIdempotencyKey,
          },
          actor,
        );
      }
    } catch {
      await this.prisma.$transaction([
        this.prisma.financeApprovalRequest.update({
          where: { id: request.id },
          data: {
            status: FinanceRequestStatus.FAILED,
            failureMessage:
              'The approved correction could not be executed safely. Review the payment state before retrying.',
          },
        }),
        this.prisma.financeApprovalRequestHistory.create({
          data: {
            tenantId: actor.tenantId,
            requestId: request.id,
            action: FinanceRequestHistoryAction.EXECUTION_FAILED,
            status: FinanceRequestStatus.FAILED,
            actorUserId: actor.userId,
            note: 'Execution failed safely; no raw provider or database detail was recorded.',
          },
        }),
      ]);
      throw new ConflictException(
        'The approved correction could not be executed safely. Review the payment state before retrying.',
      );
    }

    const updated = await this.prisma.financeApprovalRequest.update({
      where: { id: request.id },
      data: {
        status: FinanceRequestStatus.EXECUTED,
        failureMessage: null,
        history: {
          create: [
            {
              tenantId: actor.tenantId,
              action: FinanceRequestHistoryAction.APPROVED,
              status: FinanceRequestStatus.APPROVED,
              actorUserId: actor.userId,
              note: reviewNote,
            },
            {
              tenantId: actor.tenantId,
              action: FinanceRequestHistoryAction.EXECUTED,
              status: FinanceRequestStatus.EXECUTED,
              actorUserId: actor.userId,
              note: 'Approved correction executed idempotently.',
            },
          ],
        },
      },
      include: {
        payment: true,
        requestedBy: { select: { id: true, email: true } },
        reviewedBy: { select: { id: true, email: true } },
        history: { orderBy: [{ createdAt: 'asc' }] },
      },
    });

    await this.auditService.record({
      action: 'review',
      resource: 'finance_approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        status: updated.status,
        reviewNote: updated.reviewNote,
        reviewedAt: updated.reviewedAt,
      },
    });

    return updated;
  }

  async refundPayment(
    paymentId: string,
    dto: CreatePaymentRefundDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:refund');
    const reason = dto.reason?.trim();
    const idempotencyKey = dto.idempotencyKey.trim();

    if (!reason) {
      throw new BadRequestException('Refund reason is required');
    }

    const existingRefund = await this.prisma.paymentRefund.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey,
      },
      include: {
        payment: {
          include: {
            invoice: true,
            refunds: true,
          },
        },
      },
    });
    if (existingRefund) {
      const journalEntry = await this.prisma.journalEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceType: JournalSourceType.PAYMENT_REFUND,
          sourceId: existingRefund.id,
        },
        select: { entryNumber: true },
      });
      const refundedAmount = sumRefundedAmount(existingRefund.payment.refunds);
      return {
        refundId: existingRefund.id,
        refundNumber: existingRefund.refundNumber,
        paymentId: existingRefund.paymentId,
        invoiceId: existingRefund.payment.invoiceId,
        amount: Number(existingRefund.amount),
        refundDate: existingRefund.refundDate,
        journalEntryNumber: journalEntry?.entryNumber ?? null,
        remainingRefundableAmount: Number(
          Prisma.Decimal.max(
            new Prisma.Decimal(0),
            existingRefund.payment.amount.sub(refundedAmount),
          ),
        ),
        invoiceStatus: existingRefund.payment.invoice.status,
        disposition: 'REPLAYED' as const,
      };
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

    const closedWindow = await this.prisma.cashierClose.findFirst({
      where: {
        tenantId: actor.tenantId,
        openedAt: { lte: payment.paidAt },
        closedAt: { gte: payment.paidAt },
        OR: [
          { collectorUserId: null },
          { collectorUserId: payment.collectedById },
        ],
        AND: [
          {
            OR: [{ paymentMethod: null }, { paymentMethod: payment.method }],
          },
        ],
      },
      select: { id: true, closeNumber: true },
    });
    if (closedWindow) {
      throw new ConflictException(
        'This cashier day is already closed. Record an approved correction instead.',
      );
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

    const reversedDebitLines = allocateJournalLinesForRefund(
      sourceJournal.lines.filter(
        (line) => line.side === JournalLineSide.CREDIT,
      ),
      refundAmount,
      payment.amount,
      JournalLineSide.DEBIT,
      actor.tenantId,
    );

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "Payment"
        WHERE "id" = ${payment.id}
          AND "tenantId" = ${actor.tenantId}
        FOR UPDATE
      `);
        const currentPayment = await tx.payment.findFirst({
          where: {
            id: payment.id,
            tenantId: actor.tenantId,
          },
          select: { status: true },
        });
        if (
          !currentPayment ||
          currentPayment.status === PaymentStatus.REVERSED
        ) {
          throw new ConflictException(
            'This payment is no longer eligible for a refund.',
          );
        }
        const currentRefunds = await tx.paymentRefund.findMany({
          where: {
            tenantId: actor.tenantId,
            paymentId: payment.id,
          },
          select: { amount: true },
        });
        const currentRefundableAmount = payment.amount.sub(
          sumRefundedAmount(currentRefunds),
        );
        if (
          currentRefundableAmount.lte(0) ||
          refundAmount.gt(currentRefundableAmount)
        ) {
          throw new ConflictException(
            'Another refund already changed the remaining refundable amount. Refresh and review the payment before retrying.',
          );
        }

        const refundNumber = await this.generateRefundNumber(
          actor.tenantId,
          tx,
        );
        const refund = await tx.paymentRefund.create({
          data: {
            tenantId: actor.tenantId,
            paymentId: payment.id,
            refundNumber,
            amount: refundAmount,
            refundDate,
            reason,
            idempotencyKey,
            referenceNumber: dto.referenceNumber?.trim() || null,
            narration: dto.narration?.trim() || null,
            createdById: actor.userId,
          },
        });

        const journalEntry =
          await this.accountingPostingService.postPaymentRefund(
            {
              tenantId: actor.tenantId,
              refundId: refund.id,
              paymentId: payment.id,
              amount: refundAmount,
              reason,
              paymentMethod: payment.method,
              paymentAccountCode: resolveCashAccountCode(payment.method),
              entryDate: refundDate,
              lines: reversedDebitLines.map((line) => ({
                chartAccountId: line.chartAccountId,
                amount: line.amount,
                description: line.description ?? 'Payment refund reversal',
              })),
            },
            actor,
            tx,
          );

        const netPaidAmount = sumNetPaidAmount(
          payment.invoice.payments.map((invoicePayment) =>
            invoicePayment.id === payment.id
              ? {
                  ...invoicePayment,
                  refunds: [
                    ...invoicePayment.refunds,
                    { amount: refundAmount },
                  ],
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
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
      const concurrentReplay = await this.prisma.paymentRefund.findFirst({
        where: {
          tenantId: actor.tenantId,
          idempotencyKey,
        },
        include: {
          payment: {
            include: {
              invoice: true,
              refunds: true,
            },
          },
        },
      });
      if (!concurrentReplay) {
        throw new ConflictException(
          'The refund could not be recorded safely. Retry with the same request key.',
        );
      }
      const journalEntry = await this.prisma.journalEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceType: JournalSourceType.PAYMENT_REFUND,
          sourceId: concurrentReplay.id,
        },
        select: { entryNumber: true },
      });
      const concurrentRefundedAmount = sumRefundedAmount(
        concurrentReplay.payment.refunds,
      );
      return {
        refundId: concurrentReplay.id,
        refundNumber: concurrentReplay.refundNumber,
        paymentId: concurrentReplay.paymentId,
        invoiceId: concurrentReplay.payment.invoiceId,
        amount: Number(concurrentReplay.amount),
        refundDate: concurrentReplay.refundDate,
        journalEntryNumber: journalEntry?.entryNumber ?? null,
        remainingRefundableAmount: Number(
          Prisma.Decimal.max(
            new Prisma.Decimal(0),
            concurrentReplay.payment.amount.sub(concurrentRefundedAmount),
          ),
        ),
        invoiceStatus: concurrentReplay.payment.invoice.status,
        disposition: 'REPLAYED' as const,
      };
    }

    await this.auditService.record({
      action: 'refund',
      resource: 'payment_refund',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: result.refund.id,
      before: {
        paymentId: payment.id,
        amount: Number(payment.amount),
      },
      after: {
        refundId: result.refund.id,
        amount: Number(result.refund.amount),
        status: result.updatedInvoice.status,
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
      disposition: 'SUCCEEDED' as const,
    };
  }

  async reversePayment(
    paymentId: string,
    dto: ReversePaymentDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:reverse');
    if (this.entitlementsService) {
      await this.entitlementsService.assertFeatureEnabled(
        actor.tenantId,
        'feature.fees.reversals',
      );
    }
    const reason = dto.reason?.trim();
    const idempotencyKey = dto.idempotencyKey.trim();

    if (!reason) {
      throw new BadRequestException(
        'A reason is required to reverse this payment.',
      );
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId: actor.tenantId },
      include: {
        invoice: true,
        refunds: true,
        receipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found in this tenant');
    }

    if (
      payment.reversalIdempotencyKey === idempotencyKey &&
      (payment.status === PaymentStatus.REVERSED || payment.reversedAt)
    ) {
      return {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        status: payment.status,
        reversedAt: payment.reversedAt,
        reversalReason: payment.reversalReason,
        disposition: 'REPLAYED' as const,
      };
    }

    if (payment.status === PaymentStatus.REVERSED || payment.reversedAt) {
      throw new ConflictException('This payment is already reversed.');
    }

    if (payment.refunds.length > 0) {
      throw new ConflictException(
        'Cannot reverse a payment that has been partially or fully refunded. Void the refunds first.',
      );
    }

    const closedWindow = await this.prisma.cashierClose.findFirst({
      where: {
        tenantId: actor.tenantId,
        openedAt: { lte: payment.paidAt },
        closedAt: { gte: payment.paidAt },
        OR: [
          { collectorUserId: null },
          { collectorUserId: payment.collectedById },
        ],
        AND: [
          {
            OR: [{ paymentMethod: null }, { paymentMethod: payment.method }],
          },
        ],
      },
      select: { id: true, closeNumber: true },
    });

    if (closedWindow) {
      throw new ConflictException(
        'This cashier day is already closed. Please contact an administrator.',
      );
    }

    const sourceJournal = await this.prisma.journalEntry.findFirst({
      where: {
        tenantId: actor.tenantId,
        sourceType: JournalSourceType.FEE_PAYMENT,
        sourceId: payment.id,
      },
      include: { lines: true },
    });

    if (!sourceJournal) {
      throw new ConflictException(
        'No accounting journal found for this payment',
      );
    }

    await this.auditService.record({
      action: 'reversal_requested',
      resource: 'payment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: payment.id,
      before: {
        invoiceId: payment.invoiceId,
        amount: Number(payment.amount),
        receiptNumber: payment.receipt?.receiptNumber ?? null,
      },
      after: { reason },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.payment.updateMany({
        where: {
          id: payment.id,
          tenantId: actor.tenantId,
          status: { not: PaymentStatus.REVERSED },
          reversedAt: null,
        },
        data: {
          status: PaymentStatus.REVERSED,
          reversedAt: new Date(),
          reversedById: actor.userId,
          reversalReason: reason,
          reversalIdempotencyKey: idempotencyKey,
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException(
          'This payment was already reversed or is being reversed.',
        );
      }

      const reversal = await this.accountingPostingService.postReversal(
        {
          tenantId: actor.tenantId,
          originalEntryId: sourceJournal.id,
          reversalDate: new Date(),
          narration: `Voiding Payment ${payment.receipt?.receiptNumber ?? payment.id}: ${reason}`,
          reason,
          lines: sourceJournal.lines.map((line) => ({
            chartAccountId: line.chartAccountId,
            side:
              line.side === JournalLineSide.DEBIT
                ? JournalLineSide.CREDIT
                : JournalLineSide.DEBIT,
            amount: line.amount,
            description: `Reversal of ${sourceJournal.entryNumber}`,
          })),
        },
        actor,
        tx,
      );

      const remainingPayments = await tx.payment.findMany({
        where: {
          tenantId: actor.tenantId,
          invoiceId: payment.invoiceId,
          status: { not: PaymentStatus.REVERSED },
        },
      });
      const paidSoFar = remainingPayments.reduce(
        (sum, p) => sum.add(p.amount),
        new Prisma.Decimal(0),
      );

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: paidSoFar.gt(0)
            ? InvoiceStatus.PARTIAL
            : InvoiceStatus.ISSUED,
          paidAt: paidSoFar.gt(0) ? payment.invoice.paidAt : null,
        },
      });

      return { reversal };
    });

    await this.auditService.record({
      action: 'reversal_completed',
      resource: 'payment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: paymentId,
      after: {
        invoiceId: payment.invoiceId,
        amount: Number(payment.amount),
        reason,
      },
    });

    return {
      paymentId: payment.id,
      invoiceId: payment.invoiceId,
      status: PaymentStatus.REVERSED,
      reversalEntryNumber: result.reversal.entryNumber,
      disposition: 'SUCCEEDED' as const,
    };
  }

  async previewCashierClose(query: CashierCloseWindowDto, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:close');
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
        expectedCashAmount: summary.expectedCashAmount,
        methodBreakdown: summary.methodBreakdown,
      },
    });

    return summary;
  }

  async listCashierCloses(query: ListCashierClosesDto, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:close');
    const pagination = resolveFinancePagination(query);
    const where: Prisma.CashierCloseWhereInput = {
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
    };
    const sortBy = query.sortBy ?? 'closedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [closes, total] = await Promise.all([
      this.prisma.cashierClose.findMany({
        where,
        include: {
          collectorUser: { select: { id: true, email: true } },
          closedBy: { select: { id: true, email: true } },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.cashierClose.count({ where }),
    ]);

    const pdfFilesByCloseId = await this.getCashierClosePdfFilesByCloseId(
      actor.tenantId,
      closes.map((close) => close.id),
    );

    return buildFinancePage(
      closes.map((close) =>
        this.buildCashierCloseResponse(close, pdfFilesByCloseId.get(close.id)),
      ),
      total,
      pagination,
    );
  }

  async finalizeCashierClose(dto: CreateCashierCloseDto, actor: AuthContext) {
    assertFinancePermission(actor, 'payments:close');
    if (this.entitlementsService) {
      await this.entitlementsService.assertFeatureEnabled(
        actor.tenantId,
        'feature.fees.cashier_close',
      );
    }
    const window = resolveWindow(dto.openedAt, dto.closedAt);
    const closeWindowKey = buildCashierCloseWindowKey({
      openedAt: window.openedAt,
      closedAt: window.closedAt,
      collectorUserId: dto.collectorUserId,
      paymentMethod: dto.paymentMethod,
    });
    const exactExisting = await this.prisma.cashierClose.findFirst({
      where: {
        tenantId: actor.tenantId,
        closeWindowKey,
      },
    });

    if (exactExisting) {
      throw new ConflictException(
        'This cashier window is already closed for today.',
      );
    }

    const existing = await this.prisma.cashierClose.findFirst({
      where: {
        tenantId: actor.tenantId,
        collectorUserId: dto.collectorUserId ?? null,
        openedAt: { lt: window.closedAt },
        closedAt: { gt: window.openedAt },
        ...(dto.paymentMethod
          ? {
              AND: [
                {
                  OR: [
                    { paymentMethod: null },
                    { paymentMethod: dto.paymentMethod },
                  ],
                },
              ],
            }
          : {}),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Cashier close ${existing.closeNumber} already overlaps the selected window`,
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
    const actualCashAmount =
      dto.actualCashAmount === undefined || dto.actualCashAmount === null
        ? null
        : new Prisma.Decimal(Number(dto.actualCashAmount).toFixed(2));
    const expectedCashAmount = new Prisma.Decimal(
      Number(summary.expectedCashAmount).toFixed(2),
    );
    const varianceAmount = actualCashAmount
      ? new Prisma.Decimal(
          Number(actualCashAmount.sub(expectedCashAmount)).toFixed(2),
        )
      : null;
    const hasCashVariance = Boolean(
      varianceAmount && Math.abs(Number(varianceAmount)) > 0,
    );

    if (hasCashVariance && !dto.varianceReason?.trim()) {
      throw new BadRequestException(
        'A variance reason is required when actual cash differs from expected cash',
      );
    }

    let close: CashierCloseWithUsers;

    try {
      close = await this.prisma.$transaction(async (tx) => {
        const duplicate = await tx.cashierClose.findFirst({
          where: {
            tenantId: actor.tenantId,
            closeWindowKey,
          },
          select: { id: true },
        });

        if (duplicate) {
          throw new ConflictException(
            'This cashier window is already closed for today.',
          );
        }

        const closeNumber = await this.generateCashierCloseNumber(
          actor.tenantId,
          tx,
        );

        return tx.cashierClose.create({
          data: {
            tenantId: actor.tenantId,
            closeNumber,
            closeWindowKey,
            openedAt: window.openedAt,
            closedAt: window.closedAt,
            collectorUserId: dto.collectorUserId ?? null,
            paymentMethod: dto.paymentMethod ?? null,
            grossCollected: new Prisma.Decimal(summary.grossCollected),
            totalRefunded: new Prisma.Decimal(summary.totalRefunded),
            netCollected: new Prisma.Decimal(summary.netCollected),
            expectedCashAmount,
            actualCashAmount,
            varianceAmount,
            varianceReason: hasCashVariance ? dto.varianceReason?.trim() : null,
            denominationBreakdown:
              (dto.denominationBreakdown as
                | Prisma.InputJsonValue
                | undefined) ?? Prisma.JsonNull,
            methodBreakdown: summary.methodBreakdown,

            paymentCount: summary.paymentCount,
            refundCount: summary.refundCount,
            firstReceiptNumber: summary.firstReceiptNumber,
            lastReceiptNumber: summary.lastReceiptNumber,
            notes: dto.notes ?? null,
            closedById: actor.userId,
          },
          include: {
            collectorUser: { select: { id: true, email: true } },
            closedBy: { select: { id: true, email: true } },
          },
        });
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        throw new ConflictException(
          'This cashier window is already closed for today.',
        );
      }

      throw error;
    }

    const school = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });
    const schoolName = school?.name || 'SchoolOS';
    const logo = await loadSchoolLogoForPdf(
      this.prisma,
      this.fileRegistryService,
      actor,
    );

    const methodBreakdown = parseCashierCloseMethodBreakdown(
      close.methodBreakdown,
    );

    const closePdf = buildCashierClosePdf({
      schoolName,
      closeNumber: close.closeNumber,
      openedAt: close.openedAt,
      closedAt: close.closedAt,
      collectorName: close.collectorUser?.email ?? 'System',
      paymentMethod: close.paymentMethod,
      methodBreakdown,
      grossCollected: Number(close.grossCollected),
      totalRefunded: Number(close.totalRefunded),
      netCollected: Number(close.netCollected),
      expectedCashAmount: Number(close.expectedCashAmount ?? 0),
      actualCashAmount:
        close.actualCashAmount === null ? null : Number(close.actualCashAmount),
      varianceAmount:
        close.varianceAmount === null ? null : Number(close.varianceAmount),
      varianceReason: close.varianceReason,
      paymentCount: close.paymentCount,
      refundCount: close.refundCount,
      firstReceiptNumber: close.firstReceiptNumber,
      lastReceiptNumber: close.lastReceiptNumber,
      notes: close.notes,
      closedByName: close.closedBy?.email ?? 'System',
      logo,
    });

    let fileAssetId: string | null = null;
    let closePdfFile: CashierClosePdfFileSummary | null = null;
    if (this.fileRegistryService) {
      const asset = await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: `DayEndClose_${close.closeNumber}.pdf`,
        content: closePdf,
        mimeType: 'application/pdf',
        module: 'fees',
        entityId: close.id,
        metadata: {
          kind: 'cashier_close_pdf',
          closeId: close.id,
          closeNumber: close.closeNumber,
        },
      });
      fileAssetId = asset.id;
      closePdfFile = mapCashierClosePdfFile(asset);
    }

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
        expectedCashAmount: Number(close.expectedCashAmount ?? 0),
        actualCashAmount:
          close.actualCashAmount === null
            ? null
            : Number(close.actualCashAmount),
        varianceAmount:
          close.varianceAmount === null ? null : Number(close.varianceAmount),
        varianceReason: close.varianceReason,
        fileAssetId,
      },
    });

    return {
      ...this.buildCashierCloseResponse(close, closePdfFile),
    };
  }

  async reopenCashierClose(
    closeId: string,
    dto: { reason: string },
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:close');
    const reason = dto.reason?.trim();

    if (!reason) {
      throw new BadRequestException(
        'A reason is required to reopen this close.',
      );
    }

    const close = await this.prisma.cashierClose.findFirst({
      where: { id: closeId, tenantId: actor.tenantId },
    });

    if (!close) {
      throw new NotFoundException('Cashier close not found');
    }
    await this.auditService.record({
      action: 'reopen_denied',
      resource: 'cashier_close',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: closeId,
      after: {
        closeNumber: close.closeNumber,
        reason,
        immutable: true,
      },
    });
    throw new ConflictException(
      'Finalized cashier closes are immutable. Record a separately approved correction instead.',
    );
  }

  async runFinanceConsistencyCheck(actor: AuthContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId: actor.tenantId,
        paidAt: { gte: today },
        status: { not: PaymentStatus.REVERSED },
      },
    });

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        tenantId: actor.tenantId,
        entryDate: { gte: today },
        sourceType: {
          in: [JournalSourceType.FEE_PAYMENT, JournalSourceType.PAYMENT_REFUND],
        },
      },
      include: { lines: true },
    });

    const paymentTotal = payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0),
    );
    const journalTotal = journalEntries.reduce((sum, entry) => {
      const cashLine = entry.lines.find((l) => l.debit.gt(0));
      return sum.add(cashLine?.debit ?? 0);
    }, new Prisma.Decimal(0));

    const isConsistent = paymentTotal.eq(journalTotal);

    const result = {
      timestamp: new Date(),
      paymentTotal: Number(paymentTotal),
      journalTotal: Number(journalTotal),
      isConsistent,
      discrepancy: Number(paymentTotal.sub(journalTotal)),
    };

    await this.auditService.record({
      action: 'reconcile',
      resource: 'finance_daily',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: result,
    });

    return result;
  }

  async getReconciliationSummary(
    query: ReconciliationQueryDto,
    actor: AuthContext,
  ) {
    assertAnyFinancePermission(actor, [
      'payments:close',
      'fees:manage',
      'accounting:read',
    ]);
    const rows = await this.buildReconciliationRows(query, actor);
    const methodSummary = buildPaymentMethodReconciliation(rows);

    return {
      openedAt: query.openedAt,
      closedAt: query.closedAt,
      totalRows: rows.length,
      grossCollected: rows.reduce((sum, row) => sum + row.grossAmount, 0),
      totalRefunded: rows.reduce((sum, row) => sum + row.refundedAmount, 0),
      netCollected: rows.reduce((sum, row) => sum + row.netAmount, 0),
      methodSummary,
      varianceTotal: methodSummary.reduce((sum, row) => sum + row.variance, 0),
      rows,
    };
  }

  async exportReconciliation(
    query: ReconciliationQueryDto,
    actor: AuthContext,
  ) {
    assertAnyFinancePermission(actor, [
      'payments:close',
      'fees:manage',
      'accounting:read',
    ]);
    const rows = await this.buildReconciliationRows(query, actor);
    const csv = buildReconciliationCsv(rows);
    const generatedAt = new Date();
    const payload = {
      generatedAt: generatedAt.toISOString(),
      openedAt: query.openedAt,
      closedAt: query.closedAt,
      totalRows: rows.length,
      methodSummary: buildPaymentMethodReconciliation(rows),
      rows,
    };

    if (query.format === ReconciliationExportFormat.JSON) {
      return payload;
    }

    if (this.fileRegistryService) {
      await this.fileRegistryService.registerGeneratedFile({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: `payment-method-reconciliation-${generatedAt.toISOString().slice(0, 10)}.csv`,
        content: Buffer.from(csv),
        mimeType: 'text/csv',
        module: 'fees',
        metadata: {
          kind: 'payment_method_reconciliation_export',
          generatedAt: generatedAt.toISOString(),
          filters: {
            openedAt: query.openedAt,
            closedAt: query.closedAt,
            collectorUserId: query.collectorUserId ?? null,
            paymentMethod: query.paymentMethod ?? null,
            classId: query.classId ?? null,
            studentId: query.studentId ?? null,
          },
        },
      });
    }

    return csv;
  }

  async listPayments(query: ListPaymentsQueryDto, actor: AuthContext) {
    assertAnyFinancePermission(actor, ['payments:collect', 'fees:manage']);
    const pagination = resolveFinancePagination(query);
    const search = query.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.method ? { method: query.method } : {}),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.paidFrom || query.paidTo
        ? {
            paidAt: {
              ...(query.paidFrom ? { gte: new Date(query.paidFrom) } : {}),
              ...(query.paidTo ? { lte: new Date(query.paidTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                referenceNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                receipt: {
                  is: {
                    receiptNumber: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
              {
                student: {
                  is: {
                    OR: [
                      {
                        firstNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        lastNameEn: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        studentSystemId: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'paidAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          student: true,
          receipt: true,
          refunds: true,
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const items = payments.map((payment) => ({
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
    return buildFinancePage(items, total, pagination);
  }

  async getPaymentGatewayReadiness(actor: AuthContext) {
    assertAnyFinancePermission(actor, ['payments:collect', 'fees:manage']);

    return this.resolvePaymentGatewayReadiness();
  }

  async getParentPaymentGatewayReadiness() {
    if (isParentPaymentSandboxEnabled()) {
      return {
        enabled: true,
        status: 'sandbox',
        provider: null,
        providers: PARENT_SANDBOX_PAYMENT_PROVIDERS.map((name) => ({ name })),
        supportedPaymentMethods: ['MOBILE'],
        sandbox: true,
        message:
          'Sandbox mode is active. Test payments are confirmed immediately and recorded in SchoolOS.',
      };
    }
    const readiness = await this.resolvePaymentGatewayReadiness();
    return {
      enabled: readiness.enabled,
      status: readiness.status,
      provider: readiness.provider ? { name: readiness.provider.name } : null,
      providers: readiness.provider ? [{ name: readiness.provider.name }] : [],
      supportedPaymentMethods: readiness.supportedPaymentMethods,
      sandbox: false,
      message: readiness.message,
    };
  }

  async collectParentSandboxPayment(
    studentId: string,
    input: {
      invoiceId: string;
      amount: number;
      provider: ParentSandboxPaymentProvider;
      idempotencyKey: string;
    },
    actor: AuthContext,
  ) {
    if (!isParentPaymentSandboxEnabled()) {
      throw new ForbiddenException('Parent sandbox payments are disabled.');
    }
    if (!PARENT_SANDBOX_PAYMENT_PROVIDERS.includes(input.provider)) {
      throw new BadRequestException('Unsupported sandbox payment provider.');
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: input.invoiceId,
        tenantId: actor.tenantId,
        studentId,
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      },
      select: { id: true },
    });
    if (!invoice) {
      throw new NotFoundException('Payable invoice not found for this child.');
    }

    const result = await this.collectPayment(
      {
        invoiceId: invoice.id,
        amount: input.amount,
        method: PaymentMethod.MOBILE,
        narration: `Parent sandbox payment via ${input.provider}`,
        idempotencyKey: `parent-sandbox-fee:${input.idempotencyKey}`,
      },
      {
        ...actor,
        permissions: Array.from(
          new Set([...actor.permissions, 'payments:collect']),
        ),
      },
    );

    return {
      ...result,
      provider: input.provider,
      sandbox: true,
      status: 'SUCCEEDED',
    };
  }

  private async resolvePaymentGatewayReadiness() {
    const provider = await this.prisma.providerConfig.findFirst({
      where: {
        type: 'PAYMENT_GATEWAY',
        enabled: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        enabled: true,
        environment: true,
        validationStatus: true,
        lastValidatedAt: true,
        configEncrypted: true,
        secretKeys: true,
      },
    });

    if (!provider) {
      return {
        enabled: false,
        status: 'not_configured',
        provider: null,
        supportedPaymentMethods: [],
        webhookReady: false,
        paymentIntentReady: false,
        idempotencyRequired: true,
        settlementTrackingReady: false,
        message: 'Online payments are not enabled for this school.',
      };
    }

    const config = this.decryptPaymentProviderConfig(
      normalizeJsonObject(provider.configEncrypted),
      provider.secretKeys,
    );
    const webhookReady = Boolean(config?.webhookUrl || config?.webhookPath);
    const paymentIntentConfigured = Boolean(
      config?.initiateUrl || config?.intentUrl,
    );
    const providerAdapterReady = config?.adapter === 'generic_json_v1';
    const settlementTrackingReady = Boolean(config?.settlementStatusUrl);
    const sandboxValidated =
      provider.environment === 'TEST' ||
      Boolean(
        await this.prisma.providerConfig.findFirst({
          where: {
            type: 'PAYMENT_GATEWAY',
            name: provider.name,
            environment: 'TEST',
            validationStatus: 'VALID',
          },
          select: { id: true },
        }),
      );
    const paymentIntentReady = Boolean(
      paymentIntentConfigured &&
      providerAdapterReady &&
      provider.lastValidatedAt &&
      sandboxValidated,
    );

    return {
      enabled: Boolean(
        provider.enabled &&
        provider.validationStatus === 'VALID' &&
        webhookReady &&
        paymentIntentReady &&
        providerAdapterReady &&
        settlementTrackingReady,
      ),
      status:
        provider.validationStatus === 'VALID'
          ? webhookReady && paymentIntentReady && settlementTrackingReady
            ? 'ready'
            : webhookReady && paymentIntentConfigured && !providerAdapterReady
              ? 'adapter_not_implemented'
              : 'configuration_incomplete'
          : (provider.validationStatus ?? 'not_validated'),
      provider: {
        id: provider.id,
        name: provider.name,
        environment: provider.environment,
        lastValidatedAt: provider.lastValidatedAt,
      },
      supportedPaymentMethods: ['MOBILE', 'TRANSFER'],
      webhookReady,
      paymentIntentReady,
      paymentIntentConfigured,
      providerAdapterReady,
      sandboxValidated,
      idempotencyRequired: true,
      settlementTrackingReady,
      message:
        webhookReady && paymentIntentConfigured && !providerAdapterReady
          ? 'Online payment gateway configuration exists, but no approved server-side provider adapter is configured.'
          : paymentIntentReady && settlementTrackingReady
            ? 'Online payment initiation is enabled with validated sandbox and reconciliation configuration.'
            : 'Online payments are not enabled for this school.',
    };
  }

  async initiateOnlinePayment(
    dto: InitiateOnlinePaymentDto,
    actor: AuthContext,
  ) {
    assertFinancePermission(actor, 'payments:collect');
    return this.createOnlinePaymentIntent(dto, actor);
  }

  async initiateParentOnlinePayment(
    studentId: string,
    dto: InitiateOnlinePaymentDto,
    actor: AuthContext,
  ) {
    return this.createOnlinePaymentIntent(dto, actor, studentId);
  }

  private async createOnlinePaymentIntent(
    dto: InitiateOnlinePaymentDto,
    actor: AuthContext,
    expectedStudentId?: string,
  ) {
    const readiness = await this.resolvePaymentGatewayReadiness();
    if (!readiness.enabled) {
      throw new BadRequestException(
        'Online payment provider is disabled or not configured.',
      );
    }

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: dto.invoiceId,
        tenantId: actor.tenantId,
        ...(expectedStudentId ? { studentId: expectedStudentId } : {}),
      },
      include: {
        payments: { include: { refunds: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found in this tenant');
    }

    const requestedAmount = new Prisma.Decimal(dto.amount);
    const remaining = invoice.totalAmount.sub(
      sumNetPaidAmount(invoice.payments),
    );
    if (requestedAmount.lte(0) || requestedAmount.gt(remaining)) {
      throw new BadRequestException('Invalid payment amount.');
    }

    const providerName = readiness.provider?.name;
    if (providerName?.toLowerCase() !== dto.provider.toLowerCase()) {
      throw new BadRequestException(
        'Requested payment provider is not enabled.',
      );
    }
    const providerId = readiness.provider?.id;
    if (!providerId) {
      throw new BadRequestException('Online payment provider is unavailable.');
    }

    const existing = await this.prisma.onlinePaymentIntent.findFirst({
      where: { tenantId: actor.tenantId, idempotencyKey: dto.idempotencyKey },
    });
    if (existing) {
      if (
        existing.invoiceId !== invoice.id ||
        existing.studentId !== invoice.studentId ||
        !existing.amount.equals(requestedAmount)
      ) {
        throw new ConflictException(
          'This payment request key was already used for different payment details.',
        );
      }
      return toOnlinePaymentIntentResponse(existing);
    }

    const providerConfig = await this.prisma.providerConfig.findUnique({
      where: { id: providerId },
    });
    if (!providerConfig) {
      throw new BadRequestException('Online payment provider is unavailable.');
    }
    const config = this.decryptPaymentProviderConfig(
      normalizeJsonObject(providerConfig.configEncrypted),
      providerConfig.secretKeys,
    );

    let intent;
    try {
      intent = await this.prisma.onlinePaymentIntent.create({
        data: {
          tenantId: actor.tenantId,
          studentId: invoice.studentId,
          invoiceId: invoice.id,
          requestedByUserId: actor.userId,
          provider: providerConfig.name,
          idempotencyKey: dto.idempotencyKey,
          amount: requestedAmount,
          status: 'CREATED',
        },
      });
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error;
      const raced = await this.prisma.onlinePaymentIntent.findFirst({
        where: { tenantId: actor.tenantId, idempotencyKey: dto.idempotencyKey },
      });
      if (!raced) throw error;
      return toOnlinePaymentIntentResponse(raced);
    }

    try {
      const providerIntent = await this.requestProviderPaymentIntent({
        config,
        intentId: intent.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(requestedAmount),
        idempotencyKey: dto.idempotencyKey,
      });
      const readyIntent = await this.prisma.onlinePaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'READY',
          providerReference: providerIntent.providerReference,
          checkoutUrl: providerIntent.checkoutUrl,
          expiresAt: providerIntent.expiresAt,
          failureCode: null,
          failureMessage: null,
        },
      });

      await this.auditService.record({
        action: 'initiate',
        resource: 'online_payment_intent',
        resourceId: readyIntent.id,
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: {
          invoiceId: invoice.id,
          studentId: invoice.studentId,
          provider: providerConfig.name,
          amount: Number(requestedAmount),
          status: readyIntent.status,
        },
      });
      return toOnlinePaymentIntentResponse(readyIntent);
    } catch (error) {
      await this.prisma.onlinePaymentIntent.update({
        where: { id: intent.id },
        data: {
          status: 'FAILED',
          failureCode: 'PROVIDER_INITIATION_FAILED',
          failureMessage: 'The payment provider could not start this payment.',
        },
      });
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException(
            'The payment provider could not start this payment. Please try again.',
          );
    }
  }

  private decryptPaymentProviderConfig(
    config: Record<string, unknown> | null,
    secretKeys: string[] = [],
  ) {
    if (!config) return null;
    const output: Record<string, unknown> = { ...config };
    for (const key of secretKeys) {
      const value = output[key];
      if (typeof value !== 'string') continue;
      if (isEncryptedSensitiveField(value) && !this.configService) {
        throw new BadRequestException(
          'Payment provider secrets cannot be used without runtime configuration.',
        );
      }
      output[key] = decryptSensitiveField(
        value,
        this.configService?.jwtSecret ?? '',
      );
    }
    return output;
  }

  private async requestProviderPaymentIntent(input: {
    config: Record<string, unknown> | null;
    intentId: string;
    invoiceNumber: string;
    amount: number;
    idempotencyKey: string;
  }) {
    const intentUrl = firstStringValue(input.config, [
      'initiateUrl',
      'intentUrl',
    ]);
    if (!intentUrl) {
      throw new BadRequestException('Payment intent URL is not configured.');
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(intentUrl);
    } catch {
      throw new BadRequestException('Payment intent URL is invalid.');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new BadRequestException('Payment intent URL must use HTTPS.');
    }

    const callbackUrl = firstStringValue(input.config, [
      'webhookUrl',
      'callbackUrl',
    ]);
    const returnUrl = firstStringValue(input.config, ['returnUrl']);
    const merchantId = firstStringValue(input.config, ['merchantId']);
    const apiToken = firstStringValue(input.config, [
      'apiToken',
      'accessToken',
    ]);
    const response = await fetch(parsedUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        merchantId,
        amount: input.amount,
        currency: 'NPR',
        reference: input.intentId,
        invoiceNumber: input.invoiceNumber,
        callbackUrl,
        returnUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!response.ok || !payload) {
      throw new BadRequestException(
        'The payment provider rejected this payment request.',
      );
    }

    const checkoutUrl = firstStringValue(payload, [
      'checkoutUrl',
      'paymentUrl',
      'redirectUrl',
    ]);
    const providerReference = firstStringValue(payload, [
      'providerReference',
      'transactionId',
      'reference',
      'id',
    ]);
    if (!checkoutUrl || !providerReference) {
      throw new BadRequestException(
        'The payment provider returned an incomplete payment intent.',
      );
    }
    const checkout = new URL(checkoutUrl);
    if (checkout.protocol !== 'https:') {
      throw new BadRequestException(
        'The payment provider returned an unsafe checkout URL.',
      );
    }
    const expiresAtValue = firstStringValue(payload, ['expiresAt', 'expiry']);
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;

    return {
      providerReference,
      checkoutUrl: checkout.toString(),
      expiresAt:
        expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    };
  }

  async handleOnlinePaymentWebhook(
    provider: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    const data = payload as {
      event?: string;
      amount?: number | string;
      reference?: string;
      providerReference?: string;
      intentId?: string;
      status?: string;
      tenantId?: string;
    };

    const activeProvider = await this.prisma.providerConfig.findFirst({
      where: {
        type: 'PAYMENT_GATEWAY',
        name: provider.toUpperCase(),
        enabled: true,
      },
    });

    if (!activeProvider) {
      throw new BadRequestException(
        `Provider ${provider} is disabled or not configured.`,
      );
    }

    const config = this.decryptPaymentProviderConfig(
      normalizeJsonObject(activeProvider.configEncrypted),
      activeProvider.secretKeys,
    );
    const signingSecret = this.getWebhookSigningSecret(config);

    const sigHeaderName = `${provider.toLowerCase()}-signature`;
    const signature =
      headers[sigHeaderName] ||
      headers[sigHeaderName.toUpperCase()] ||
      headers.signature;

    if (!signature || signature.trim() === '') {
      throw new BadRequestException('Missing signature header.');
    }

    if (!this.verifyWebhookSignature(payload, signature, signingSecret)) {
      throw new ForbiddenException('Invalid signature.');
    }

    const webhookStatus = normalizeOnlinePaymentWebhookStatus(
      data.status ?? data.event,
    );

    const reference = String(
      data.intentId ?? data.providerReference ?? data.reference ?? '',
    ).trim();
    if (!reference) {
      throw new BadRequestException('Webhook reference is required.');
    }

    const paymentIntent = await this.prisma.onlinePaymentIntent.findFirst({
      where: {
        provider: activeProvider.name,
        OR: [{ id: reference }, { providerReference: reference }],
      },
    });

    if (!paymentIntent) {
      throw new NotFoundException(
        'Payment intent was not found for this provider callback.',
      );
    }

    if (
      paymentIntent.status === OnlinePaymentIntentStatus.SUCCEEDED &&
      webhookStatus !== 'SUCCESS'
    ) {
      await this.auditService.record({
        action: 'webhook_ignored',
        resource: 'online_payment_intent',
        resourceId: paymentIntent.id,
        tenantId: paymentIntent.tenantId,
        userId: 'system',
        after: {
          provider: activeProvider.name,
          callbackStatus: webhookStatus,
          reason: 'terminal_success_preserved',
        },
      });
      return {
        status: 'ignored',
        postedToLedger: true,
        duplicate: true,
        message:
          'A delayed callback was ignored because the payment is already confirmed.',
      };
    }

    if (webhookStatus !== 'SUCCESS') {
      if (webhookStatus === 'UNKNOWN') {
        await this.auditService.record({
          action: 'webhook_ignored',
          resource: 'online_payment_intent',
          resourceId: paymentIntent.id,
          tenantId: paymentIntent.tenantId,
          userId: 'system',
          after: {
            provider: activeProvider.name,
            callbackStatus: webhookStatus,
            reason: 'unknown_status',
          },
        });
        return {
          status: 'ignored',
          postedToLedger: false,
          message: 'Unknown payment callback status was acknowledged safely.',
        };
      }
      if (
        paymentIntent.status !== OnlinePaymentIntentStatus.FAILED &&
        paymentIntent.status !== OnlinePaymentIntentStatus.EXPIRED
      ) {
        await this.prisma.onlinePaymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: webhookStatus === 'PENDING' ? 'PENDING' : 'FAILED',
            failureCode:
              webhookStatus === 'PENDING' ? null : `PROVIDER_${webhookStatus}`,
            failureMessage:
              webhookStatus === 'PENDING'
                ? null
                : 'The payment provider reported that this payment did not complete.',
          },
        });
      }
      await this.auditService.record({
        action: 'webhook_acknowledged',
        resource: 'online_payment_intent',
        resourceId: paymentIntent.id,
        tenantId: paymentIntent.tenantId,
        userId: 'system',
        after: {
          provider: activeProvider.name,
          callbackStatus: webhookStatus,
        },
      });
      return {
        status: 'ignored',
        postedToLedger: false,
        message: `Webhook event ${webhookStatus.toLowerCase()} was acknowledged without creating a payment.`,
      };
    }

    const requestedAmount = new Prisma.Decimal(data.amount || 0);
    if (requestedAmount.lte(0)) {
      throw new BadRequestException(
        'Webhook amount must be greater than zero.',
      );
    }

    const tenantId = paymentIntent.tenantId;

    // Duplicate event checking
    const idempotencyKey = `payment-intent:${paymentIntent.id}`;
    const existingPayment = await this.prisma.payment.findFirst({
      where: { tenantId, idempotencyKey },
      include: { receipt: true },
    });

    if (existingPayment) {
      if (paymentIntent.status !== OnlinePaymentIntentStatus.SUCCEEDED) {
        await this.prisma.onlinePaymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: 'SUCCEEDED',
            paymentId: existingPayment.id,
            reconciledAt: new Date(),
          },
        });
      }
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'online_payment_intent',
        resourceId: paymentIntent.id,
        tenantId,
        userId: 'system',
        after: {
          provider: activeProvider.name,
          paymentId: existingPayment.id,
        },
      });
      return {
        status: 'verified',
        postedToLedger: true,
        duplicate: true,
        message: 'Payment already processed and posted.',
        paymentId: existingPayment.id,
      };
    }

    // Look up invoice
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: paymentIntent.invoiceId,
        tenantId,
      },
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
    const remaining = invoice.totalAmount.sub(paidSoFar);

    if (remaining.lte(0)) {
      await this.auditService.record({
        action: 'webhook_ignored',
        resource: 'online_payment_intent',
        resourceId: paymentIntent.id,
        tenantId,
        userId: 'system',
        after: {
          provider: activeProvider.name,
          invoiceId: invoice.id,
          reason: 'invoice_already_paid',
        },
      });
      return {
        status: 'verified',
        postedToLedger: false,
        message:
          'Invoice is already fully paid. Webhook event ignored to prevent duplicate payment.',
      };
    }

    if (!requestedAmount.equals(paymentIntent.amount)) {
      throw new BadRequestException(
        'Webhook amount does not match the initiated payment amount.',
      );
    }
    if (requestedAmount.gt(remaining)) {
      throw new BadRequestException(
        'Webhook amount exceeds the remaining invoice balance.',
      );
    }
    const paymentAmount = requestedAmount;

    const fiscalYear = resolveFiscalYear(new Date());
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    const webhookActor: AuthContext = {
      tenantId,
      userId: 'system',
      roles: ['admin'],
      permissions: ['payments:collect', 'receipts:manage'],
      authMethod: AuthMethod.PASSWORD,
      tenantSlug: tenant.slug,
      email: null,
    };

    let result: CollectedPaymentWithReceipt;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const receiptNumber = await this.generateReceiptNumber(
          tenantId,
          fiscalYear,
          tx,
        );

        const receiptVat = invoice.totalAmount.gt(0)
          ? invoice.vatAmount.mul(paymentAmount).div(invoice.totalAmount)
          : new Prisma.Decimal(0);

        const payment = await tx.payment.create({
          data: {
            tenantId,
            studentId: invoice.studentId,
            invoiceId: invoice.id,
            collectedById: null,
            method: PaymentMethod.TRANSFER,
            status: PaymentStatus.SUCCESS,
            referenceNumber: reference,
            amount: paymentAmount,
            isAdvance: false,
            recognizedAt: new Date(),
            metadata: {
              remainingBeforePayment: Number(remaining),
              webhookProvider: provider,
            },
            paidAt: new Date(),
            narration: `Online payment via webhook for ${provider}`,
            idempotencyKey,
            receipt: {
              create: {
                tenantId,
                receiptNumber,
                fiscalYear,
                schoolPan: tenant.panNumber,
                vatAmount: receiptVat,
                metadata: {
                  nonReusable: true,
                  invoiceFiscalYear: invoice.fiscalYear,
                  billNumber: invoice.billNumber ?? invoice.invoiceNumber,
                },
                pdfUrl: null,
                fileStatus: ReceiptFileStatus.PENDING,
              },
            },
          },
          include: {
            receipt: true,
          },
        });

        const usageNow = new Date();
        const usagePeriodStart = new Date(
          Date.UTC(usageNow.getUTCFullYear(), usageNow.getUTCMonth(), 1),
        );

        await tx.usageCounter.upsert({
          where: {
            tenantId_usageKey_period_periodStart: {
              tenantId,
              usageKey: 'receipts.generated',
              period: 'MONTHLY',
              periodStart: usagePeriodStart,
            },
          },
          create: {
            tenantId,
            usageKey: 'receipts.generated',
            period: 'MONTHLY',
            periodStart: usagePeriodStart,
            value: 1,
          },
          update: {
            value: { increment: 1 },
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

        await tx.onlinePaymentIntent.update({
          where: { id: paymentIntent.id },
          data: {
            status: 'SUCCEEDED',
            paymentId: payment.id,
            reconciledAt: new Date(),
            failureCode: null,
            failureMessage: null,
          },
        });

        await this.accountingPostingService.postFeePayment(
          {
            tenantId,
            paymentId: payment.id,
            invoiceNumber: invoice.invoiceNumber,
            receiptNumber,
            paymentAmount,
            paymentMethod: PaymentMethod.TRANSFER,
            paymentAccountCode: resolveCashAccountCode(PaymentMethod.TRANSFER),
            narration: `Fee payment via online webhook for ${provider}`,
            lines: [],
          },
          webhookActor,
          tx,
        );

        return payment;
      });
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) {
        throw error;
      }
      const concurrentPayment = await this.prisma.payment.findFirst({
        where: {
          tenantId,
          idempotencyKey,
        },
        include: { receipt: true },
      });
      if (!concurrentPayment) {
        throw new ConflictException(
          'The callback could not be reconciled safely. Retry the same provider event.',
        );
      }
      await this.auditService.record({
        action: 'idempotent_replay',
        resource: 'online_payment_intent',
        resourceId: paymentIntent.id,
        tenantId,
        userId: 'system',
        after: {
          provider: activeProvider.name,
          paymentId: concurrentPayment.id,
          concurrent: true,
        },
      });
      return {
        status: 'verified',
        postedToLedger: true,
        duplicate: true,
        message: 'Payment already processed and posted.',
        paymentId: concurrentPayment.id,
      };
    }

    await this.auditService.record({
      action: 'collect',
      resource: 'payment',
      tenantId,
      userId: 'system',
      resourceId: result.id,
      after: {
        invoiceId: invoice.id,
        amount: Number(result.amount),
        method: result.method,
        receiptNumber: result.receipt?.receiptNumber ?? null,
      },
    });

    this.eventEmitter.emit('fees.payment.confirmed', {
      tenantId,
      actor: webhookActor,
      paymentId: result.id,
      invoiceId: invoice.id,
      studentId: invoice.studentId,
      amount: Number(result.amount),
      method: result.method,
      receiptNumber: result.receipt?.receiptNumber ?? null,
    });

    return {
      status: 'verified',
      postedToLedger: true,
      paymentId: result.id,
      message: 'Online payment processed and posted to ledger.',
    };
  }

  private getWebhookSigningSecret(config: Record<string, unknown> | null) {
    const encryptedSecret = firstStringValue(config, [
      'webhookSigningSecret',
      'signingSecret',
      'webhookSecret',
    ]);

    if (!encryptedSecret) {
      throw new BadRequestException(
        'Webhook signing secret is not configured for this payment provider.',
      );
    }

    if (isEncryptedSensitiveField(encryptedSecret) && !this.configService) {
      throw new BadRequestException(
        'Webhook signing secret cannot be verified without runtime configuration.',
      );
    }

    return decryptSensitiveField(
      encryptedSecret,
      this.configService?.jwtSecret ?? '',
    );
  }

  private verifyWebhookSignature(
    payload: Record<string, unknown>,
    signature: string,
    signingSecret: string | null,
  ) {
    if (!signingSecret) {
      return false;
    }

    const expected = createHmac('sha256', signingSecret)
      .update(JSON.stringify(payload ?? {}))
      .digest('hex');
    const normalizedSignature = signature.trim().replace(/^sha256=/i, '');
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(normalizedSignature, 'hex');

    return (
      actualBuffer.length === expectedBuffer.length &&
      timingSafeEqual(actualBuffer, expectedBuffer)
    );
  }

  async listReceipts(query: ListReceiptsQueryDto, actor: AuthContext) {
    assertFinancePermission(actor, 'receipts:read');
    const pagination = resolveFinancePagination(query);
    const search = query.search?.trim();
    const where: Prisma.ReceiptWhereInput = {
      tenantId: actor.tenantId,
      ...(query.studentId
        ? { payment: { is: { studentId: query.studentId } } }
        : {}),
      ...(query.issuedFrom || query.issuedTo
        ? {
            issuedAt: {
              ...(query.issuedFrom ? { gte: new Date(query.issuedFrom) } : {}),
              ...(query.issuedTo ? { lte: new Date(query.issuedTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                receiptNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                payment: {
                  is: {
                    OR: [
                      {
                        invoice: {
                          is: {
                            invoiceNumber: {
                              contains: search,
                              mode: 'insensitive',
                            },
                          },
                        },
                      },
                      {
                        student: {
                          is: {
                            OR: [
                              {
                                firstNameEn: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                              {
                                lastNameEn: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                              {
                                studentSystemId: {
                                  contains: search,
                                  mode: 'insensitive',
                                },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'issuedAt';
    const sortDirection = query.sortDirection ?? 'desc';
    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        include: {
          payment: {
            include: {
              invoice: true,
              student: true,
              refunds: true,
            },
          },
          reprintHistory: {
            include: {
              reprintedBy: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
            orderBy: [{ reprintedAt: 'desc' }],
            take: 5,
          },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    const items = receipts.map((receipt) => ({
      id: receipt.id,
      receiptNumber: receipt.receiptNumber,
      issuedAt: receipt.issuedAt,
      fileAssetId: receipt.fileAssetId,
      fileStatus: receipt.fileStatus,
      paymentId: receipt.paymentId,
      amount: Number(receipt.payment.amount),
      refundedAmount: Number(sumRefundedAmount(receipt.payment.refunds)),
      method: receipt.payment.method,
      invoiceNumber: receipt.payment.invoice.invoiceNumber,
      student: {
        id: receipt.payment.student.id,
        name: `${receipt.payment.student.firstNameEn} ${receipt.payment.student.lastNameEn}`.trim(),
      },
      reprintCount: receipt.reprintHistory.length,
      latestReprint: receipt.reprintHistory[0]
        ? {
            reprintedAt: receipt.reprintHistory[0].reprintedAt,
            reason: receipt.reprintHistory[0].reason,
            format: receipt.reprintHistory[0].format,
            delivery: receipt.reprintHistory[0].delivery,
            reprintedBy: receipt.reprintHistory[0].reprintedBy
              ? {
                  id: receipt.reprintHistory[0].reprintedBy.id,
                  email: receipt.reprintHistory[0].reprintedBy.email,
                }
              : null,
          }
        : null,
    }));
    return buildFinancePage(items, total, pagination);
  }

  async getReceiptPdf(receiptNumber: string, actor: AuthContext) {
    assertFinancePermission(actor, 'receipts:read');
    return this.getReceiptPdfInternal(receiptNumber, actor);
  }

  async getReceiptPdfForStudent(
    receiptNumber: string,
    studentId: string,
    actor: AuthContext,
  ) {
    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null && !parentStudentIds.includes(studentId)) {
      throw new ForbiddenException(
        'You do not have access to this student receipt.',
      );
    }
    const ownStudentId = await getStudentOwnId(this.prisma, actor);
    if (ownStudentId !== null && ownStudentId !== studentId) {
      throw new ForbiddenException(
        'You do not have access to this student receipt.',
      );
    }
    return this.getReceiptPdfInternal(receiptNumber, actor, {
      studentId,
      notFoundMessage: 'Receipt not found for this student',
    });
  }

  private async getReceiptPdfInternal(
    receiptNumber: string,
    actor: AuthContext,
    options: { studentId?: string; notFoundMessage?: string } = {},
  ) {
    const receipt = await this.prisma.receipt.findFirst({
      where: {
        tenantId: actor.tenantId,
        receiptNumber,
      },
      include: {
        payment: {
          include: {
            invoice: {
              include: {
                lines: {
                  include: { feeHead: true },
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
            collectedBy: { select: { id: true, email: true } },
          },
        },
        tenant: true,
      },
    });

    if (
      !receipt ||
      (options.studentId && receipt.payment.studentId !== options.studentId)
    ) {
      if (options.studentId) {
        throw new NotFoundException(
          options.notFoundMessage ?? 'Receipt not found for this student',
        );
      }

      if (!receipt) {
        throw new NotFoundException('Receipt not found in this tenant');
      }
    }

    const fileName = `Receipt_${receipt.receiptNumber}.pdf`;
    let pdf: Buffer;
    let fileAssetId: string | null = null;

    const existingFile = await this.prisma.fileAsset.findFirst({
      where: {
        tenantId: actor.tenantId,
        softDeletedAt: null,
        OR: [
          ...(receipt.fileAssetId ? [{ id: receipt.fileAssetId }] : []),
          {
            module: 'fees',
            entityId: receipt.id,
            originalFilename: fileName,
          },
        ],
      },
    });

    const { payment } = receipt;
    const { invoice, student } = payment;

    const subtotal =
      invoice.lines?.reduce((sum, line) => sum + Number(line.totalAmount), 0) ??
      0;
    const discount = 0;
    const total = Number(invoice.totalAmount);
    const paidAmount = Number(payment.amount);
    const refundedAmount =
      payment.refunds?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0;
    const balance = total - paidAmount + refundedAmount;

    const pdfData = {
      schoolName: receipt.tenant?.name ?? 'SchoolOS',
      panNumber: receipt.tenant?.panNumber ?? '',
      receiptNumber: receipt.receiptNumber,
      invoiceNumber: invoice.invoiceNumber,
      paymentDate: payment.paidAt,
      method: payment.method,
      cashierName: payment.collectedBy?.email ?? 'System',
      student: {
        id: student.studentSystemId,
        name: `${student.firstNameEn} ${student.lastNameEn}`.trim(),
        className: student.class?.name ?? 'Unknown',
        sectionName: student.sectionRef?.name ?? student.section,
        rollNumber: student.rollNumber,
      },
      lines:
        invoice.lines?.map((line) => ({
          name: line.feeHead?.name ?? 'Fee',
          amount: Number(line.totalAmount),
        })) ?? [],
      subtotal,
      discount,
      total,
      paidAmount,
      balance,
      qrToken: receipt.receiptNumber,
    };

    if (!this.fileRegistryService) {
      throw new ConflictException(
        'Receipt file access is temporarily unavailable.',
      );
    }

    if (existingFile) {
      const download = await this.fileRegistryService.getProtectedDownload(
        actor.tenantId,
        existingFile.id,
        actor.userId,
      );
      pdf = download.content;
      fileAssetId = existingFile.id;
    } else {
      const logo = await loadSchoolLogoForPdf(
        this.prisma,
        this.fileRegistryService,
        actor,
      );
      pdf = buildReceiptPdf({ ...pdfData, logo });

      try {
        const asset = await this.fileRegistryService.registerGeneratedFile({
          tenantId: actor.tenantId,
          generatedByUserId: actor.userId,
          originalFilename: fileName,
          content: pdf,
          mimeType: 'application/pdf',
          module: 'fees',
          entityId: receipt.id,
          metadata: {
            kind: 'receipt_pdf',
            receiptId: receipt.id,
            receiptNumber: receipt.receiptNumber,
            paymentId: receipt.paymentId,
            studentId: receipt.payment.studentId,
          },
        });
        fileAssetId = asset.id;
      } catch {
        throw new ConflictException(
          'Receipt file is temporarily unavailable. Retry regeneration later.',
        );
      }
    }

    await this.auditService.record({
      action: 'download',
      resource: 'receipt',
      resourceId: receipt.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        receiptNumber: receipt.receiptNumber,
        paymentId: receipt.paymentId,
        studentId: receipt.payment.studentId,
        fileAssetId,
      },
    });

    return pdf;
  }

  async listLedgerEntries(
    query: ListLedgerEntriesQueryDto,
    actor: AuthContext,
  ) {
    const pagination = resolveFinancePagination(query);
    const search = query.search?.trim();
    const where: Prisma.JournalEntryWhereInput = {
      tenantId: actor.tenantId,
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.entryFrom || query.entryTo
        ? {
            entryDate: {
              ...(query.entryFrom ? { gte: new Date(query.entryFrom) } : {}),
              ...(query.entryTo ? { lte: new Date(query.entryTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              {
                entryNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                narration: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy ?? 'entryDate';
    const sortDirection = query.sortDirection ?? 'desc';
    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              chartAccount: true,
            },
          },
        },
        orderBy: [{ [sortBy]: sortDirection }, { id: 'asc' }],
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return buildFinancePage(items, total, pagination);
  }

  async listAccounts(actor: AuthContext) {
    return this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ code: 'asc' }],
      take: 100,
    });
  }

  private buildCashierCloseResponse(
    close: CashierCloseWithUsers,
    closePdfFile: CashierClosePdfFileSummary | null = null,
  ) {
    return {
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
      expectedCashAmount: Number(close.expectedCashAmount ?? 0),
      actualCashAmount:
        close.actualCashAmount === null ? null : Number(close.actualCashAmount),
      varianceAmount:
        close.varianceAmount === null ? null : Number(close.varianceAmount),
      varianceReason: close.varianceReason,
      denominationBreakdown: normalizeJsonObject(close.denominationBreakdown),
      methodBreakdown: parseCashierCloseMethodBreakdown(close.methodBreakdown),
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
      closePdfFile,
    };
  }

  private async getCashierClosePdfFilesByCloseId(
    tenantId: string,
    closeIds: string[],
  ) {
    const filesByCloseId = new Map<string, CashierClosePdfFileSummary>();

    if (closeIds.length === 0) {
      return filesByCloseId;
    }

    const files = await this.prisma.fileAsset.findMany({
      where: {
        tenantId,
        module: 'fees',
        entityId: { in: closeIds },
        originalFilename: { startsWith: 'DayEndClose_' },
        mimeType: 'application/pdf',
        softDeletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    for (const file of files) {
      if (file.entityId && !filesByCloseId.has(file.entityId)) {
        filesByCloseId.set(file.entityId, mapCashierClosePdfFile(file));
      }
    }

    return filesByCloseId;
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
    const methodBreakdown = buildCashierMethodBreakdown(payments, refunds);
    const grossCollected = methodBreakdown.reduce(
      (sum, row) => sum.add(row.grossCollected),
      new Prisma.Decimal(0),
    );
    const totalRefunded = methodBreakdown.reduce(
      (sum, row) => sum.add(row.totalRefunded),
      new Prisma.Decimal(0),
    );
    const expectedCashAmount =
      methodBreakdown.find((row) => row.method === PaymentMethod.CASH)
        ?.netCollected ?? 0;

    return {
      openedAt: input.openedAt,
      closedAt: input.closedAt,
      collectorUserId: input.collectorUserId ?? null,
      paymentMethod: input.paymentMethod ?? null,
      grossCollected: Number(grossCollected.toDecimalPlaces(2)),
      totalRefunded: Number(totalRefunded.toDecimalPlaces(2)),
      netCollected: Number(
        grossCollected.sub(totalRefunded).toDecimalPlaces(2),
      ),
      expectedCashAmount,
      actualCashAmount: null,
      varianceAmount: null,
      varianceReason: null,
      denominationBreakdown: null,
      methodBreakdown,
      paymentCount: payments.length,
      refundCount: refunds.length,
      firstReceiptNumber: payments[0]?.receipt?.receiptNumber ?? null,
      lastReceiptNumber: payments.at(-1)?.receipt?.receiptNumber ?? null,
    } satisfies CashierCloseSummary;
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
        collectedBy: { select: { id: true, email: true } },
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
      paymentEntryRecords
        .filter((e) => e.sourceId && e.entryNumber)
        .map((entry) => [entry.sourceId!, entry.entryNumber!]),
    );
    const refundEntriesBySourceId = new Map<string, string[]>();

    for (const entry of refundEntryRecords) {
      if (!entry.sourceId || !entry.entryNumber) {
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

  private async generateCashierCloseNumber(
    tenantId: string,
    client: Pick<Prisma.TransactionClient, 'cashierClose'> = this.prisma,
  ) {
    const count = await client.cashierClose.count({
      where: { tenantId },
    });

    return `CLS-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateRefundNumber(
    tenantId: string,
    client: Pick<Prisma.TransactionClient, 'paymentRefund'> = this.prisma,
  ) {
    const count = await client.paymentRefund.count({
      where: { tenantId },
    });

    return `RFD-${new Date().getUTCFullYear()}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateJournalEntryNumber(
    tenantId: string,
    client: Pick<Prisma.TransactionClient, 'journalEntry'> = this.prisma,
  ) {
    const count = await client.journalEntry.count({
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

  private async invoiceContainsFeeHead(
    invoiceId: string,
    feeHeadId: string,
    tenantId: string,
  ) {
    const line = await this.prisma.invoiceLine.findFirst({
      where: { invoiceId, feeHeadId, tenantId },
      select: { id: true },
    });

    return Boolean(line);
  }

  private async postInvoiceToLedger(
    invoice: unknown,
    actor: AuthContext,
    tx: Prisma.TransactionClient,
  ) {
    const invoiceLines = (
      invoice as {
        lines: Array<{
          feeHead: { code: string; name: string };
          totalAmount: Prisma.Decimal;
        }>;
      }
    ).lines.map((line) => ({
      accountCode: resolveIncomeAccountCode(line.feeHead.code),
      accountName: line.feeHead.name,
      accountType: ChartAccountType.REVENUE,
      amount: line.totalAmount,
      description: `Revenue from ${line.feeHead.name}`,
    }));

    const inv = invoice as {
      id: string;
      invoiceNumber: string;
      studentId: string;
      totalAmount: Prisma.Decimal;
    };

    await this.accountingPostingService.postInvoice(
      {
        tenantId: actor.tenantId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        studentId: inv.studentId,
        totalAmount: inv.totalAmount,
        entryDate: new Date(),
        lines: invoiceLines,
      },
      actor,
      tx,
    );
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
    case 'MEALPLAN':
      return '4050';
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

function ledgerEventOrder(
  type: 'INVOICE' | 'PAYMENT' | 'WAIVER' | 'REFUND' | 'REVERSAL',
) {
  const orders = {
    INVOICE: 1,
    WAIVER: 2,
    PAYMENT: 3,
    REFUND: 4,
    REVERSAL: 5,
  };
  return orders[type] || 99;
}

function getAgingBucket(
  dueDateOrDays: Date | number,
  asOf: Date = new Date(),
): FeeAgingBucket | '0' {
  const diffDays =
    dueDateOrDays instanceof Date
      ? Math.ceil(
          (asOf.getTime() - dueDateOrDays.getTime()) / (1000 * 60 * 60 * 24),
        )
      : dueDateOrDays;
  if (diffDays <= 0) return '0';
  if (diffDays <= 30) return '0-30';
  if (diffDays <= 60) return '31-60';
  if (diffDays <= 90) return '61-90';
  return '90+';
}

function resolveDefaulterOverdueFilter(
  filters: Pick<
    ListDefaultersDto,
    'agingBucket' | 'minDaysOverdue' | 'maxDaysOverdue'
  >,
  today: Date,
): Prisma.DateTimeFilter {
  const bucketRange = filters.agingBucket
    ? getAgingBucketRange(filters.agingBucket)
    : null;
  const minDaysOverdue = Math.max(
    filters.minDaysOverdue ?? bucketRange?.min ?? 1,
    bucketRange?.min ?? 1,
  );
  const maxDaysOverdue =
    filters.maxDaysOverdue === undefined
      ? bucketRange?.max
      : bucketRange?.max === undefined
        ? filters.maxDaysOverdue
        : Math.min(filters.maxDaysOverdue, bucketRange.max);

  if (maxDaysOverdue !== undefined && minDaysOverdue > maxDaysOverdue) {
    throw new BadRequestException(
      'minDaysOverdue cannot be greater than maxDaysOverdue for the selected aging segment.',
    );
  }

  const dueDateFilter: Prisma.DateTimeFilter = {
    lt: today,
    lte: dateDaysAgo(today, minDaysOverdue),
  };

  if (maxDaysOverdue !== undefined) {
    dueDateFilter.gte = dateDaysAgo(today, maxDaysOverdue + 1);
  }

  return dueDateFilter;
}

function getAgingBucketRange(bucket: FeeAgingBucket) {
  switch (bucket) {
    case '0-30':
      return { min: 1, max: 30 };
    case '31-60':
      return { min: 31, max: 60 };
    case '61-90':
      return { min: 61, max: 90 };
    case '90+':
      return { min: 91, max: undefined };
  }
}

function dateDaysAgo(date: Date, days: number) {
  return new Date(date.getTime() - days * 86_400_000);
}

function buildDefaulterSegmentSummary(
  items: Array<{ agingBucket: string; outstanding: number }>,
) {
  return ['0-30', '31-60', '61-90', '90+'].map((bucket) => {
    const bucketItems = items.filter((item) => item.agingBucket === bucket);
    return {
      agingBucket: bucket,
      count: bucketItems.length,
      outstanding: roundMoney(
        bucketItems.reduce((sum, item) => sum + item.outstanding, 0),
      ),
    };
  });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
    status?: PaymentStatus;
    refunds: Array<{ amount: Prisma.Decimal }>;
  }>,
) {
  return payments.reduce((sum, p) => {
    if (p.status === PaymentStatus.REVERSED) return sum;
    return sum.add(p.amount).sub(sumRefundedAmount(p.refunds));
  }, new Prisma.Decimal(0));
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

function buildCashierMethodBreakdown(
  payments: Array<{ method: PaymentMethod; amount: Prisma.Decimal }>,
  refunds: Array<{
    amount: Prisma.Decimal;
    payment: { method: PaymentMethod };
  }>,
): CashierCloseMethodBreakdown[] {
  return Object.values(PaymentMethod).map((method) => {
    const methodPayments = payments.filter(
      (payment) => payment.method === method,
    );
    const methodRefunds = refunds.filter(
      (refund) => refund.payment.method === method,
    );
    const grossCollected = methodPayments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const totalRefunded = methodRefunds.reduce(
      (sum, refund) => sum.add(refund.amount),
      new Prisma.Decimal(0),
    );

    return {
      method,
      grossCollected: Number(grossCollected.toDecimalPlaces(2)),
      totalRefunded: Number(totalRefunded.toDecimalPlaces(2)),
      netCollected: Number(
        grossCollected.sub(totalRefunded).toDecimalPlaces(2),
      ),
      paymentCount: methodPayments.length,
      refundCount: methodRefunds.length,
    };
  });
}

function parseCashierCloseMethodBreakdown(
  value: Prisma.JsonValue | null,
): CashierCloseMethodBreakdown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is CashierCloseMethodBreakdown =>
    isCashierCloseMethodBreakdown(item),
  );
}

function mapCashierClosePdfFile(file: FileAsset): CashierClosePdfFileSummary {
  return {
    fileAssetId: file.id,
    fileName: file.originalFilename,
    mimeType: file.mimeType,
    sizeBytes: Number(file.sizeBytes),
  };
}

function isCashierCloseMethodBreakdown(
  value: unknown,
): value is CashierCloseMethodBreakdown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, Prisma.JsonValue>;
  return (
    typeof row.method === 'string' &&
    typeof row.grossCollected === 'number' &&
    typeof row.totalRefunded === 'number' &&
    typeof row.netCollected === 'number' &&
    typeof row.paymentCount === 'number' &&
    typeof row.refundCount === 'number'
  );
}

function normalizeJsonObject(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function toOnlinePaymentIntentResponse(intent: {
  id: string;
  invoiceId: string;
  studentId: string;
  provider: string;
  amount: Prisma.Decimal;
  currency: string;
  status: OnlinePaymentIntentStatus;
  checkoutUrl: string | null;
  expiresAt: Date | null;
  paymentId: string | null;
  failureMessage: string | null;
}) {
  return {
    id: intent.id,
    invoiceId: intent.invoiceId,
    studentId: intent.studentId,
    provider: intent.provider,
    amount: Number(intent.amount),
    currency: intent.currency,
    status: intent.status,
    checkoutUrl: intent.checkoutUrl,
    expiresAt: intent.expiresAt,
    paymentId: intent.paymentId,
    message: intent.failureMessage,
  };
}

function firstStringValue(
  config: Record<string, unknown> | null,
  keys: string[],
) {
  for (const key of keys) {
    const value = config?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return null;
}

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function assertFinancePermission(actor: AuthContext, permission: string) {
  if (!actor.permissions?.includes(permission)) {
    throw new ForbiddenException(
      'You do not have permission for this finance action.',
    );
  }
}

function assertAnyFinancePermission(actor: AuthContext, permissions: string[]) {
  if (
    !permissions.some((permission) => actor.permissions?.includes(permission))
  ) {
    throw new ForbiddenException(
      'You do not have permission for this finance action.',
    );
  }
}

function resolveDuesRowStatus(
  dueDate: Date,
  paidAmount: Prisma.Decimal,
  outstandingAmount: Prisma.Decimal,
) {
  if (outstandingAmount.lte(0)) {
    return 'paid';
  }

  if (paidAmount.gt(0)) {
    return 'partial';
  }

  return dueDate < new Date() ? 'overdue' : 'unpaid';
}

function buildCashierCloseWindowKey(input: {
  openedAt: Date;
  closedAt: Date;
  collectorUserId?: string | null;
  paymentMethod?: PaymentMethod | null;
}) {
  return [
    input.openedAt.toISOString(),
    input.closedAt.toISOString(),
    input.collectorUserId || 'all-collectors',
    input.paymentMethod || 'all-methods',
  ].join('|');
}

function isPrismaUniqueConstraintError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'P2002'
  ) {
    return true;
  }
  const KnownRequestError = Prisma.PrismaClientKnownRequestError;

  return (
    typeof KnownRequestError === 'function' &&
    error instanceof KnownRequestError &&
    error.code === 'P2002'
  );
}

function buildPaymentMethodReconciliation(
  rows: Array<{
    method: PaymentMethod;
    grossAmount: number;
    refundedAmount: number;
    netAmount: number;
    collector: { id?: string | null } | null;
    receiptNumber: string | null;
  }>,
) {
  const grouped = new Map<
    PaymentMethod,
    {
      paymentMethod: PaymentMethod;
      receiptCount: number;
      grossCollected: number;
      reversalsAndRefunds: number;
      netAmount: number;
      declaredAmount: number | null;
      variance: number;
    }
  >();

  for (const row of rows) {
    const current = grouped.get(row.method) ?? {
      paymentMethod: row.method,
      receiptCount: 0,
      grossCollected: 0,
      reversalsAndRefunds: 0,
      netAmount: 0,
      declaredAmount: null,
      variance: 0,
    };

    current.receiptCount += row.receiptNumber ? 1 : 0;
    current.grossCollected += row.grossAmount;
    current.reversalsAndRefunds += row.refundedAmount;
    current.netAmount += row.netAmount;
    grouped.set(row.method, current);
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    grossCollected: Number(row.grossCollected.toFixed(2)),
    reversalsAndRefunds: Number(row.reversalsAndRefunds.toFixed(2)),
    netAmount: Number(row.netAmount.toFixed(2)),
  }));
}

function normalizeOnlinePaymentWebhookStatus(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  if (
    normalized === 'SUCCESS' ||
    normalized === 'COMPLETED' ||
    normalized === 'PAID' ||
    normalized === 'PAYMENT_SUCCESS' ||
    normalized === 'PAYMENT_COMPLETED' ||
    normalized === 'PAYMENT.SUCCESS' ||
    normalized === 'PAYMENT.COMPLETED'
  ) {
    return 'SUCCESS';
  }

  if (
    normalized === 'FAILED' ||
    normalized === 'FAILURE' ||
    normalized === 'CANCELLED' ||
    normalized === 'CANCELED' ||
    normalized === 'EXPIRED' ||
    normalized === 'DECLINED' ||
    normalized === 'PAYMENT.FAILED' ||
    normalized === 'PAYMENT.CANCELLED' ||
    normalized === 'PAYMENT.CANCELED'
  ) {
    return 'FAILED';
  }

  if (
    normalized === 'PENDING' ||
    normalized === 'PROCESSING' ||
    normalized === 'AUTHORIZED' ||
    normalized === 'INITIATED' ||
    normalized === 'DELAYED' ||
    normalized === 'PAYMENT.PENDING' ||
    normalized === 'PAYMENT.PROCESSING'
  ) {
    return 'PENDING';
  }

  return 'UNKNOWN';
}

function isParentPaymentSandboxEnabled() {
  return (
    process.env.SCHOOLOS_PARENT_PAYMENT_SANDBOX === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.DEPLOY_ENV !== 'production')
  );
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function resolveOptionalFinanceReportPeriod(query: FinanceReportQueryDto) {
  if (!query.fromDate && !query.toDate) {
    return null;
  }
  if (!query.fromDate || !query.toDate) {
    throw new BadRequestException(
      'Both fromDate and toDate are required for a finance report range.',
    );
  }

  return resolveFinanceSummaryPeriod(
    { fromDate: query.fromDate, toDate: query.toDate },
    NEPAL_TIME_ZONE,
  );
}

function resolveFinanceSummaryPeriod(
  query: FinanceDashboardSummaryQueryDto,
  timeZone: string,
) {
  const hasSingleDate = Boolean(query.date);
  const hasRange = Boolean(query.fromDate || query.toDate);

  if (hasSingleDate === hasRange) {
    throw new BadRequestException(
      'Provide either date or both fromDate and toDate for the finance summary.',
    );
  }
  if (hasRange && (!query.fromDate || !query.toDate)) {
    throw new BadRequestException(
      'Both fromDate and toDate are required for a finance summary range.',
    );
  }
  if (timeZone !== NEPAL_TIME_ZONE) {
    throw new BadRequestException(
      `Finance summary dates support ${NEPAL_TIME_ZONE} only.`,
    );
  }

  const fromDate = query.date ?? query.fromDate!;
  const toDate = query.date ?? query.toDate!;
  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);
  const nominalFrom = Date.UTC(from.year, from.month - 1, from.day);
  const nominalTo = Date.UTC(to.year, to.month - 1, to.day);

  if (nominalTo < nominalFrom) {
    throw new BadRequestException('toDate must be on or after fromDate.');
  }
  const inclusiveDays = Math.floor((nominalTo - nominalFrom) / 86_400_000) + 1;
  if (inclusiveDays > 366) {
    throw new BadRequestException(
      'Finance summary date ranges are limited to 366 days.',
    );
  }

  const next = new Date(nominalTo + 86_400_000);
  return {
    fromDate,
    toDate,
    startUtc: zonedNepalDateTimeToUtc(from),
    endExclusiveUtc: zonedNepalDateTimeToUtc({
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    }),
  };
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new BadRequestException('Finance summary dates must use YYYY-MM-DD.');
  }
  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const probe = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (
    probe.getUTCFullYear() !== parsed.year ||
    probe.getUTCMonth() + 1 !== parsed.month ||
    probe.getUTCDate() !== parsed.day
  ) {
    throw new BadRequestException('Finance summary date is invalid.');
  }
  return parsed;
}

function decimalOrZero(value: Prisma.Decimal | null | undefined) {
  return value ?? new Prisma.Decimal(0);
}

function calculateOutstandingAmount(
  invoiceTotal: Prisma.Decimal | null | undefined,
  paidTotal: Prisma.Decimal | null | undefined,
  refundTotal: Prisma.Decimal | null | undefined,
) {
  return Prisma.Decimal.max(
    new Prisma.Decimal(0),
    decimalOrZero(invoiceTotal)
      .sub(decimalOrZero(paidTotal))
      .add(decimalOrZero(refundTotal)),
  );
}

function resolveFinancePagination(query: BaseFinanceListQueryDto) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 25;
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

function buildFinancePage<T>(
  items: T[],
  total: number,
  pagination: { page: number; limit: number; skip: number },
) {
  return {
    items,
    total,
    page: pagination.page,
    limit: pagination.limit,
    hasNextPage: pagination.skip + items.length < total,
  };
}

function mapCollectedPaymentResult(
  payment: CollectedPaymentWithReceipt,
  disposition: 'SUCCEEDED' | 'REPLAYED',
) {
  return {
    paymentId: payment.id,
    invoiceId: payment.invoiceId,
    amount: Number(payment.amount),
    method: payment.method,
    paidAt: payment.paidAt,
    disposition,
    receiptNumber: payment.receipt?.receiptNumber ?? null,
    receiptFileAssetId: payment.receipt?.fileAssetId ?? null,
    receiptFileStatus:
      payment.receipt?.fileStatus ?? ReceiptFileStatus.UNAVAILABLE,
  };
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

function toCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const headerLine = headers.map(escape).join(',');
  const rowLines = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(','),
  );
  return [headerLine, ...rowLines].join('\n');
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

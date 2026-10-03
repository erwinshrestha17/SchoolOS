import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PayrollRunStatus, Prisma } from '@prisma/client';
import type {
  PayrollBankAdviceExportSummary,
  PayrollBankAdviceStatus,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import { requireDomainPermission } from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import type { ExportPayrollBankAdviceDto } from './dto/payroll-bank-advice.dto';
import { maskBankAccount, validateBankDetails } from './payroll-bank-details';
import { formatMinor, toMinor } from './payroll-proration';
import { PayrollService } from './payroll.service';

const EXPORTABLE_STATUSES: PayrollRunStatus[] = [
  PayrollRunStatus.FINALIZED,
  PayrollRunStatus.POSTED,
];

export const BANK_ADVICE_CSV_HEADER =
  'Sequence,Employee ID,Beneficiary Name,Bank Name,Account Number,Amount,Currency,Reference';

export interface BankAdviceResult {
  csv: string;
  sequence: number;
  contentSha256: string;
  lineCount: number;
}

/**
 * Phase 7.9 — generic bank payment advice.
 *
 * A bank-agnostic CSV of what is payable by bank transfer for a finalized or
 * posted run. There is deliberately no bank-specific layout: that needs the
 * bank's own specification. Rules:
 *  - only lines whose salary structure pays by BANK, with a positive net, and
 *    without an active payment hold (held lines are counted, never exported);
 *  - bank details come from Staff, the single source (7.8), and must pass the
 *    generic validity rule — otherwise the export is refused with masked,
 *    machine-readable issues and nothing is recorded;
 *  - the run's source data must still match the fingerprint that was approved;
 *  - every export is logged append-only with the content hash and the approved
 *    fingerprint, and a repeated export needs a stated reason.
 */
@Injectable()
export class PayrollBankAdviceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly payrollService: PayrollService,
  ) {}

  async status(
    runId: string,
    actor: AuthContext,
  ): Promise<PayrollBankAdviceStatus> {
    requireDomainPermission(actor, 'payroll:run:read');
    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId },
      select: { id: true, status: true },
    });
    if (!run)
      throw new NotFoundException('Payroll run not found in this tenant');
    const [lines, holds, exports] = await Promise.all([
      this.prisma.payrollLine.findMany({
        where: { tenantId: actor.tenantId, payrollRunId: runId },
        select: {
          staffId: true,
          netSalary: true,
          salaryStructure: { select: { paymentMethod: true } },
        },
        take: 5000,
      }),
      this.prisma.payrollHold.findMany({
        where: {
          tenantId: actor.tenantId,
          payrollRunId: runId,
          status: 'ACTIVE',
        },
        select: { staffId: true },
        take: 5000,
      }),
      this.prisma.payrollBankAdviceExport.findMany({
        where: { tenantId: actor.tenantId, payrollRunId: runId },
        orderBy: { sequence: 'desc' },
        take: 100,
      }),
    ]);
    const held = new Set(holds.map((hold) => hold.staffId));
    const bankLines = lines.filter(
      (line) =>
        line.salaryStructure?.paymentMethod === PaymentMethod.BANK &&
        line.netSalary.isPositive(),
    );
    return {
      payrollRunId: runId,
      exportable: EXPORTABLE_STATUSES.includes(run.status),
      payableLineCount: bankLines.filter((line) => !held.has(line.staffId))
        .length,
      heldLineCount: bankLines.filter((line) => held.has(line.staffId)).length,
      exports: exports.map(serializeExport),
    };
  }

  async export(
    runId: string,
    dto: ExportPayrollBankAdviceDto,
    actor: AuthContext,
  ): Promise<BankAdviceResult> {
    requireDomainPermission(actor, 'payroll:bank-advice:export');
    const runHead = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId },
      select: { id: true },
    });
    if (!runHead)
      throw new NotFoundException('Payroll run not found in this tenant');

    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        'payroll:bank-advice:export',
        [],
        async (tx) => this.exportInTransaction(tx, runId, dto, actor),
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (
        message.includes('PAYROLL_BANK_ADVICE_SEQUENCE') ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034'))
      )
        throw new ConflictException({
          code: 'PAYROLL_BANK_ADVICE_CONCURRENT_EXPORT',
          message:
            'Another bank advice export for this run was recorded at the same time. Reload and retry.',
        });
      if (message.includes('PAYROLL_BANK_ADVICE_RUN_STATE'))
        throw new ConflictException({
          code: 'PAYROLL_BANK_ADVICE_RUN_STATE',
          message: 'Bank advice is only available for finalized or posted runs',
        });
      throw error;
    }
  }

  private async exportInTransaction(
    tx: Prisma.TransactionClient,
    runId: string,
    dto: ExportPayrollBankAdviceDto,
    actor: AuthContext,
  ): Promise<BankAdviceResult> {
    // Serialise exports of one run so sequence numbers are gapless.
    await tx.$queryRaw`SELECT "id" FROM "PayrollRun" WHERE "id" = ${runId} AND "tenantId" = ${actor.tenantId} FOR UPDATE`;
    const run = await tx.payrollRun.findFirst({
      where: { id: runId, tenantId: actor.tenantId },
      select: {
        id: true,
        status: true,
        periodYear: true,
        periodMonth: true,
        approvedSourceFingerprint: true,
      },
    });
    if (!run)
      throw new NotFoundException('Payroll run not found in this tenant');
    if (!EXPORTABLE_STATUSES.includes(run.status))
      throw new ConflictException({
        code: 'PAYROLL_BANK_ADVICE_RUN_STATE',
        message: 'Bank advice is only available for finalized or posted runs',
      });

    const fingerprint = await this.payrollService.currentSourceFingerprint(
      tx,
      run.id,
      actor.tenantId,
    );
    if (
      !run.approvedSourceFingerprint ||
      run.approvedSourceFingerprint !== fingerprint
    )
      throw new ConflictException({
        code: 'PAYROLL_BANK_ADVICE_SOURCE_CHANGED',
        message:
          'The payroll data changed after approval, so no bank advice can be issued from it. Cancel the run with a reason and prepare a replacement.',
      });

    const [lines, holds, previous] = await Promise.all([
      tx.payrollLine.findMany({
        where: { tenantId: actor.tenantId, payrollRunId: runId },
        select: {
          id: true,
          staffId: true,
          netSalary: true,
          staff: {
            select: {
              employeeId: true,
              firstName: true,
              lastName: true,
              bankName: true,
              bankAccount: true,
            },
          },
          salaryStructure: { select: { paymentMethod: true } },
        },
        orderBy: { staff: { employeeId: 'asc' } },
        take: 5000,
      }),
      tx.payrollHold.findMany({
        where: {
          tenantId: actor.tenantId,
          payrollRunId: runId,
          status: 'ACTIVE',
        },
        select: { staffId: true },
      }),
      tx.payrollBankAdviceExport.aggregate({
        where: { tenantId: actor.tenantId, payrollRunId: runId },
        _max: { sequence: true },
      }),
    ]);
    const held = new Set(holds.map((hold) => hold.staffId));
    const bankLines = lines.filter(
      (line) =>
        line.salaryStructure?.paymentMethod === PaymentMethod.BANK &&
        line.netSalary.isPositive(),
    );
    const payable = bankLines.filter((line) => !held.has(line.staffId));
    const heldCount = bankLines.length - payable.length;

    // Refuse — with masked, machine-readable issues — rather than emit a
    // payment instruction that a bank would reject or misdirect.
    const issues = payable.flatMap((line) =>
      validateBankDetails(line.staff).map((problem) => ({
        staffId: line.staffId,
        employeeId: line.staff.employeeId,
        problem,
        maskedAccount: line.staff.bankAccount
          ? maskBankAccount(line.staff.bankAccount)
          : null,
      })),
    );
    if (issues.length)
      throw new ConflictException({
        code: 'PAYROLL_BANK_ADVICE_INVALID_BANK_DETAILS',
        message:
          'Some staff bank details are missing or invalid. Correct the staff records, then export again.',
        issues,
      });
    if (payable.length === 0)
      throw new ConflictException({
        code: 'PAYROLL_BANK_ADVICE_NOTHING_PAYABLE',
        message:
          'No bank-paid, un-held line with a positive net exists in this run',
      });

    const lastSequence = previous._max.sequence ?? 0;
    if (lastSequence > 0 && !dto.reExportReason)
      throw new BadRequestException({
        code: 'PAYROLL_BANK_ADVICE_REEXPORT_REASON_REQUIRED',
        message:
          'A bank advice was already exported for this run. State the reason for exporting it again.',
      });

    const periodRef = `${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`;
    let total = 0n;
    const rows = payable.map((line, index) => {
      const amount = toMinor(line.netSalary.toFixed(2));
      total += amount;
      return [
        String(index + 1),
        textCell(line.staff.employeeId),
        textCell(`${line.staff.firstName} ${line.staff.lastName}`.trim()),
        textCell(line.staff.bankName ?? ''),
        textCell((line.staff.bankAccount ?? '').trim()),
        formatMinor(amount),
        'NPR',
        textCell(`PAYROLL-${periodRef}-${line.staff.employeeId}`),
      ].join(',');
    });
    const csv = `${[BANK_ADVICE_CSV_HEADER, ...rows].join('\r\n')}\r\n`;
    const contentSha256 = createHash('sha256').update(csv).digest('hex');
    const sequence = lastSequence + 1;

    const record = await tx.payrollBankAdviceExport.create({
      data: {
        tenantId: actor.tenantId,
        payrollRunId: runId,
        sequence,
        exportedById: actor.userId,
        lineCount: payable.length,
        heldLineCount: heldCount,
        totalAmount: formatMinor(total),
        sourceFingerprint: fingerprint,
        contentSha256,
        reExportReason: lastSequence > 0 ? (dto.reExportReason ?? null) : null,
      },
    });
    // Audit carries counts and hashes only — never names or account numbers.
    await this.auditService.record(
      {
        action: 'export',
        resource: 'payroll_bank_advice',
        tenantId: actor.tenantId,
        userId: actor.userId,
        resourceId: record.id,
        after: {
          payrollRunId: runId,
          sequence,
          lineCount: payable.length,
          heldLineCount: heldCount,
          totalAmount: formatMinor(total),
          contentSha256,
          sourceFingerprint: fingerprint,
          reExportReason: record.reExportReason,
        },
      },
      tx,
    );
    return { csv, sequence, contentSha256, lineCount: payable.length };
  }
}

function serializeExport(
  row: Prisma.PayrollBankAdviceExportGetPayload<object>,
): PayrollBankAdviceExportSummary {
  return {
    id: row.id,
    sequence: row.sequence,
    exportedAt: row.exportedAt.toISOString(),
    exportedById: row.exportedById,
    lineCount: row.lineCount,
    heldLineCount: row.heldLineCount,
    totalAmount: row.totalAmount.toFixed(2),
    contentSha256: row.contentSha256,
    reExportReason: row.reExportReason,
  };
}

/**
 * A free-text CSV cell: quoted when needed, and neutralised against spreadsheet
 * formula injection (a leading = + - @ tab or CR makes Excel/Sheets evaluate it).
 */
export function textCell(value: string): string {
  let text = value.replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

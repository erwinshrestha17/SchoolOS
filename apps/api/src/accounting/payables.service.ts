import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountingPostingBatchStatus,
  AccountingReportMappingType,
  ChartAccountType,
  FinanceExpenseStatus,
  FinancePayableStatus,
  FinanceVendorStatus,
  JournalEntryStatus,
  JournalLineSide,
  JournalSourceType,
  Prisma,
} from '@prisma/client';
import {
  agingBucketForDays,
  buildResourceAuthorization,
  daysOverdueOn,
  getNepalSchoolDay,
  RECEIVABLES_AGING_BUCKETS,
  type ReceivablesAgingBucket,
} from '@schoolos/core';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { withSchoolAuthorizationTransaction } from '../auth/school-authorization-transaction';
import {
  hasDomainPermission,
  requireDomainPermission,
  requireIndependentActor,
} from '../authorization/policies/domain-permission';
import { isFinancialTransactionConflict } from '../authorization/policies/financial-transaction-conflict';
import { allocateDocumentNumber } from '../common/document-sequence';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingPostingService } from './accounting-posting.service';
import { resolveActorNames } from './accounting-source-resolver.service';
import type {
  ApproveVendorBillDto,
  CreateVendorBillDto,
  CreateVendorDto,
  ListPayablesQueryDto,
  ListVendorBillsQueryDto,
  ListVendorsQueryDto,
  PayablesAgingQueryDto,
  ReasonDto,
  ReverseWithDateDto,
  SettlePayableDto,
  UpdateVendorBillDto,
  UpdateVendorDto,
} from './dto/payables.dto';
import { ledgerEntryWhere, reportRangeEndExclusive } from './ledger-scope';

/**
 * Phase 7.11c — accounts payable as an auditable domain.
 *
 * - Duties (decision P3): the preparer (`accounting:expenses:write`), the
 *   approver (`accounting:expenses:approve`) and the payer
 *   (`accounting:payables:settle`) must be three different people. Reversals
 *   use `accounting:journals:reverse` and must differ from the original actor.
 * - Accounts (decision P2): Accounts Payable, VAT input and TDS payable come
 *   from the school's report mappings. Exactly one mapping is required; a
 *   missing or ambiguous mapping refuses with a stable code. Nothing is ever
 *   auto-created.
 * - Tax (decision P4): VAT and withheld tax are typed from the bill. Nothing
 *   computes a rate.
 * - Approval posts the bill (Dr expense [+ Dr VAT input] / Cr AP) and opens the
 *   payable in one serializable, live-authorized transaction. A payment posts
 *   Dr AP / Cr cash-or-bank / Cr TDS payable. The database guards the state
 *   machine, the balance and the duties as well (migration 20261003210000).
 * - Canteen purchase bills keep their own direct posting (decision P5).
 */

const MODULE = 'PAYABLES';
const BILL_POSTING = 'BILL';
const PAYMENT_POSTING = 'PAYMENT';
const ENTITLEMENT = { module: 'accounting', state: 'ENABLED' } as const;
const ZERO = () => new Prisma.Decimal(0);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Tx = Prisma.TransactionClient;
type Bucket = ReceivablesAgingBucket;

function refuse(code: string, message: string): never {
  throw new ConflictException({ code, message });
}

function dateOnly(value: string, field: string): Date {
  if (!DATE_ONLY.test(value))
    throw new BadRequestException(`${field} must be a YYYY-MM-DD date`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new BadRequestException(`${field} must be a valid calendar date`);
  return parsed;
}

function dateKey(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function nepalToday(): string {
  return getNepalSchoolDay(new Date()).gregorianDate;
}

function money(value: Prisma.Decimal.Value | null | undefined) {
  return new Prisma.Decimal(value ?? 0).toFixed(2);
}

function blankToNull(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Name used only to catch the same vendor entered twice. */
export function vendorDuplicateKey(legalName: string): string {
  return legalName
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

interface BillContent {
  vendorId: string | null;
  vendorBillNumber: string | null;
  expenseDate: Date;
  dueDate: Date | null;
  description: string;
  expenseAccountId: string;
  amount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  supportingFileAssetId: string | null;
  fiscalPeriodId: string | null;
}

/** sha256 over everything an approver signs off on. */
export function billContentFingerprint(bill: BillContent): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        'vendor-bill:v1',
        bill.vendorId,
        bill.vendorBillNumber,
        dateKey(bill.expenseDate),
        dateKey(bill.dueDate),
        bill.description,
        bill.expenseAccountId,
        money(bill.amount),
        money(bill.taxAmount),
        money(bill.totalAmount),
        bill.supportingFileAssetId,
        bill.fiscalPeriodId,
      ]),
    )
    .digest('hex');
}

/** True when a payables database guard or CHECK refused the write. */
export function isPayablesGuardViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.message} ${JSON.stringify(
    (error as { meta?: unknown }).meta ?? null,
  )}`;
  return /Finance(Expense|Payable|PayableSettlement|Vendor)_(guard|amounts|posted_evidence|independent_approver|rejection_reason|reversal_evidence|status_amounts|pan_format|names_present)/.test(
    text,
  );
}

function guardMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : '';
  const match = /Finance\w+_guard: ([^\n"]+)/.exec(text);
  return match
    ? match[1].trim()
    : 'The payables record does not allow this change.';
}

function uniqueViolationText(error: unknown): string | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    if (
      error instanceof Error &&
      /unique constraint|duplicate key/i.test(error.message)
    )
      return error.message;
    return null;
  }
  if (error.code !== 'P2002' && !/duplicate key|unique/i.test(error.message))
    return null;
  return `${error.message} ${JSON.stringify(error.meta ?? null)}`;
}

const VENDOR_SELECT = {
  id: true,
  vendorCode: true,
  legalName: true,
  displayName: true,
  panNumber: true,
  phone: true,
  email: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FinanceVendorSelect;

const BILL_INCLUDE = {
  vendor: {
    select: { id: true, vendorCode: true, displayName: true, panNumber: true },
  },
  expenseAccount: { select: { id: true, code: true, name: true } },
  payable: {
    select: {
      id: true,
      payableNumber: true,
      status: true,
      originalAmount: true,
      outstandingAmount: true,
    },
  },
} satisfies Prisma.FinanceExpenseInclude;

type BillRow = Prisma.FinanceExpenseGetPayload<{
  include: typeof BILL_INCLUDE;
}>;

const SETTLEMENT_INCLUDE = {
  paymentAccount: { select: { id: true, code: true, name: true } },
  reversals: { select: { id: true } },
} satisfies Prisma.FinancePayableSettlementInclude;

type SettlementRow = Prisma.FinancePayableSettlementGetPayload<{
  include: typeof SETTLEMENT_INCLUDE;
}>;

const PAYABLE_INCLUDE = {
  vendor: {
    select: { id: true, vendorCode: true, displayName: true, panNumber: true },
  },
  expense: {
    select: {
      id: true,
      expenseNumber: true,
      vendorBillNumber: true,
      description: true,
      expenseDate: true,
      createdById: true,
      submittedById: true,
      approvedById: true,
    },
  },
} satisfies Prisma.FinancePayableInclude;

type PayableRow = Prisma.FinancePayableGetPayload<{
  include: typeof PAYABLE_INCLUDE;
}>;

interface ResolvedAccount {
  id: string;
  code: string;
  name: string;
}

@Injectable()
export class PayablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly postingService: AccountingPostingService,
  ) {}

  // ─── Transactions ──────────────────────────────────────────────────

  /**
   * Every payables write: domain permission at the service boundary, then a
   * serializable transaction that re-checks the live session and grant.
   * Serialization failures and database guard refusals become 409s.
   */
  private async write<T>(
    actor: AuthContext,
    permission: string,
    work: (tx: Tx) => Promise<T>,
  ): Promise<T> {
    requireDomainPermission(actor, permission);
    try {
      return await withSchoolAuthorizationTransaction(
        this.prisma,
        actor,
        permission,
        [],
        work,
        false,
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isFinancialTransactionConflict(error))
        refuse(
          'PAYABLES_CONCURRENT_CHANGE',
          'The payables record changed while this was being saved. Reload and try again.',
        );
      if (isPayablesGuardViolation(error))
        refuse('PAYABLES_GUARD_REFUSED', guardMessage(error));
      throw error;
    }
  }

  private read<T>(actor: AuthContext, work: () => Promise<T>): Promise<T> {
    return this.prisma.runWithTenantScope(actor.tenantId, work);
  }

  // ─── Setup (mappings) ──────────────────────────────────────────────

  async getSetup(actor: AuthContext) {
    return this.read(actor, async () => {
      const [mappings, expenseAccounts] = await Promise.all([
        this.prisma.accountingReportAccountMapping.findMany({
          where: {
            tenantId: actor.tenantId,
            mappingType: {
              in: [
                AccountingReportMappingType.ACCOUNTS_PAYABLE,
                AccountingReportMappingType.VAT_INPUT,
                AccountingReportMappingType.TDS_PAYABLE,
                AccountingReportMappingType.CASH,
                AccountingReportMappingType.BANK,
              ],
            },
          },
          include: {
            account: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                isActive: true,
                archivedAt: true,
              },
            },
          },
          orderBy: [{ mappingType: 'asc' }, { account: { code: 'asc' } }],
        }),
        this.prisma.chartAccount.findMany({
          where: {
            tenantId: actor.tenantId,
            type: ChartAccountType.EXPENSE,
            isActive: true,
            archivedAt: null,
          },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        }),
      ]);
      const single = (
        type: AccountingReportMappingType,
        accountType: ChartAccountType,
      ) => {
        const rows = mappings.filter((m) => m.mappingType === type);
        const usable = rows.filter(
          (m) =>
            m.account.isActive &&
            !m.account.archivedAt &&
            m.account.type === accountType,
        );
        const state =
          rows.length === 0
            ? 'MISSING'
            : rows.length > 1
              ? 'AMBIGUOUS'
              : usable.length === 1
                ? 'READY'
                : 'INVALID';
        return {
          mappingType: type,
          state,
          account:
            rows.length === 1
              ? {
                  id: rows[0].account.id,
                  code: rows[0].account.code,
                  name: rows[0].account.name,
                }
              : null,
        };
      };
      const accountsPayable = single(
        AccountingReportMappingType.ACCOUNTS_PAYABLE,
        ChartAccountType.LIABILITY,
      );
      const tdsPayable = single(
        AccountingReportMappingType.TDS_PAYABLE,
        ChartAccountType.LIABILITY,
      );
      const vatInputRows = mappings.filter(
        (m) => m.mappingType === AccountingReportMappingType.VAT_INPUT,
      );
      const vatInput = {
        mappingType: AccountingReportMappingType.VAT_INPUT,
        state:
          vatInputRows.length === 0
            ? 'MISSING'
            : vatInputRows.length > 1
              ? 'AMBIGUOUS'
              : vatInputRows[0].account.isActive &&
                  !vatInputRows[0].account.archivedAt &&
                  (vatInputRows[0].account.type === ChartAccountType.ASSET ||
                    vatInputRows[0].account.type === ChartAccountType.LIABILITY)
                ? 'READY'
                : 'INVALID',
        account:
          vatInputRows.length === 1
            ? {
                id: vatInputRows[0].account.id,
                code: vatInputRows[0].account.code,
                name: vatInputRows[0].account.name,
              }
            : null,
      };
      const paymentAccounts = mappings
        .filter(
          (m) =>
            (m.mappingType === AccountingReportMappingType.CASH ||
              m.mappingType === AccountingReportMappingType.BANK) &&
            m.account.isActive &&
            !m.account.archivedAt &&
            m.account.type === ChartAccountType.ASSET,
        )
        .map((m) => ({
          id: m.account.id,
          code: m.account.code,
          name: m.account.name,
          kind: m.mappingType,
        }));
      return {
        ready: accountsPayable.state === 'READY',
        accountsPayable,
        vatInput,
        tdsPayable,
        paymentAccounts,
        expenseAccounts,
        taxPolicy:
          'VAT and withheld tax are entered from the vendor bill. SchoolOS does not compute tax rates.',
      };
    });
  }

  /** Exactly one usable mapped account, else a stable refusal. */
  private async mappedAccount(
    tx: Tx,
    tenantId: string,
    type: AccountingReportMappingType,
    allowed: ChartAccountType[],
  ): Promise<ResolvedAccount> {
    const rows = await tx.accountingReportAccountMapping.findMany({
      where: { tenantId, mappingType: type },
      include: { account: true },
    });
    if (rows.length === 0)
      refuse(
        'PAYABLES_MAPPING_MISSING',
        `Map one ${type} account in accounting report settings before posting payables.`,
      );
    if (rows.length > 1)
      refuse(
        'PAYABLES_MAPPING_AMBIGUOUS',
        `More than one account is mapped as ${type}. Keep exactly one.`,
      );
    const account = rows[0].account;
    if (
      account.tenantId !== tenantId ||
      !account.isActive ||
      account.archivedAt ||
      !allowed.includes(account.type)
    )
      refuse(
        'PAYABLES_MAPPING_INVALID',
        `The account mapped as ${type} must be an active ${allowed.join(' or ')} account.`,
      );
    return { id: account.id, code: account.code, name: account.name };
  }

  private async paymentAccount(
    tx: Tx,
    tenantId: string,
    accountId: string,
  ): Promise<ResolvedAccount> {
    const mapping = await tx.accountingReportAccountMapping.findFirst({
      where: {
        tenantId,
        accountId,
        mappingType: {
          in: [
            AccountingReportMappingType.CASH,
            AccountingReportMappingType.BANK,
          ],
        },
      },
      include: { account: true },
    });
    const account = mapping?.account;
    if (
      !account ||
      account.tenantId !== tenantId ||
      !account.isActive ||
      account.archivedAt ||
      account.type !== ChartAccountType.ASSET
    )
      refuse(
        'PAYMENT_ACCOUNT_INVALID',
        'Pay from an active account mapped as cash or bank.',
      );
    return { id: account.id, code: account.code, name: account.name };
  }

  // ─── Vendors ───────────────────────────────────────────────────────

  async listVendors(actor: AuthContext, query: ListVendorsQueryDto) {
    requireDomainPermission(actor, 'accounting:vendors:read');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const where: Prisma.FinanceVendorWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { vendorCode: { contains: search, mode: 'insensitive' } },
              { panNumber: { contains: search } },
            ],
          }
        : {}),
    };
    return this.read(actor, async () => {
      const [rows, total] = await Promise.all([
        this.prisma.financeVendor.findMany({
          where,
          select: VENDOR_SELECT,
          orderBy: [{ status: 'asc' }, { displayName: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.financeVendor.count({ where }),
      ]);
      const balances = rows.length
        ? await this.prisma.financePayable.groupBy({
            by: ['vendorId'],
            where: {
              tenantId: actor.tenantId,
              vendorId: { in: rows.map((row) => row.id) },
              status: {
                in: [
                  FinancePayableStatus.OPEN,
                  FinancePayableStatus.PARTIALLY_PAID,
                ],
              },
            },
            _sum: { outstandingAmount: true },
          })
        : [];
      const balanceByVendor = new Map(
        balances.map((row) => [row.vendorId, row._sum.outstandingAmount]),
      );
      return {
        items: rows.map((row) =>
          this.vendorView(actor, row, balanceByVendor.get(row.id) ?? null),
        ),
        pagination: { page, limit, total },
      };
    });
  }

  private vendorView(
    actor: AuthContext,
    row: Prisma.FinanceVendorGetPayload<{ select: typeof VENDOR_SELECT }>,
    outstanding: Prisma.Decimal | null,
  ) {
    const write = hasDomainPermission(actor, 'accounting:vendors:write');
    return {
      ...row,
      outstandingAmount: money(outstanding),
      authorization: buildResourceAuthorization({
        actions: {
          update: write,
          deactivate: write && row.status === FinanceVendorStatus.ACTIVE,
        },
        sections: { contact: true },
        lifecycleState: row.status,
        entitlementState: ENTITLEMENT,
      }),
    };
  }

  async createVendor(actor: AuthContext, dto: CreateVendorDto) {
    const vendor = await this.write(
      actor,
      'accounting:vendors:write',
      async (tx) => {
        const legalName = dto.legalName.trim();
        const duplicateKey = vendorDuplicateKey(legalName);
        await this.assertVendorUnique(tx, actor.tenantId, {
          duplicateKey,
          panNumber: dto.panNumber ?? null,
        });
        const sequence = await allocateDocumentNumber(
          tx,
          actor.tenantId,
          'VENDOR',
        );
        const created = await tx.financeVendor.create({
          data: {
            tenantId: actor.tenantId,
            vendorCode: `VEN-${String(sequence).padStart(4, '0')}`,
            legalName,
            displayName: blankToNull(dto.displayName) ?? legalName,
            panNumber: dto.panNumber ?? null,
            phone: blankToNull(dto.phone),
            email: blankToNull(dto.email),
            address: blankToNull(dto.address),
            duplicateKey,
            createdById: actor.userId,
          },
          select: VENDOR_SELECT,
        });
        await this.auditService.record(
          {
            action: 'create',
            resource: 'finance_vendor',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: created.id,
            after: {
              vendorCode: created.vendorCode,
              hasPan: Boolean(created.panNumber),
            },
          },
          tx,
        );
        return created;
      },
    ).catch((error: unknown) => this.rethrowVendorUnique(error));
    return this.vendorView(actor, vendor, null);
  }

  async updateVendor(actor: AuthContext, id: string, dto: UpdateVendorDto) {
    const vendor = await this.write(
      actor,
      'accounting:vendors:write',
      async (tx) => {
        const existing = await tx.financeVendor.findFirst({
          where: { id, tenantId: actor.tenantId },
        });
        if (!existing) throw new NotFoundException('Vendor not found');
        const legalName = dto.legalName?.trim() ?? existing.legalName;
        const duplicateKey = vendorDuplicateKey(legalName);
        const panNumber =
          dto.panNumber === undefined
            ? existing.panNumber
            : blankToNull(dto.panNumber);
        if (existing.status === FinanceVendorStatus.ACTIVE)
          await this.assertVendorUnique(tx, actor.tenantId, {
            duplicateKey,
            panNumber,
            exceptId: existing.id,
          });
        const updated = await tx.financeVendor.update({
          where: { id: existing.id },
          data: {
            legalName,
            duplicateKey,
            displayName:
              dto.displayName === undefined
                ? existing.displayName
                : (blankToNull(dto.displayName) ?? legalName),
            panNumber,
            ...(dto.phone !== undefined
              ? { phone: blankToNull(dto.phone) }
              : {}),
            ...(dto.email !== undefined
              ? { email: blankToNull(dto.email) }
              : {}),
            ...(dto.address !== undefined
              ? { address: blankToNull(dto.address) }
              : {}),
          },
          select: VENDOR_SELECT,
        });
        await this.auditService.record(
          {
            action: 'update',
            resource: 'finance_vendor',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            before: {
              legalName: existing.legalName,
              hasPan: Boolean(existing.panNumber),
            },
            after: {
              legalName: updated.legalName,
              hasPan: Boolean(updated.panNumber),
            },
          },
          tx,
        );
        return updated;
      },
    ).catch((error: unknown) => this.rethrowVendorUnique(error));
    return this.vendorView(actor, vendor, null);
  }

  async deactivateVendor(actor: AuthContext, id: string, dto: ReasonDto) {
    const vendor = await this.write(
      actor,
      'accounting:vendors:write',
      async (tx) => {
        const existing = await tx.financeVendor.findFirst({
          where: { id, tenantId: actor.tenantId },
        });
        if (!existing) throw new NotFoundException('Vendor not found');
        if (existing.status !== FinanceVendorStatus.ACTIVE)
          refuse('VENDOR_INACTIVE', 'This vendor is already inactive.');
        const open = await tx.financeExpense.count({
          where: {
            tenantId: actor.tenantId,
            vendorId: existing.id,
            status: {
              in: [FinanceExpenseStatus.DRAFT, FinanceExpenseStatus.SUBMITTED],
            },
          },
        });
        if (open > 0)
          refuse(
            'VENDOR_HAS_PENDING_BILLS',
            'Finish or reject the draft and submitted bills of this vendor first.',
          );
        const updated = await tx.financeVendor.update({
          where: { id: existing.id },
          data: { status: FinanceVendorStatus.INACTIVE },
          select: VENDOR_SELECT,
        });
        await this.auditService.record(
          {
            action: 'deactivate',
            resource: 'finance_vendor',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: updated.id,
            after: { status: updated.status, reason: dto.reason.trim() },
          },
          tx,
        );
        return updated;
      },
    );
    return this.vendorView(actor, vendor, null);
  }

  private async assertVendorUnique(
    tx: Tx,
    tenantId: string,
    input: {
      duplicateKey: string;
      panNumber: string | null;
      exceptId?: string;
    },
  ) {
    const [sameName, samePan] = await Promise.all([
      tx.financeVendor.findFirst({
        where: {
          tenantId,
          status: FinanceVendorStatus.ACTIVE,
          duplicateKey: input.duplicateKey,
          ...(input.exceptId ? { id: { not: input.exceptId } } : {}),
        },
        select: { vendorCode: true },
      }),
      input.panNumber
        ? tx.financeVendor.findFirst({
            where: {
              tenantId,
              status: FinanceVendorStatus.ACTIVE,
              panNumber: input.panNumber,
              ...(input.exceptId ? { id: { not: input.exceptId } } : {}),
            },
            select: { vendorCode: true },
          })
        : Promise.resolve(null),
    ]);
    if (sameName)
      refuse(
        'VENDOR_DUPLICATE',
        `An active vendor with this name already exists (${sameName.vendorCode}).`,
      );
    if (samePan)
      refuse(
        'VENDOR_PAN_DUPLICATE',
        `An active vendor with this PAN already exists (${samePan.vendorCode}).`,
      );
  }

  private rethrowVendorUnique(error: unknown): never {
    const text = uniqueViolationText(error);
    if (text && /duplicate_key|duplicateKey/.test(text))
      refuse(
        'VENDOR_DUPLICATE',
        'An active vendor with this name already exists.',
      );
    throw error;
  }

  // ─── Vendor bills (expenses) ───────────────────────────────────────

  async listBills(actor: AuthContext, query: ListVendorBillsQueryDto) {
    requireDomainPermission(actor, 'accounting:expenses:read');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const where: Prisma.FinanceExpenseWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(search
        ? {
            OR: [
              { expenseNumber: { contains: search, mode: 'insensitive' } },
              { vendorBillNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                vendor: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    return this.read(actor, async () => {
      const [rows, total] = await Promise.all([
        this.prisma.financeExpense.findMany({
          where,
          include: BILL_INCLUDE,
          orderBy: [{ expenseDate: 'desc' }, { expenseNumber: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.financeExpense.count({ where }),
      ]);
      const views = await this.billViews(actor, rows);
      return { items: views, pagination: { page, limit, total } };
    });
  }

  async getBill(actor: AuthContext, id: string) {
    requireDomainPermission(actor, 'accounting:expenses:read');
    return this.read(actor, async () => {
      const row = await this.prisma.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: BILL_INCLUDE,
      });
      if (!row) throw new NotFoundException('Vendor bill not found');
      const [view] = await this.billViews(actor, [row]);
      return view;
    });
  }

  private async billViews(actor: AuthContext, rows: BillRow[]) {
    const userIds = rows.flatMap((row) => [
      row.createdById,
      row.submittedById,
      row.approvedById,
      row.rejectedById,
      row.reversedById,
    ]);
    const names = await resolveActorNames(this.prisma, actor.tenantId, [
      ...new Set(userIds.filter((id): id is string => Boolean(id))),
    ]);
    const journals = rows.length
      ? await this.prisma.journalEntry.findMany({
          where: {
            tenantId: actor.tenantId,
            sourceModule: MODULE,
            sourceType: JournalSourceType.EXPENSE_VOUCHER,
            postingType: BILL_POSTING,
            sourceId: { in: rows.map((row) => row.id) },
          },
          select: { id: true, sourceId: true, entryNumber: true },
        })
      : [];
    const journalByBill = new Map(journals.map((j) => [j.sourceId, j]));
    const event = (duty: string, id: string | null, at: Date | null) =>
      id
        ? [{ duty, actor: { id, name: names.get(id) ?? 'Unknown user' }, at }]
        : [];
    return rows.map((row) => {
      const journal = journalByBill.get(row.id) ?? null;
      return {
        id: row.id,
        expenseNumber: row.expenseNumber,
        vendor: row.vendor,
        vendorBillNumber: row.vendorBillNumber,
        expenseDate: dateKey(row.expenseDate),
        dueDate: dateKey(row.dueDate),
        description: row.description,
        expenseAccount: row.expenseAccount,
        amount: money(row.amount),
        taxAmount: money(row.taxAmount),
        totalAmount: money(row.totalAmount),
        status: row.status,
        supportingFileAssetId: row.supportingFileAssetId,
        fiscalYearId: row.fiscalYearId,
        fiscalPeriodId: row.fiscalPeriodId,
        contentFingerprint: billContentFingerprint(row),
        rejection: row.rejectedAt
          ? {
              at: row.rejectedAt,
              reason: row.rejectionReason,
              actor: row.rejectedById
                ? {
                    id: row.rejectedById,
                    name: names.get(row.rejectedById) ?? 'Unknown user',
                  }
                : null,
            }
          : null,
        reversalReason:
          row.status === FinanceExpenseStatus.REVERSED
            ? row.correctionReason
            : null,
        events: [
          ...event('PREPARE', row.createdById, row.createdAt),
          ...event('SUBMIT', row.submittedById, row.submittedAt),
          ...event('APPROVE', row.approvedById, row.approvedAt),
          ...event('REVERSE', row.reversedById, row.reversedAt),
        ],
        payable: row.payable
          ? {
              id: row.payable.id,
              payableNumber: row.payable.payableNumber,
              status: row.payable.status,
              originalAmount: money(row.payable.originalAmount),
              outstandingAmount: money(row.payable.outstandingAmount),
            }
          : null,
        journal: journal
          ? { id: journal.id, entryNumber: journal.entryNumber }
          : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        authorization: this.billAuthorization(actor, row),
      };
    });
  }

  private billAuthorization(actor: AuthContext, row: BillRow) {
    const me = actor.userId;
    const notPreparer = me !== row.createdById && me !== row.submittedById;
    const write = hasDomainPermission(actor, 'accounting:expenses:write');
    const approve = hasDomainPermission(actor, 'accounting:expenses:approve');
    const reverse = hasDomainPermission(actor, 'accounting:journals:reverse');
    const draft = row.status === FinanceExpenseStatus.DRAFT;
    const submitted = row.status === FinanceExpenseStatus.SUBMITTED;
    const unpaid =
      row.payable !== null &&
      row.payable.outstandingAmount.equals(row.payable.originalAmount);
    return buildResourceAuthorization({
      actions: {
        update: write && draft,
        submit: write && draft,
        approve: approve && submitted && notPreparer,
        reject: approve && submitted && notPreparer,
        reverse:
          reverse &&
          row.status === FinanceExpenseStatus.POSTED &&
          unpaid &&
          me !== row.approvedById,
      },
      sections: { amounts: true, approvals: true },
      lifecycleState: row.status,
      entitlementState: ENTITLEMENT,
    });
  }

  /** Validate and normalize bill content shared by create and update. */
  private async billContent(
    tx: Tx,
    tenantId: string,
    input: {
      vendorId: string | null;
      vendorBillNumber: string | null;
      expenseDate: Date;
      dueDate: Date | null;
      description: string;
      expenseAccountId: string;
      amount: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      supportingFileAssetId: string | null;
    },
    exceptId?: string,
  ) {
    if (!input.amount.gt(0))
      throw new BadRequestException('amount must be greater than zero');
    if (input.taxAmount.lt(0))
      throw new BadRequestException('taxAmount cannot be negative');
    if (input.dueDate && input.dueDate < input.expenseDate)
      throw new BadRequestException('dueDate cannot be before the bill date');
    if (!input.vendorId) throw new BadRequestException('A vendor is required');
    const [vendor, account, period, file] = await Promise.all([
      tx.financeVendor.findFirst({
        where: { id: input.vendorId, tenantId },
        select: { id: true, status: true },
      }),
      tx.chartAccount.findFirst({
        where: { id: input.expenseAccountId, tenantId },
        select: { id: true, type: true, isActive: true, archivedAt: true },
      }),
      tx.fiscalPeriod.findFirst({
        where: {
          tenantId,
          startDate: { lte: input.expenseDate },
          endDate: { gte: input.expenseDate },
        },
        select: { id: true, fiscalYearId: true },
      }),
      input.supportingFileAssetId
        ? tx.fileAsset.findFirst({
            where: { id: input.supportingFileAssetId, tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status !== FinanceVendorStatus.ACTIVE)
      refuse(
        'VENDOR_INACTIVE',
        'Bills can only be recorded for active vendors.',
      );
    if (
      !account ||
      account.type !== ChartAccountType.EXPENSE ||
      !account.isActive ||
      account.archivedAt
    )
      refuse(
        'EXPENSE_ACCOUNT_INVALID',
        'Choose an active expense account for this bill.',
      );
    if (!period)
      refuse(
        'FISCAL_PERIOD_NOT_FOUND',
        'No fiscal period covers the bill date. Set up the fiscal year first.',
      );
    if (input.supportingFileAssetId && !file)
      throw new NotFoundException('Supporting document not found');
    if (input.vendorBillNumber) {
      const duplicate = await tx.financeExpense.findFirst({
        where: {
          tenantId,
          vendorId: input.vendorId,
          vendorBillNumber: {
            equals: input.vendorBillNumber,
            mode: 'insensitive',
          },
          status: { not: FinanceExpenseStatus.REVERSED },
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
        select: { expenseNumber: true },
      });
      if (duplicate)
        refuse(
          'VENDOR_BILL_DUPLICATE',
          `This vendor bill number is already recorded (${duplicate.expenseNumber}).`,
        );
    }
    const totalAmount = input.amount.add(input.taxAmount);
    const content: BillContent = {
      vendorId: input.vendorId,
      vendorBillNumber: input.vendorBillNumber,
      expenseDate: input.expenseDate,
      dueDate: input.dueDate,
      description: input.description,
      expenseAccountId: input.expenseAccountId,
      amount: input.amount,
      taxAmount: input.taxAmount,
      totalAmount,
      supportingFileAssetId: input.supportingFileAssetId,
      fiscalPeriodId: period.id,
    };
    return {
      content,
      fiscalYearId: period.fiscalYearId,
      duplicateFingerprint: createHash('sha256')
        .update(
          [input.vendorId, money(totalAmount), dateKey(input.expenseDate)].join(
            '|',
          ),
        )
        .digest('hex'),
    };
  }

  async createBill(actor: AuthContext, dto: CreateVendorBillDto) {
    const idempotencyKey = dto.idempotencyKey.trim();
    const replay = async () => {
      const existing = await this.read(actor, () =>
        this.prisma.financeExpense.findFirst({
          where: { tenantId: actor.tenantId, idempotencyKey },
          select: { id: true, createdById: true },
        }),
      );
      if (!existing) return null;
      if (existing.createdById !== actor.userId)
        refuse(
          'IDEMPOTENCY_KEY_REUSED',
          'This request key was already used for a different bill.',
        );
      return this.getBill(actor, existing.id);
    };
    const replayed = await replay();
    if (replayed) return replayed;
    try {
      const id = await this.write(
        actor,
        'accounting:expenses:write',
        async (tx) => {
          const { content, fiscalYearId, duplicateFingerprint } =
            await this.billContent(tx, actor.tenantId, {
              vendorId: dto.vendorId,
              vendorBillNumber: blankToNull(dto.vendorBillNumber),
              expenseDate: dateOnly(dto.expenseDate, 'expenseDate'),
              dueDate: dto.dueDate ? dateOnly(dto.dueDate, 'dueDate') : null,
              description: dto.description.trim(),
              expenseAccountId: dto.expenseAccountId,
              amount: new Prisma.Decimal(dto.amount),
              taxAmount: new Prisma.Decimal(dto.taxAmount ?? 0),
              supportingFileAssetId: dto.supportingFileAssetId ?? null,
            });
          const sequence = await allocateDocumentNumber(
            tx,
            actor.tenantId,
            'VENDOR_BILL',
          );
          const created = await tx.financeExpense.create({
            data: {
              tenantId: actor.tenantId,
              expenseNumber: `BILL-${String(sequence).padStart(6, '0')}`,
              ...content,
              fiscalYearId,
              duplicateFingerprint,
              idempotencyKey,
              createdById: actor.userId,
              status: FinanceExpenseStatus.DRAFT,
            },
            select: { id: true, expenseNumber: true, totalAmount: true },
          });
          await this.auditService.record(
            {
              action: 'create',
              resource: 'vendor_bill',
              tenantId: actor.tenantId,
              userId: actor.userId,
              resourceId: created.id,
              after: {
                expenseNumber: created.expenseNumber,
                totalAmount: money(created.totalAmount),
              },
            },
            tx,
          );
          return created.id;
        },
      );
      return await this.getBill(actor, id);
    } catch (error) {
      const text = uniqueViolationText(error);
      if (text && text.includes('idempotencyKey')) {
        const again = await replay();
        if (again) return again;
      }
      if (text && text.includes('vendor_bill_key'))
        refuse(
          'VENDOR_BILL_DUPLICATE',
          'This vendor bill number is already recorded.',
        );
      throw error;
    }
  }

  async updateBill(actor: AuthContext, id: string, dto: UpdateVendorBillDto) {
    await this.write(actor, 'accounting:expenses:write', async (tx) => {
      const existing = await tx.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException('Vendor bill not found');
      if (existing.status !== FinanceExpenseStatus.DRAFT)
        refuse('EXPENSE_STATE_CONFLICT', 'Only a draft bill can be edited.');
      const { content, fiscalYearId, duplicateFingerprint } =
        await this.billContent(
          tx,
          actor.tenantId,
          {
            vendorId: dto.vendorId ?? existing.vendorId,
            vendorBillNumber:
              dto.vendorBillNumber === undefined
                ? existing.vendorBillNumber
                : blankToNull(dto.vendorBillNumber),
            expenseDate: dto.expenseDate
              ? dateOnly(dto.expenseDate, 'expenseDate')
              : existing.expenseDate,
            dueDate:
              dto.dueDate === undefined
                ? existing.dueDate
                : dto.dueDate
                  ? dateOnly(dto.dueDate, 'dueDate')
                  : null,
            description: dto.description?.trim() ?? existing.description,
            expenseAccountId: dto.expenseAccountId ?? existing.expenseAccountId,
            amount: dto.amount
              ? new Prisma.Decimal(dto.amount)
              : existing.amount,
            taxAmount:
              dto.taxAmount !== undefined
                ? new Prisma.Decimal(dto.taxAmount)
                : existing.taxAmount,
            supportingFileAssetId:
              dto.supportingFileAssetId === undefined
                ? existing.supportingFileAssetId
                : blankToNull(dto.supportingFileAssetId),
          },
          existing.id,
        );
      await tx.financeExpense.update({
        where: { id: existing.id },
        data: { ...content, fiscalYearId, duplicateFingerprint },
      });
      await this.auditService.record(
        {
          action: 'update',
          resource: 'vendor_bill',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: existing.id,
          before: { totalAmount: money(existing.totalAmount) },
          after: { totalAmount: money(content.totalAmount) },
        },
        tx,
      );
    }).catch((error: unknown) => {
      const text = uniqueViolationText(error);
      if (text && text.includes('vendor_bill_key'))
        refuse(
          'VENDOR_BILL_DUPLICATE',
          'This vendor bill number is already recorded.',
        );
      throw error;
    });
    return this.getBill(actor, id);
  }

  async submitBill(actor: AuthContext, id: string) {
    await this.write(actor, 'accounting:expenses:write', async (tx) => {
      const existing = await tx.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException('Vendor bill not found');
      if (existing.status !== FinanceExpenseStatus.DRAFT)
        refuse('EXPENSE_STATE_CONFLICT', 'Only a draft bill can be submitted.');
      // Re-validate: the vendor, account or period may have changed since the draft.
      await this.billContent(
        tx,
        actor.tenantId,
        {
          vendorId: existing.vendorId,
          vendorBillNumber: existing.vendorBillNumber,
          expenseDate: existing.expenseDate,
          dueDate: existing.dueDate,
          description: existing.description,
          expenseAccountId: existing.expenseAccountId,
          amount: existing.amount,
          taxAmount: existing.taxAmount,
          supportingFileAssetId: existing.supportingFileAssetId,
        },
        existing.id,
      );
      await tx.financeExpense.update({
        where: { id: existing.id },
        data: {
          status: FinanceExpenseStatus.SUBMITTED,
          submittedById: actor.userId,
          submittedAt: new Date(),
        },
      });
      await this.auditService.record(
        {
          action: 'submit',
          resource: 'vendor_bill',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: existing.id,
          after: { status: FinanceExpenseStatus.SUBMITTED },
        },
        tx,
      );
    });
    return this.getBill(actor, id);
  }

  async rejectBill(actor: AuthContext, id: string, dto: ReasonDto) {
    await this.write(actor, 'accounting:expenses:approve', async (tx) => {
      const existing = await tx.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!existing) throw new NotFoundException('Vendor bill not found');
      if (existing.status !== FinanceExpenseStatus.SUBMITTED)
        refuse(
          'EXPENSE_STATE_CONFLICT',
          'Only a submitted bill can be rejected.',
        );
      requireIndependentActor(actor, [
        existing.createdById,
        existing.submittedById,
      ]);
      await tx.financeExpense.update({
        where: { id: existing.id },
        data: {
          status: FinanceExpenseStatus.DRAFT,
          rejectedById: actor.userId,
          rejectedAt: new Date(),
          rejectionReason: dto.reason.trim(),
        },
      });
      await this.auditService.record(
        {
          action: 'reject',
          resource: 'vendor_bill',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: existing.id,
          after: {
            status: FinanceExpenseStatus.DRAFT,
            reason: dto.reason.trim(),
          },
        },
        tx,
      );
    });
    return this.getBill(actor, id);
  }

  /**
   * Approve and post in one transaction: the approver is independent of the
   * preparer, signs a content fingerprint, and the bill posts on its own date
   * (open period required). The payable opens only once the journal exists.
   */
  async approveBill(actor: AuthContext, id: string, dto: ApproveVendorBillDto) {
    await this.write(actor, 'accounting:expenses:approve', async (tx) => {
      const bill = await tx.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!bill) throw new NotFoundException('Vendor bill not found');
      if (bill.status !== FinanceExpenseStatus.SUBMITTED)
        refuse(
          'EXPENSE_STATE_CONFLICT',
          'Only a submitted bill can be approved.',
        );
      requireIndependentActor(actor, [bill.createdById, bill.submittedById]);
      const fingerprint = billContentFingerprint(bill);
      if (fingerprint !== dto.expectedFingerprint)
        refuse(
          'EXPENSE_CHANGED',
          'The bill changed after you opened it. Reload and review it again.',
        );
      const { content } = await this.billContent(
        tx,
        actor.tenantId,
        {
          vendorId: bill.vendorId,
          vendorBillNumber: bill.vendorBillNumber,
          expenseDate: bill.expenseDate,
          dueDate: bill.dueDate,
          description: bill.description,
          expenseAccountId: bill.expenseAccountId,
          amount: bill.amount,
          taxAmount: bill.taxAmount,
          supportingFileAssetId: bill.supportingFileAssetId,
        },
        bill.id,
      );
      if (content.fiscalPeriodId !== bill.fiscalPeriodId)
        refuse(
          'EXPENSE_CHANGED',
          'The fiscal periods changed since this bill was prepared. Reject it so the preparer can save it again.',
        );
      const accountsPayable = await this.mappedAccount(
        tx,
        actor.tenantId,
        AccountingReportMappingType.ACCOUNTS_PAYABLE,
        [ChartAccountType.LIABILITY],
      );
      const vatInput = bill.taxAmount.gt(0)
        ? await this.mappedAccount(
            tx,
            actor.tenantId,
            AccountingReportMappingType.VAT_INPUT,
            [ChartAccountType.ASSET, ChartAccountType.LIABILITY],
          )
        : null;
      const narration = bill.vendorBillNumber
        ? `Vendor bill ${bill.expenseNumber} (bill ${bill.vendorBillNumber})`
        : `Vendor bill ${bill.expenseNumber}`;
      const journal = await this.postingService.postManualJournal(
        {
          tenantId: actor.tenantId,
          entryDate: bill.expenseDate,
          narration,
          sourceModule: MODULE,
          sourceType: JournalSourceType.EXPENSE_VOUCHER,
          sourceId: bill.id,
          postingType: BILL_POSTING,
          lines: [
            {
              chartAccountId: bill.expenseAccountId,
              debit: bill.amount,
              description: bill.description,
            },
            ...(vatInput
              ? [
                  {
                    chartAccountId: vatInput.id,
                    debit: bill.taxAmount,
                    description: `Input VAT on ${bill.expenseNumber} (from the bill)`,
                  },
                ]
              : []),
            {
              chartAccountId: accountsPayable.id,
              credit: bill.totalAmount,
              description: `Payable to vendor for ${bill.expenseNumber}`,
            },
          ],
        },
        actor,
        tx,
      );
      if (!journal.fiscalYearId)
        refuse('FISCAL_PERIOD_NOT_FOUND', 'The bill date has no fiscal year.');
      const batch = await this.postingService.recordPayablesPostingBatch(tx, {
        tenantId: actor.tenantId,
        fiscalYearId: journal.fiscalYearId,
        fiscalPeriodId: journal.fiscalPeriodId,
        sourceType: JournalSourceType.EXPENSE_VOUCHER,
        sourceBatchId: bill.id,
        postingType: BILL_POSTING,
        sourceTotal: bill.totalAmount,
        journalEntry: journal,
        actor,
      });
      const now = new Date();
      await tx.financeExpense.update({
        where: { id: bill.id },
        data: {
          status: FinanceExpenseStatus.POSTED,
          approvedById: actor.userId,
          approvedAt: now,
          postedAt: now,
          approvedSourceFingerprint: fingerprint,
          postingBatchId: batch?.id ?? null,
        },
      });
      const sequence = await allocateDocumentNumber(
        tx,
        actor.tenantId,
        'PAYABLE',
      );
      const payable = await tx.financePayable.create({
        data: {
          tenantId: actor.tenantId,
          payableNumber: `AP-${String(sequence).padStart(6, '0')}`,
          vendorId: bill.vendorId,
          expenseId: bill.id,
          dueDate: bill.dueDate ?? bill.expenseDate,
          originalAmount: bill.totalAmount,
          outstandingAmount: bill.totalAmount,
          status: FinancePayableStatus.OPEN,
        },
      });
      await this.auditService.record(
        {
          action: 'approve',
          resource: 'vendor_bill',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: bill.id,
          after: {
            status: FinanceExpenseStatus.POSTED,
            journalEntryId: journal.id,
            payableId: payable.id,
            totalAmount: money(bill.totalAmount),
            fingerprint,
          },
        },
        tx,
      );
    });
    return this.getBill(actor, id);
  }

  /**
   * Reverse a posted, unpaid bill: the bill journal is reversed on the
   * reversal date, the bill becomes REVERSED and its payable VOID. A bill
   * with payments must have them reversed first.
   */
  async reverseBill(actor: AuthContext, id: string, dto: ReverseWithDateDto) {
    await this.write(actor, 'accounting:journals:reverse', async (tx) => {
      const bill = await tx.financeExpense.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: { payable: true },
      });
      if (!bill) throw new NotFoundException('Vendor bill not found');
      if (bill.status !== FinanceExpenseStatus.POSTED || !bill.payable)
        refuse('EXPENSE_STATE_CONFLICT', 'Only a posted bill can be reversed.');
      requireIndependentActor(actor, [bill.approvedById]);
      if (!bill.payable.outstandingAmount.equals(bill.payable.originalAmount))
        refuse(
          'PAYABLE_HAS_PAYMENTS',
          'This bill has payments. Reverse the payments before reversing the bill.',
        );
      const reason = dto.reason.trim();
      const reversalDate = dateOnly(
        dto.reversalDate ?? nepalToday(),
        'reversalDate',
      );
      if (reversalDate < bill.expenseDate)
        throw new BadRequestException(
          'A bill cannot be reversed before its own date',
        );
      const journal = await tx.journalEntry.findFirst({
        where: {
          tenantId: actor.tenantId,
          sourceModule: MODULE,
          sourceType: JournalSourceType.EXPENSE_VOUCHER,
          sourceId: bill.id,
          postingType: BILL_POSTING,
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (journal?.status !== JournalEntryStatus.POSTED)
        refuse(
          'JOURNAL_STATE_CONFLICT',
          'The bill journal is not in a reversible state.',
        );
      const reversal = await this.reverseJournal(
        tx,
        actor,
        journal,
        reversalDate,
        reason,
        `Reversal of vendor bill ${bill.expenseNumber}`,
      );
      const now = new Date();
      await tx.financeExpense.update({
        where: { id: bill.id },
        data: {
          status: FinanceExpenseStatus.REVERSED,
          reversedById: actor.userId,
          reversedAt: now,
          correctionReason: reason,
        },
      });
      await tx.financePayable.update({
        where: { id: bill.payable.id },
        data: {
          status: FinancePayableStatus.VOID,
          voidedAt: reversalDate,
          voidedById: actor.userId,
          voidReason: reason,
        },
      });
      await this.auditService.record(
        {
          action: 'reverse',
          resource: 'vendor_bill',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: bill.id,
          after: {
            status: FinanceExpenseStatus.REVERSED,
            reversalJournalId: reversal.id,
            payableId: bill.payable.id,
            reason,
          },
        },
        tx,
      );
    });
    return this.getBill(actor, id);
  }

  private async reverseJournal(
    tx: Tx,
    actor: AuthContext,
    journal: {
      id: string;
      lines: Array<{
        chartAccountId: string;
        side: JournalLineSide;
        amount: Prisma.Decimal;
        description: string | null;
      }>;
    },
    reversalDate: Date,
    reason: string,
    narration: string,
  ) {
    const reversal = await this.postingService.postReversal(
      {
        tenantId: actor.tenantId,
        originalEntryId: journal.id,
        reversalDate,
        narration,
        reason,
        lines: journal.lines.map((line) => ({
          chartAccountId: line.chartAccountId,
          side:
            line.side === JournalLineSide.DEBIT
              ? JournalLineSide.CREDIT
              : JournalLineSide.DEBIT,
          amount: line.amount,
          description: `Reversal: ${line.description ?? narration}`,
        })),
      },
      actor,
      tx,
    );
    await tx.accountingPostingBatch.updateMany({
      where: { tenantId: actor.tenantId, journalEntryId: journal.id },
      data: {
        status: AccountingPostingBatchStatus.REVERSED,
        reversedAt: new Date(),
        reversalReason: reason,
      },
    });
    return reversal;
  }

  // ─── Payables and settlements ──────────────────────────────────────

  async listPayables(actor: AuthContext, query: ListPayablesQueryDto) {
    requireDomainPermission(actor, 'accounting:payables:read');
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim();
    const where: Prisma.FinancePayableWhereInput = {
      tenantId: actor.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(search
        ? {
            OR: [
              { payableNumber: { contains: search, mode: 'insensitive' } },
              {
                expense: {
                  vendorBillNumber: { contains: search, mode: 'insensitive' },
                },
              },
              {
                vendor: {
                  displayName: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    return this.read(actor, async () => {
      const [rows, total] = await Promise.all([
        this.prisma.financePayable.findMany({
          where,
          include: PAYABLE_INCLUDE,
          orderBy: [{ dueDate: 'asc' }, { payableNumber: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.financePayable.count({ where }),
      ]);
      const today = nepalToday();
      return {
        items: rows.map((row) => this.payableView(actor, row, today)),
        pagination: { page, limit, total },
      };
    });
  }

  async getPayable(actor: AuthContext, id: string) {
    requireDomainPermission(actor, 'accounting:payables:read');
    return this.read(actor, async () => {
      const row = await this.prisma.financePayable.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: PAYABLE_INCLUDE,
      });
      if (!row) throw new NotFoundException('Payable not found');
      const settlements = await this.prisma.financePayableSettlement.findMany({
        where: { tenantId: actor.tenantId, payableId: row.id },
        include: SETTLEMENT_INCLUDE,
        orderBy: [{ settledAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const names = await resolveActorNames(this.prisma, actor.tenantId, [
        ...new Set(
          settlements
            .map((s) => s.createdById)
            .filter((value): value is string => Boolean(value)),
        ),
      ]);
      return {
        ...this.payableView(actor, row, nepalToday()),
        settlements: settlements.map((s) =>
          this.settlementView(actor, row, s, names),
        ),
      };
    });
  }

  private payableView(actor: AuthContext, row: PayableRow, today: string) {
    const open =
      row.status === FinancePayableStatus.OPEN ||
      row.status === FinancePayableStatus.PARTIALLY_PAID;
    const daysOverdue = open ? daysOverdueOn(row.dueDate, today) : 0;
    const me = actor.userId;
    const independent =
      me !== row.expense.createdById &&
      me !== row.expense.submittedById &&
      me !== row.expense.approvedById;
    return {
      id: row.id,
      payableNumber: row.payableNumber,
      vendor: row.vendor,
      bill: {
        id: row.expense.id,
        expenseNumber: row.expense.expenseNumber,
        vendorBillNumber: row.expense.vendorBillNumber,
        description: row.expense.description,
        expenseDate: dateKey(row.expense.expenseDate),
      },
      dueDate: dateKey(row.dueDate),
      originalAmount: money(row.originalAmount),
      outstandingAmount: money(row.outstandingAmount),
      paidAmount: money(row.originalAmount.sub(row.outstandingAmount)),
      status: row.status,
      daysOverdue,
      bucket: open ? agingBucketForDays(daysOverdue) : null,
      voided: row.voidedAt
        ? { date: dateKey(row.voidedAt), reason: row.voidReason }
        : null,
      authorization: buildResourceAuthorization({
        actions: {
          settle:
            open &&
            independent &&
            hasDomainPermission(actor, 'accounting:payables:settle'),
        },
        sections: { settlements: true },
        lifecycleState: row.status,
        entitlementState: ENTITLEMENT,
      }),
    };
  }

  private settlementView(
    actor: AuthContext,
    payable: { status: FinancePayableStatus },
    row: SettlementRow,
    names: Map<string, string>,
  ) {
    const reversedBySettlementId = row.reversals[0]?.id ?? null;
    return {
      id: row.id,
      amount: money(row.amount),
      withheldTaxAmount: money(row.withheldTaxAmount),
      cashAmount: money(row.cashAmount),
      paymentAccount: row.paymentAccount,
      settledAt: dateKey(row.settledAt),
      paymentReference: row.paymentReference,
      journalEntryId: row.journalEntryId,
      reversalOfId: row.reversalOfId,
      reversalReason: row.reversalReason,
      reversedBySettlementId,
      paidBy: row.createdById
        ? {
            id: row.createdById,
            name: names.get(row.createdById) ?? 'Unknown user',
          }
        : null,
      createdAt: row.createdAt,
      authorization: buildResourceAuthorization({
        actions: {
          reverse:
            row.reversalOfId === null &&
            reversedBySettlementId === null &&
            payable.status !== FinancePayableStatus.VOID &&
            actor.userId !== row.createdById &&
            hasDomainPermission(actor, 'accounting:journals:reverse'),
        },
        sections: { amounts: true },
        lifecycleState: row.reversalOfId
          ? 'REVERSAL'
          : reversedBySettlementId
            ? 'REVERSED'
            : 'ACTIVE',
        entitlementState: ENTITLEMENT,
      }),
    };
  }

  /**
   * Pay a payable. The payer is independent of the preparer and approver;
   * Dr AP (amount) / Cr payment account (cash) / Cr TDS payable (withheld).
   * The database trigger locks the payable, keeps paid within [0, original]
   * and recomputes the outstanding balance and status.
   */
  async settle(actor: AuthContext, payableId: string, dto: SettlePayableDto) {
    const idempotencyKey = dto.idempotencyKey.trim();
    const amount = new Prisma.Decimal(dto.amount);
    const withheld = new Prisma.Decimal(dto.withheldTaxAmount ?? 0);
    const replay = async () => {
      const existing = await this.read(actor, () =>
        this.prisma.financePayableSettlement.findFirst({
          where: { tenantId: actor.tenantId, idempotencyKey },
        }),
      );
      if (!existing) return null;
      if (
        existing.payableId !== payableId ||
        !existing.amount.equals(amount) ||
        !existing.withheldTaxAmount.equals(withheld) ||
        existing.paymentAccountId !== dto.paymentAccountId
      )
        refuse(
          'IDEMPOTENCY_KEY_REUSED',
          'This request key was already used for a different payment.',
        );
      return this.getPayable(actor, payableId);
    };
    const replayed = await replay();
    if (replayed) return replayed;
    if (!amount.gt(0))
      throw new BadRequestException('amount must be greater than zero');
    if (withheld.lt(0) || withheld.gt(amount))
      throw new BadRequestException(
        'withheldTaxAmount must be between zero and the amount paid',
      );
    try {
      await this.write(actor, 'accounting:payables:settle', async (tx) => {
        const payable = await tx.financePayable.findFirst({
          where: { id: payableId, tenantId: actor.tenantId },
          include: { expense: true },
        });
        if (!payable) throw new NotFoundException('Payable not found');
        if (
          payable.status !== FinancePayableStatus.OPEN &&
          payable.status !== FinancePayableStatus.PARTIALLY_PAID
        )
          refuse('PAYABLE_NOT_OPEN', 'Only an open payable can be paid.');
        requireIndependentActor(actor, [
          payable.expense.createdById,
          payable.expense.submittedById,
          payable.expense.approvedById,
        ]);
        if (amount.gt(payable.outstandingAmount))
          refuse(
            'SETTLEMENT_EXCEEDS_OUTSTANDING',
            `The payment is more than the outstanding NPR ${money(payable.outstandingAmount)}.`,
          );
        const settledAt = dateOnly(dto.settledAt, 'settledAt');
        if (settledAt < payable.expense.expenseDate)
          refuse(
            'SETTLEMENT_BEFORE_BILL',
            'A payment cannot be dated before the bill.',
          );
        const paymentAccount = await this.paymentAccount(
          tx,
          actor.tenantId,
          dto.paymentAccountId,
        );
        const tdsPayable = withheld.gt(0)
          ? await this.mappedAccount(
              tx,
              actor.tenantId,
              AccountingReportMappingType.TDS_PAYABLE,
              [ChartAccountType.LIABILITY],
            )
          : null;
        const accountsPayableId = await this.billPayableAccountId(
          tx,
          actor.tenantId,
          payable.expenseId,
        );
        const cash = amount.sub(withheld);
        const settlementId = randomUUID();
        const reference = blankToNull(dto.paymentReference);
        const journal = await this.postingService.postManualJournal(
          {
            tenantId: actor.tenantId,
            entryDate: settledAt,
            narration: `Payment of ${payable.payableNumber}${reference ? ` (${reference})` : ''}`,
            sourceModule: MODULE,
            sourceType: JournalSourceType.PAYMENT_VOUCHER,
            sourceId: settlementId,
            postingType: PAYMENT_POSTING,
            lines: [
              {
                chartAccountId: accountsPayableId,
                debit: amount,
                description: `Clear payable ${payable.payableNumber}`,
              },
              ...(cash.gt(0)
                ? [
                    {
                      chartAccountId: paymentAccount.id,
                      credit: cash,
                      description: `Paid from ${paymentAccount.code} ${paymentAccount.name}`,
                    },
                  ]
                : []),
              ...(tdsPayable
                ? [
                    {
                      chartAccountId: tdsPayable.id,
                      credit: withheld,
                      description: `Tax withheld on ${payable.payableNumber} (from the bill)`,
                    },
                  ]
                : []),
            ],
          },
          actor,
          tx,
        );
        if (!journal.fiscalYearId)
          refuse(
            'FISCAL_PERIOD_NOT_FOUND',
            'The payment date has no fiscal year.',
          );
        await this.postingService.recordPayablesPostingBatch(tx, {
          tenantId: actor.tenantId,
          fiscalYearId: journal.fiscalYearId,
          fiscalPeriodId: journal.fiscalPeriodId,
          sourceType: JournalSourceType.PAYMENT_VOUCHER,
          sourceBatchId: settlementId,
          postingType: PAYMENT_POSTING,
          sourceTotal: amount,
          journalEntry: journal,
          actor,
        });
        await tx.financePayableSettlement.create({
          data: {
            id: settlementId,
            tenantId: actor.tenantId,
            payableId: payable.id,
            amount,
            withheldTaxAmount: withheld,
            cashAmount: cash,
            paymentAccountId: paymentAccount.id,
            settledAt,
            paymentReference: reference,
            idempotencyKey,
            journalEntryId: journal.id,
            createdById: actor.userId,
          },
        });
        await this.auditService.record(
          {
            action: 'settle',
            resource: 'finance_payable',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: payable.id,
            after: {
              settlementId,
              amount: money(amount),
              withheldTaxAmount: money(withheld),
              cashAmount: money(cash),
              journalEntryId: journal.id,
            },
          },
          tx,
        );
      });
    } catch (error) {
      const text = uniqueViolationText(error);
      if (text && text.includes('idempotencyKey')) {
        const again = await replay();
        if (again) return again;
      }
      throw error;
    }
    return this.getPayable(actor, payableId);
  }

  /** The AP account the bill actually credited (mappings may change later). */
  private async billPayableAccountId(
    tx: Tx,
    tenantId: string,
    expenseId: string,
  ) {
    const journal = await tx.journalEntry.findFirst({
      where: {
        tenantId,
        sourceModule: MODULE,
        sourceType: JournalSourceType.EXPENSE_VOUCHER,
        sourceId: expenseId,
        postingType: BILL_POSTING,
      },
      include: { lines: { where: { side: JournalLineSide.CREDIT } } },
    });
    const credit = journal?.lines ?? [];
    if (credit.length !== 1)
      refuse(
        'JOURNAL_STATE_CONFLICT',
        'The bill journal could not be matched to one payable account.',
      );
    return credit[0].chartAccountId;
  }

  async reverseSettlement(
    actor: AuthContext,
    settlementId: string,
    dto: ReverseWithDateDto,
  ) {
    const payableId = await this.write(
      actor,
      'accounting:journals:reverse',
      async (tx) => {
        const original = await tx.financePayableSettlement.findFirst({
          where: { id: settlementId, tenantId: actor.tenantId },
          include: { payable: true, reversals: { select: { id: true } } },
        });
        if (!original) throw new NotFoundException('Payment not found');
        if (original.reversalOfId)
          refuse(
            'SETTLEMENT_STATE_CONFLICT',
            'A reversal cannot itself be reversed.',
          );
        if (original.reversals.length > 0)
          refuse(
            'SETTLEMENT_ALREADY_REVERSED',
            'This payment is already reversed.',
          );
        if (original.payable.status === FinancePayableStatus.VOID)
          refuse('PAYABLE_NOT_OPEN', 'The payable is void.');
        requireIndependentActor(actor, [original.createdById]);
        const reason = dto.reason.trim();
        const reversalDate = dateOnly(
          dto.reversalDate ?? nepalToday(),
          'reversalDate',
        );
        if (reversalDate < original.settledAt)
          throw new BadRequestException(
            'A payment cannot be reversed before its own date',
          );
        const journal = original.journalEntryId
          ? await tx.journalEntry.findFirst({
              where: { id: original.journalEntryId, tenantId: actor.tenantId },
              include: { lines: { orderBy: { lineNumber: 'asc' } } },
            })
          : null;
        if (journal?.status !== JournalEntryStatus.POSTED)
          refuse(
            'JOURNAL_STATE_CONFLICT',
            'The payment journal is not in a reversible state.',
          );
        const reversal = await this.reverseJournal(
          tx,
          actor,
          journal,
          reversalDate,
          reason,
          `Reversal of payment on ${original.payable.payableNumber}`,
        );
        const created = await tx.financePayableSettlement.create({
          data: {
            tenantId: actor.tenantId,
            payableId: original.payableId,
            amount: original.amount.neg(),
            withheldTaxAmount: original.withheldTaxAmount.neg(),
            cashAmount: original.cashAmount.neg(),
            paymentAccountId: original.paymentAccountId,
            settledAt: reversalDate,
            paymentReference: original.paymentReference,
            idempotencyKey: `reversal:${original.id}`,
            journalEntryId: reversal.id,
            reversalOfId: original.id,
            reversalReason: reason,
            createdById: actor.userId,
          },
        });
        await this.auditService.record(
          {
            action: 'reverse_settlement',
            resource: 'finance_payable',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: original.payableId,
            after: {
              settlementId: original.id,
              reversalSettlementId: created.id,
              reversalJournalId: reversal.id,
              reason,
            },
          },
          tx,
        );
        return original.payableId;
      },
    );
    return this.getPayable(actor, payableId);
  }

  // ─── Payables aging ────────────────────────────────────────────────

  /**
   * Payables aging as of a Nepal school day, with the same buckets as
   * receivables. Accounting dates (bill date, payment date, reversal date)
   * use the ledger's day basis, so the total equals the Accounts Payable
   * ledger balance on that day when every payable posted through this domain.
   */
  async getPayablesAging(actor: AuthContext, query: PayablesAgingQueryDto) {
    requireDomainPermission(actor, 'accounting:payables:read');
    const asOfDate = query.asOfDate ?? nepalToday();
    dateOnly(asOfDate, 'asOfDate');
    const asOfExclusive = reportRangeEndExclusive(asOfDate);
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const search = query.search?.trim().toLowerCase();
    return this.read(actor, async () => {
      const payables = await this.prisma.financePayable.findMany({
        where: {
          tenantId: actor.tenantId,
          expense: { expenseDate: { lt: asOfExclusive } },
          OR: [{ voidedAt: null }, { voidedAt: { gte: asOfExclusive } }],
        },
        include: PAYABLE_INCLUDE,
        orderBy: [{ dueDate: 'asc' }, { payableNumber: 'asc' }],
      });
      const paid = payables.length
        ? await this.prisma.financePayableSettlement.groupBy({
            by: ['payableId'],
            where: {
              tenantId: actor.tenantId,
              payableId: { in: payables.map((p) => p.id) },
              settledAt: { lt: asOfExclusive },
            },
            _sum: { amount: true },
          })
        : [];
      const paidByPayable = new Map(
        paid.map((row) => [
          row.payableId,
          new Prisma.Decimal(row._sum.amount ?? 0),
        ]),
      );
      const allRows = payables
        .map((payable) => {
          const outstanding = payable.originalAmount.sub(
            paidByPayable.get(payable.id) ?? ZERO(),
          );
          const daysOverdue = daysOverdueOn(payable.dueDate, asOfDate);
          return {
            payable,
            outstanding,
            daysOverdue,
            bucket: agingBucketForDays(daysOverdue),
          };
        })
        .filter((row) => row.outstanding.gt(0));
      // The vendor filter narrows the figures; the ledger check always uses
      // the whole subledger.
      const rows = query.vendorId
        ? allRows.filter((row) => row.payable.vendorId === query.vendorId)
        : allRows;
      const sum = (items: typeof rows) =>
        items.reduce((total, row) => total.add(row.outstanding), ZERO());
      const buckets = RECEIVABLES_AGING_BUCKETS.map((bucket) => {
        const inBucket = rows.filter((row) => row.bucket === bucket);
        return {
          bucket,
          payableCount: inBucket.length,
          vendorCount: new Set(inBucket.map((row) => row.payable.vendorId))
            .size,
          outstanding: money(sum(inBucket)),
        };
      });
      const vendorTotals = new Map<
        string,
        {
          vendor: PayableRow['vendor'];
          outstanding: Prisma.Decimal;
          overdue: Prisma.Decimal;
          byBucket: Record<Bucket, Prisma.Decimal>;
          payableCount: number;
        }
      >();
      for (const row of rows) {
        const key = row.payable.vendorId ?? 'none';
        const entry = vendorTotals.get(key) ?? {
          vendor: row.payable.vendor,
          outstanding: ZERO(),
          overdue: ZERO(),
          byBucket: Object.fromEntries(
            RECEIVABLES_AGING_BUCKETS.map((b) => [b, ZERO()]),
          ) as Record<Bucket, Prisma.Decimal>,
          payableCount: 0,
        };
        entry.outstanding = entry.outstanding.add(row.outstanding);
        if (row.bucket !== 'CURRENT')
          entry.overdue = entry.overdue.add(row.outstanding);
        entry.byBucket[row.bucket] = entry.byBucket[row.bucket].add(
          row.outstanding,
        );
        entry.payableCount += 1;
        vendorTotals.set(key, entry);
      }
      const filtered = rows.filter(
        (row) =>
          (!query.bucket || row.bucket === query.bucket) &&
          (!search ||
            row.payable.payableNumber.toLowerCase().includes(search) ||
            (row.payable.vendor?.displayName.toLowerCase().includes(search) ??
              false) ||
            (row.payable.expense.vendorBillNumber
              ?.toLowerCase()
              .includes(search) ??
              false)),
      );
      const control = await this.apControl(actor.tenantId, asOfExclusive);
      const totalOutstanding = sum(rows);
      const subledgerTotal = sum(allRows);
      return {
        asOfDate,
        totals: {
          buckets,
          totalOutstanding: money(totalOutstanding),
          overdueOutstanding: money(
            sum(rows.filter((row) => row.bucket !== 'CURRENT')),
          ),
          payableCount: rows.length,
          vendorCount: vendorTotals.size,
        },
        byVendor: [...vendorTotals.values()]
          .sort((a, b) => b.outstanding.comparedTo(a.outstanding))
          .map((entry) => ({
            vendor: entry.vendor,
            payableCount: entry.payableCount,
            outstanding: money(entry.outstanding),
            overdueOutstanding: money(entry.overdue),
            buckets: RECEIVABLES_AGING_BUCKETS.map((bucket) => ({
              bucket,
              outstanding: money(entry.byBucket[bucket]),
            })),
          })),
        rows: filtered.slice((page - 1) * limit, page * limit).map((row) => ({
          payableId: row.payable.id,
          payableNumber: row.payable.payableNumber,
          vendor: row.payable.vendor,
          billNumber: row.payable.expense.expenseNumber,
          vendorBillNumber: row.payable.expense.vendorBillNumber,
          dueDate: dateKey(row.payable.dueDate),
          originalAmount: money(row.payable.originalAmount),
          outstanding: money(row.outstanding),
          daysOverdue: row.daysOverdue,
          bucket: row.bucket,
        })),
        pagination: { page, limit, total: filtered.length },
        ledger: control
          ? {
              account: control.account,
              balance: money(control.balance),
              subledgerTotal: money(subledgerTotal),
              difference: money(control.balance.sub(subledgerTotal)),
              matches: control.balance.equals(subledgerTotal),
            }
          : null,
      };
    });
  }

  /** Credit balance of the mapped AP account on the as-of day, if mapped. */
  private async apControl(tenantId: string, asOfExclusive: Date) {
    const mappings = await this.prisma.accountingReportAccountMapping.findMany({
      where: {
        tenantId,
        mappingType: AccountingReportMappingType.ACCOUNTS_PAYABLE,
      },
      include: { account: { select: { id: true, code: true, name: true } } },
    });
    if (mappings.length !== 1) return null;
    const totals = await this.prisma.journalLine.aggregate({
      where: {
        tenantId,
        chartAccountId: mappings[0].accountId,
        journalEntry: ledgerEntryWhere({
          tenantId,
          stage: 'POST_CLOSING',
          toExclusive: asOfExclusive,
        }),
      },
      _sum: { debit: true, credit: true },
    });
    return {
      account: mappings[0].account,
      balance: new Prisma.Decimal(totals._sum.credit ?? 0).sub(
        new Prisma.Decimal(totals._sum.debit ?? 0),
      ),
    };
  }
}

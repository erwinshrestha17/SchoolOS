import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { AccountingReportsService } from './accounting-reports.service';
import { convertToCsv, formatCsvDecimal } from '../common/csv-utils';
import { buildTableReportPdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { Prisma } from '@prisma/client';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { CashBookQueryDto } from './dto/cash-book-query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { TaxSummaryQueryDto } from './dto/tax-summary-query.dto';

export type AccountingQueuedReportKey =
  | 'accounting.general-ledger'
  | 'accounting.cash-book';

export type AccountingQueuedReportFormat = 'csv' | 'pdf';

export interface AccountingQueuedReportJob {
  exportId: string;
  reportKey: AccountingQueuedReportKey;
  format: AccountingQueuedReportFormat;
  filters: Record<string, unknown>;
  actor: AuthContext;
}

@Injectable()
export class AccountingReportExportsService {
  constructor(
    private readonly reportsService: AccountingReportsService,
    private readonly prisma: PrismaService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly auditService: AuditService,
    @InjectQueue('accounting-reports')
    private readonly accountingReportsQueue: Queue,
  ) {}

  async exportTrialBalanceCsv(
    tenantId: string,
    query: TrialBalanceQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getTrialBalance(tenantId, query);
    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      'Account Code': row.accountCode,
      'Account Name': row.accountName,
      'Account Type': row.accountType,
      'Opening Debit': formatCsvDecimal(row.openingDebit),
      'Opening Credit': formatCsvDecimal(row.openingCredit),
      'Period Debit': formatCsvDecimal(row.periodDebit),
      'Period Credit': formatCsvDecimal(row.periodCredit),
      'Closing Debit': formatCsvDecimal(row.closingDebit),
      'Closing Credit': formatCsvDecimal(row.closingCredit),
      'Net Balance': formatCsvDecimal(row.netBalance),
      Side: row.normalBalanceSide,
    }));

    // Add summary row
    rows.push({
      'Account Code': 'TOTAL',
      'Account Name': '',
      'Account Type': '',
      'Opening Debit': formatCsvDecimal(data.totalOpeningDebit),
      'Opening Credit': formatCsvDecimal(data.totalOpeningCredit),
      'Period Debit': formatCsvDecimal(data.totalPeriodDebit),
      'Period Credit': formatCsvDecimal(data.totalPeriodCredit),
      'Closing Debit': formatCsvDecimal(data.totalClosingDebit),
      'Closing Credit': formatCsvDecimal(data.totalClosingCredit),
      'Net Balance': '',
      Side: '',
    });

    return convertToCsv(rows);
  }

  async exportTrialBalancePdf(
    tenantId: string,
    query: TrialBalanceQueryDto,
    actor: AuthContext,
  ) {
    const data = await this.reportsService.getTrialBalance(tenantId, query);
    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      Code: row.accountCode,
      Account: row.accountName,
      Type: row.accountType,
      Debit: formatCsvDecimal(row.closingDebit),
      Credit: formatCsvDecimal(row.closingCredit),
      Balance: formatCsvDecimal(row.netBalance),
    }));
    rows.push({
      Code: 'TOTAL',
      Account: data.isBalanced ? 'Balanced' : 'Imbalanced',
      Type: '',
      Debit: formatCsvDecimal(data.totalClosingDebit),
      Credit: formatCsvDecimal(data.totalClosingCredit),
      Balance: formatCsvDecimal(data.imbalanceAmount),
    });

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.trial-balance',
      title: 'Trial Balance',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      summaryCards: [
        {
          label: 'Closing Debit',
          value: formatCsvDecimal(data.totalClosingDebit),
        },
        {
          label: 'Closing Credit',
          value: formatCsvDecimal(data.totalClosingCredit),
        },
        {
          label: 'Imbalance',
          value: formatCsvDecimal(data.imbalanceAmount),
        },
        {
          label: 'Status',
          value: data.isBalanced ? 'BALANCED' : 'IMBALANCED',
        },
      ],
      rows,
    });
  }

  async exportGeneralLedgerCsv(
    tenantId: string,
    query: GeneralLedgerQueryDto,
    options: { mode?: 'sync' | 'background' } = {},
  ): Promise<string> {
    const data = await this.reportsService.getGeneralLedger(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      sourceModule: query.sourceModule,
      sourceType: query.sourceType,
      sourceId: query.sourceId,
      page: options.mode === 'background' ? 1 : query.page,
      sort: query.sort,
      limit: this.rowLimitForMode(options.mode),
    });
    this.ensureWithinExportLimit(
      'General Ledger',
      data.pagination.total,
      options.mode,
    );

    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      Date: row.entryDate,
      'Entry Number': row.entryNumber ?? '',
      'Account Code': row.accountCode,
      'Account Name': row.accountName,
      Description: row.description ?? '',
      'Source Module': row.sourceModule ?? '',
      'Source Type': row.sourceType,
      Debit: formatCsvDecimal(row.debit),
      Credit: formatCsvDecimal(row.credit),
      'Running Balance': formatCsvDecimal(row.runningBalance),
      'Running Balance Side': row.runningBalanceSide,
    }));

    // Add summary row
    rows.push({
      Date: '',
      'Entry Number': 'TOTAL',
      'Account Code': '',
      'Account Name': '',
      Description: '',
      'Source Module': '',
      'Source Type': '',
      Debit: formatCsvDecimal(data.totals.debit),
      Credit: formatCsvDecimal(data.totals.credit),
      'Running Balance': formatCsvDecimal(data.closingBalance),
      'Running Balance Side': data.closingBalanceSide,
    });

    return convertToCsv(rows);
  }

  async exportGeneralLedgerPdf(
    tenantId: string,
    query: GeneralLedgerQueryDto,
    actor: AuthContext,
    options: { mode?: 'sync' | 'background' } = {},
  ) {
    const data = await this.reportsService.getGeneralLedger(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      sourceModule: query.sourceModule,
      sourceType: query.sourceType,
      sourceId: query.sourceId,
      page: options.mode === 'background' ? 1 : query.page,
      sort: query.sort,
      limit: this.rowLimitForMode(options.mode),
    });
    this.ensureWithinExportLimit(
      'General Ledger',
      data.pagination.total,
      options.mode,
    );
    const rows: Array<Record<string, unknown>> = [
      {
        Date: 'OPENING',
        Journal: '',
        Description: `${formatCsvDecimal(data.openingBalance)} ${data.openingBalanceSide}`,
        Debit: '',
        Credit: '',
        Balance: '',
      },
      ...data.rows.map((row) => ({
        Date: row.entryDate,
        Journal: row.entryNumber ?? '',
        Description: row.description ?? '',
        Debit: formatCsvDecimal(row.debit),
        Credit: formatCsvDecimal(row.credit),
        Balance: `${formatCsvDecimal(row.runningBalance)} ${row.runningBalanceSide}`,
      })),
      {
        Date: 'CLOSING',
        Journal: '',
        Description: data.accountCode ?? data.accountId ?? '',
        Debit: formatCsvDecimal(data.totals.debit),
        Credit: formatCsvDecimal(data.totals.credit),
        Balance: `${formatCsvDecimal(data.closingBalance)} ${data.closingBalanceSide}`,
      },
    ];

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.general-ledger',
      title: 'General Ledger',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      rows,
    });
  }

  async exportCashBookCsv(
    tenantId: string,
    query: CashBookQueryDto,
    options: { mode?: 'sync' | 'background' } = {},
  ): Promise<string> {
    const data = await this.reportsService.getCashBook(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      accountKind: query.accountKind,
      page: options.mode === 'background' ? 1 : query.page,
      limit: this.rowLimitForMode(options.mode),
    });
    this.ensureWithinExportLimit(
      'Cash Book',
      data.pagination.total,
      options.mode,
    );

    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      Date: row.entryDate,
      'Entry Number': row.entryNumber ?? '',
      'Cash/Bank Account': data.account
        ? `${data.account.code} - ${data.account.name}`
        : '',
      Description: row.narration ?? '',
      'Counterparty Account': `${row.accountCode} - ${row.accountName}`,
      Receipt: formatCsvDecimal(row.receiptAmount),
      Payment: formatCsvDecimal(row.paymentAmount),
      'Running Balance': formatCsvDecimal(row.runningBalance),
      'Running Balance Side': row.runningBalanceSide,
    }));

    // Add summary row
    rows.push({
      Date: null,
      'Entry Number': 'TOTAL',
      'Cash/Bank Account': '',
      Description: '',
      'Counterparty Account': '',
      Receipt: formatCsvDecimal(data.totalReceipts),
      Payment: formatCsvDecimal(data.totalPayments),
      'Running Balance': formatCsvDecimal(data.closingBalance),
      'Running Balance Side': data.closingBalanceSide,
    });

    return convertToCsv(rows);
  }

  async exportCashBookPdf(
    tenantId: string,
    query: CashBookQueryDto,
    actor: AuthContext,
    options: { mode?: 'sync' | 'background' } = {},
  ) {
    const data = await this.reportsService.getCashBook(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      accountKind: query.accountKind,
      page: options.mode === 'background' ? 1 : query.page,
      limit: this.rowLimitForMode(options.mode),
    });
    this.ensureWithinExportLimit(
      'Cash Book',
      data.pagination.total,
      options.mode,
    );
    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      Date: row.entryDate,
      Journal: row.entryNumber ?? '',
      Description: row.narration ?? '',
      Receipt: formatCsvDecimal(row.receiptAmount),
      Payment: formatCsvDecimal(row.paymentAmount),
      Balance: `${formatCsvDecimal(row.runningBalance)} ${row.runningBalanceSide}`,
    }));
    rows.push({
      Date: 'TOTAL',
      Journal: '',
      Description: data.account
        ? `${data.account.code} - ${data.account.name}`
        : '',
      Receipt: formatCsvDecimal(data.totalReceipts),
      Payment: formatCsvDecimal(data.totalPayments),
      Balance: `${formatCsvDecimal(data.closingBalance)} ${data.closingBalanceSide}`,
    });

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.cash-book',
      title: 'Cash Book',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      rows,
    });
  }

  async exportIncomeStatementCsv(
    tenantId: string,
    query: IncomeStatementQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getIncomeStatement(tenantId, query);
    const rows: Array<Record<string, unknown>> = [];

    for (const section of data.sections) {
      for (const acc of section.accounts) {
        rows.push({
          Section: section.section,
          'Account Code': acc.accountCode,
          'Account Name': acc.accountName,
          Amount: formatCsvDecimal(acc.amount),
        });
      }
      rows.push({
        Section: section.section,
        'Account Code': '',
        'Account Name': `Total ${section.section}`,
        Amount: formatCsvDecimal(section.total),
      });
    }

    // Summary rows
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Income',
      Amount: formatCsvDecimal(data.totalIncome),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Expense',
      Amount: formatCsvDecimal(data.totalExpense),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': `Net ${data.resultType}`,
      Amount: formatCsvDecimal(data.netSurplusOrDeficit),
    });

    return convertToCsv(rows);
  }

  async exportIncomeStatementPdf(
    tenantId: string,
    query: IncomeStatementQueryDto,
    actor: AuthContext,
  ) {
    const data = await this.reportsService.getIncomeStatement(tenantId, query);
    const rows: Array<Record<string, unknown>> = data.sections.flatMap(
      (section) => [
        ...section.accounts.map((acc) => ({
          Section: section.section,
          Code: acc.accountCode,
          Account: acc.accountName,
          Amount: formatCsvDecimal(acc.amount),
        })),
        {
          Section: section.section,
          Code: '',
          Account: `Total ${section.section}`,
          Amount: formatCsvDecimal(section.total),
        },
      ],
    );
    rows.push({
      Section: 'SUMMARY',
      Code: '',
      Account: `Net ${data.resultType}`,
      Amount: formatCsvDecimal(data.netSurplusOrDeficit),
    });

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.income-statement',
      title: 'Income Statement',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      rows,
    });
  }

  async exportBalanceSheetCsv(
    tenantId: string,
    query: BalanceSheetQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getBalanceSheet(tenantId, query);
    const rows: Array<Record<string, unknown>> = [];

    for (const section of data.sections) {
      for (const acc of section.accounts) {
        rows.push({
          Section: section.section,
          'Account Code': acc.accountCode,
          'Account Name': acc.accountName,
          Amount: formatCsvDecimal(acc.amount),
        });
      }
      rows.push({
        Section: section.section,
        'Account Code': '',
        'Account Name': `Total ${section.section}`,
        Amount: formatCsvDecimal(section.total),
      });
    }

    // Summary rows
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Assets',
      Amount: formatCsvDecimal(data.totalAssets),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Liabilities',
      Amount: formatCsvDecimal(data.totalLiabilities),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Equity',
      Amount: formatCsvDecimal(data.totalEquity),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Total Liabilities & Equity',
      Amount: formatCsvDecimal(data.totalLiabilitiesAndEquity),
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Balanced',
      Amount: data.isBalanced ? 'YES' : 'NO',
    });
    rows.push({
      Section: 'SUMMARY',
      'Account Code': '',
      'Account Name': 'Imbalance Amount',
      Amount: formatCsvDecimal(data.imbalanceAmount),
    });

    return convertToCsv(rows);
  }

  async exportBalanceSheetPdf(
    tenantId: string,
    query: BalanceSheetQueryDto,
    actor: AuthContext,
  ) {
    const data = await this.reportsService.getBalanceSheet(tenantId, query);
    const rows: Array<Record<string, unknown>> = data.sections.flatMap(
      (section) => [
        ...section.accounts.map((acc) => ({
          Section: section.section,
          Code: acc.accountCode,
          Account: acc.accountName,
          Amount: formatCsvDecimal(acc.amount),
        })),
        {
          Section: section.section,
          Code: '',
          Account: `Total ${section.section}`,
          Amount: formatCsvDecimal(section.total),
        },
      ],
    );
    rows.push({
      Section: 'CHECK',
      Code: '',
      Account: data.isBalanced ? 'Balanced' : 'Imbalanced',
      Amount: formatCsvDecimal(data.imbalanceAmount),
    });

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.balance-sheet',
      title: 'Balance Sheet',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      summaryCards: [
        {
          label: 'Total Assets',
          value: formatCsvDecimal(data.totalAssets),
        },
        {
          label: 'Total Liabilities',
          value: formatCsvDecimal(data.totalLiabilities),
        },
        {
          label: 'Total Equity',
          value: formatCsvDecimal(data.totalEquity),
        },
        {
          label: 'Status',
          value: data.isBalanced ? 'BALANCED' : 'IMBALANCED',
        },
      ],
      rows,
    });
  }

  async exportTaxSummaryCsv(
    tenantId: string,
    query: TaxSummaryQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getTaxSummary(tenantId, query);
    const rows: Array<Record<string, unknown>> = [];

    if (data.vat) {
      rows.push({
        Section: 'VAT',
        Metric: 'Output VAT',
        Amount: formatCsvDecimal(data.vat.outputVat),
        Status: '',
      });
      rows.push({
        Section: 'VAT',
        Metric: 'Input VAT',
        Amount: formatCsvDecimal(data.vat.inputVat),
        Status: '',
      });
      rows.push({
        Section: 'VAT',
        Metric: 'Net VAT',
        Amount: formatCsvDecimal(data.vat.netVat),
        Status: data.vat.status,
      });
    }

    if (data.tds) {
      rows.push({
        Section: 'TDS',
        Metric: 'Deducted Payable',
        Amount: formatCsvDecimal(data.tds.deductedPayable),
        Status: '',
      });
      rows.push({
        Section: 'TDS',
        Metric: 'Paid',
        Amount: formatCsvDecimal(data.tds.paid),
        Status: '',
      });
      rows.push({
        Section: 'TDS',
        Metric: 'Net Payable',
        Amount: formatCsvDecimal(data.tds.netPayable),
        Status: '',
      });
    }

    if (data.pf) {
      rows.push({
        Section: 'PF',
        Metric: 'Employee Contribution',
        Amount: formatCsvDecimal(data.pf.employeeContribution),
        Status: '',
      });
      rows.push({
        Section: 'PF',
        Metric: 'Employer Contribution',
        Amount: formatCsvDecimal(data.pf.employerContribution),
        Status: '',
      });
      rows.push({
        Section: 'PF',
        Metric: 'Paid',
        Amount: formatCsvDecimal(data.pf.paid),
        Status: '',
      });
      rows.push({
        Section: 'PF',
        Metric: 'Net Payable',
        Amount: formatCsvDecimal(data.pf.netPayable),
        Status: '',
      });
    }

    if (data.setupWarnings.length) {
      for (const warning of data.setupWarnings) {
        rows.push({
          Section: 'WARNINGS',
          Metric: 'Setup Warning',
          Amount: '',
          Status: warning,
        });
      }
    }

    return convertToCsv(rows);
  }

  async exportTaxSummaryPdf(
    tenantId: string,
    query: TaxSummaryQueryDto,
    actor: AuthContext,
  ) {
    const csv = await this.exportTaxSummaryCsv(tenantId, query);
    const [headerLine, ...lines] = csv.split('\n');
    const headers = headerLine.split(',');
    const rows = lines
      .filter(Boolean)
      .map((line) =>
        Object.fromEntries(
          line
            .split(',')
            .map((value, index) => [
              headers[index],
              value.replace(/^"|"$/g, '').replace(/""/g, '"'),
            ]),
        ),
      );

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.tax-summary',
      title: 'VAT/TDS/PF Summary',
      subtitle: this.periodSubtitle(query),
      filters: query as unknown as Prisma.InputJsonValue,
      rows,
    });
  }

  async exportBankReconciliationCsv(
    tenantId: string,
    accountId: string,
    _actor: AuthContext,
  ): Promise<string> {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      return convertToCsv([{ Status: 'Account not found' }]);
    }

    const statements = await this.prisma.bankStatement.findMany({
      where: { tenantId, accountId },
      orderBy: { statementDate: 'asc' },
    });

    // Fetch matched journal entry numbers for reconciled statements
    const journalLineIds = statements
      .map((s) => s.journalLineId)
      .filter((id): id is string => Boolean(id));
    const matchedEntries =
      journalLineIds.length > 0
        ? await this.prisma.journalLine.findMany({
            where: { id: { in: journalLineIds } },
            include: { journalEntry: { select: { entryNumber: true } } },
          })
        : [];
    const entryNumberMap = new Map(
      matchedEntries.map((jl) => [jl.id, jl.journalEntry.entryNumber]),
    );

    const rows: Array<Record<string, unknown>> = statements.map((s) => ({
      Date: s.statementDate.toISOString().slice(0, 10),
      Description: s.description,
      Reference: s.reference ?? '',
      Debit: formatCsvDecimal(s.debitAmount),
      Credit: formatCsvDecimal(s.creditAmount),
      Reconciled: s.isReconciled ? 'YES' : 'NO',
      'Matched Journal': s.journalLineId
        ? (entryNumberMap.get(s.journalLineId) ?? s.journalLineId)
        : '',
      'Reconciled At': s.reconciledAt
        ? s.reconciledAt.toISOString().slice(0, 10)
        : '',
    }));

    const reconciledCount = statements.filter((s) => s.isReconciled).length;
    rows.push({
      Date: '',
      Description: 'SUMMARY',
      Reference: '',
      Debit: '',
      Credit: '',
      Reconciled: `${reconciledCount}/${statements.length}`,
      'Matched Journal': '',
      'Reconciled At': '',
    });

    return convertToCsv(rows);
  }

  async exportBankReconciliationPdf(
    tenantId: string,
    accountId: string,
    actor: AuthContext,
  ) {
    const account = await this.prisma.chartAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    const statements = await this.prisma.bankStatement.findMany({
      where: { tenantId, accountId },
      orderBy: { statementDate: 'asc' },
    });

    const rows: Array<Record<string, unknown>> = statements.map((s) => ({
      Date: s.statementDate.toISOString().slice(0, 10),
      Description: s.description.slice(0, 30),
      Ref: s.reference ?? '',
      Dr: formatCsvDecimal(s.debitAmount),
      Cr: formatCsvDecimal(s.creditAmount),
      Recon: s.isReconciled ? 'YES' : 'NO',
    }));

    const reconciledCount = statements.filter((s) => s.isReconciled).length;
    rows.push({
      Date: 'TOTAL',
      Description: `${reconciledCount}/${statements.length} reconciled`,
      Ref: '',
      Dr: '',
      Cr: '',
      Recon: '',
    });

    return this.buildAndSnapshotPdf({
      tenantId,
      actor,
      reportKey: 'accounting.bank-reconciliation',
      title: 'Bank Reconciliation',
      subtitle: account ? `${account.code} - ${account.name}` : 'Bank account',
      filters: { accountId },
      rows,
    });
  }

  async queueLargeReportExport(input: {
    reportKey: AccountingQueuedReportKey;
    format: AccountingQueuedReportFormat;
    filters: Record<string, unknown>;
    actor: AuthContext;
  }) {
    const totalRows = await this.getQueuedReportRowCount(input);
    if (totalRows <= ACCOUNTING_SYNC_EXPORT_ROW_LIMIT) {
      throw new BadRequestException(
        `${this.reportDisplayName(input.reportKey)} export has ${totalRows} rows and can be generated synchronously.`,
      );
    }
    if (totalRows > ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT) {
      throw new BadRequestException(
        `${this.reportDisplayName(input.reportKey)} export has ${totalRows} rows, which exceeds the background export limit of ${ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT}. Narrow the filters before exporting.`,
      );
    }

    const filters = input.filters as Prisma.InputJsonValue;
    const existingExport = await this.prisma.reportExport.findFirst({
      where: {
        tenantId: input.actor.tenantId,
        reportKey: input.reportKey,
        format: input.format,
        requestedBy: input.actor.userId,
        filters: { equals: filters },
        status: {
          in: [
            'QUEUED',
            'RUNNING',
            'COMPLETED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        fileAssetId: true,
      },
    });

    if (
      existingExport &&
      (existingExport.status !== 'COMPLETED' ||
        existingExport.fileAssetId)
    ) {
      await this.auditService.record({
        action: 'reuse_accounting_report_export_request',
        resource: 'accounting_report',
        resourceId: input.reportKey,
        tenantId: input.actor.tenantId,
        userId: input.actor.userId,
        after: {
          format: input.format,
          filters: input.filters,
          reportExportId: existingExport.id,
          status: existingExport.status,
          fileAssetId: existingExport.fileAssetId ?? null,
          totalRows,
        },
      });

      return {
        exportId: existingExport.id,
        status: existingExport.status,
        fileAssetId: existingExport.fileAssetId ?? null,
        totalRows,
        syncThreshold: ACCOUNTING_SYNC_EXPORT_ROW_LIMIT,
        backgroundThreshold: ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT,
        reused: true,
      };
    }

    const exportRecord = await this.prisma.reportExport.create({
      data: {
        tenantId: input.actor.tenantId,
        reportKey: input.reportKey,
        format: input.format,
        filters,
        status: 'QUEUED',
        requestedBy: input.actor.userId,
      },
    });
    const jobId = this.queuedReportJobId(input);
    const job = await this.accountingReportsQueue.add(
      'generateAccountingReport',
      {
        exportId: exportRecord.id,
        reportKey: input.reportKey,
        format: input.format,
        filters: input.filters,
        actor: input.actor,
      } satisfies AccountingQueuedReportJob,
      { jobId },
    );

    await this.auditService.record({
      action: 'queue_accounting_report_export',
      resource: 'accounting_report',
      resourceId: input.reportKey,
      tenantId: input.actor.tenantId,
      userId: input.actor.userId,
      after: {
        format: input.format,
        filters: input.filters,
        reportExportId: exportRecord.id,
        jobId: job.id,
        totalRows,
        syncThreshold: ACCOUNTING_SYNC_EXPORT_ROW_LIMIT,
        backgroundThreshold: ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT,
      },
    });

    return {
      exportId: exportRecord.id,
      jobId: job.id,
      status: 'QUEUED',
      totalRows,
      syncThreshold: ACCOUNTING_SYNC_EXPORT_ROW_LIMIT,
      backgroundThreshold: ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT,
      reused: false,
    };
  }

  async completeQueuedReportExport(input: AccountingQueuedReportJob) {
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: {
        id: input.exportId,
        tenantId: input.actor.tenantId,
        reportKey: input.reportKey,
      },
      select: {
        id: true,
        status: true,
        fileAssetId: true,
      },
    });

    if (!exportRecord) {
      throw new BadRequestException('Accounting report export not found');
    }

    if (
      exportRecord.status === 'COMPLETED' &&
      exportRecord.fileAssetId
    ) {
      await this.auditService.record({
        action: 'reuse_accounting_report_export',
        resource: 'accounting_report',
        resourceId: input.reportKey,
        tenantId: input.actor.tenantId,
        userId: input.actor.userId,
        after: {
          format: input.format,
          filters: input.filters,
          reportExportId: input.exportId,
          fileAssetId: exportRecord.fileAssetId,
          async: true,
        },
      });
      return;
    }

    const filters = input.filters as Prisma.InputJsonValue;
    const existingCompleted = await this.prisma.reportExport.findFirst({
      where: {
        tenantId: input.actor.tenantId,
        reportKey: input.reportKey,
        format: input.format,
        requestedBy: input.actor.userId,
        filters: { equals: filters },
        status: 'COMPLETED',
        fileAssetId: { not: null },
        id: { not: input.exportId },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileAssetId: true },
    });

    if (existingCompleted?.fileAssetId) {
      await this.prisma.reportExport.update({
        where: { id: input.exportId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          errorSummary: null,
          fileAssetId: existingCompleted.fileAssetId,
        },
      });
      await this.auditService.record({
        action: 'reuse_accounting_report_export',
        resource: 'accounting_report',
        resourceId: input.reportKey,
        tenantId: input.actor.tenantId,
        userId: input.actor.userId,
        after: {
          format: input.format,
          filters: input.filters,
          reportExportId: input.exportId,
          reusedReportExportId: existingCompleted.id,
          fileAssetId: existingCompleted.fileAssetId,
          async: true,
        },
      });
      return;
    }

    const artifact = await this.buildQueuedReportArtifact(input);
    const asset = await this.fileRegistryService.registerGeneratedFile({
      tenantId: input.actor.tenantId,
      generatedByUserId: input.actor.userId,
      originalFilename: artifact.fileName,
      content: artifact.content,
      mimeType: artifact.contentType,
      module: 'accounting',
      metadata: {
        reportKey: input.reportKey,
        format: input.format,
        filters,
        async: true,
      },
    });

    await this.prisma.reportExport.update({
      where: { id: input.exportId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        errorSummary: null,
        fileAssetId: asset.id,
      },
    });

    await this.auditService.record({
      action: 'export_accounting_report',
      resource: 'accounting_report',
      resourceId: input.reportKey,
      tenantId: input.actor.tenantId,
      userId: input.actor.userId,
      after: {
        format: input.format,
        filters: input.filters,
        fileAssetId: asset.id,
        async: true,
      },
    });
  }

  private async buildAndSnapshotPdf(input: {
    tenantId: string;
    actor: AuthContext;
    reportKey: string;
    title: string;
    subtitle: string;
    filters: Prisma.InputJsonValue;
    rows: Array<Record<string, unknown>>;
    summaryCards?: Array<{
      label: string;
      value: string | number;
      note?: string | null;
    }>;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    const content = buildTableReportPdf({
      schoolName: tenant?.name ?? input.actor.tenantSlug,
      title: input.title,
      subtitle: input.subtitle,
      rows: input.rows,
      summaryCards: input.summaryCards,
    });
    const existingExport = await this.prisma.reportExport.findFirst({
      where: {
        tenantId: input.tenantId,
        reportKey: input.reportKey,
        format: 'pdf',
        status: 'COMPLETED',
        requestedBy: input.actor.userId,
        filters: { equals: input.filters },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileAssetId: true },
    });

    if (existingExport?.fileAssetId) {
      await this.auditService.record({
        action: 'reuse_accounting_report_export',
        resource: 'accounting_report',
        resourceId: input.reportKey,
        tenantId: input.tenantId,
        userId: input.actor.userId,
        after: {
          format: 'pdf',
          filters: input.filters,
          reportExportId: existingExport.id,
          fileAssetId: existingExport.fileAssetId,
        },
      });

      return content;
    }

    const fileName = `${input.reportKey.replace(/\./g, '-')}-${new Date()
      .toISOString()
      .slice(0, 10)}.pdf`;
    const asset = await this.fileRegistryService.registerGeneratedFile({
      tenantId: input.tenantId,
      generatedByUserId: input.actor.userId,
      originalFilename: fileName,
      content,
      mimeType: 'application/pdf',
      module: 'accounting',
      metadata: {
        reportKey: input.reportKey,
        format: 'pdf',
        filters: input.filters,
      },
    });

    await this.prisma.reportExport.create({
      data: {
        tenantId: input.tenantId,
        reportKey: input.reportKey,
        format: 'pdf',
        filters: input.filters,
        status: 'COMPLETED',
        fileAssetId: asset.id,
        requestedBy: input.actor.userId,
        completedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'export_accounting_report',
      resource: 'accounting_report',
      resourceId: input.reportKey,
      tenantId: input.tenantId,
      userId: input.actor.userId,
      after: {
        format: 'pdf',
        filters: input.filters,
        fileAssetId: asset.id,
      },
    });

    return content;
  }

  private periodSubtitle(query: {
    fiscalYearId?: string;
    fiscalPeriodId?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    return [
      query.fiscalYearId ? `Fiscal Year: ${query.fiscalYearId}` : null,
      query.fiscalPeriodId ? `Period: ${query.fiscalPeriodId}` : null,
      query.fromDate || query.toDate
        ? `Date Range: ${query.fromDate ?? 'start'} to ${query.toDate ?? 'end'}`
        : null,
    ]
      .filter(Boolean)
      .join(' | ');
  }

  private async buildQueuedReportArtifact(input: AccountingQueuedReportJob) {
    if (input.reportKey === 'accounting.general-ledger') {
      const query = input.filters as unknown as GeneralLedgerQueryDto;
      if (input.format === 'csv') {
        return {
          content: Buffer.from(
            await this.exportGeneralLedgerCsv(input.actor.tenantId, query, {
              mode: 'background',
            }),
            'utf8',
          ),
          contentType: 'text/csv',
          fileName: this.queuedFileName(input.reportKey, 'csv'),
        };
      }
      return {
        content: await this.buildGeneralLedgerPdfContent(
          input.actor.tenantId,
          query,
          input.actor,
          'background',
        ),
        contentType: 'application/pdf',
        fileName: this.queuedFileName(input.reportKey, 'pdf'),
      };
    }

    const query = input.filters as unknown as CashBookQueryDto;
    if (input.format === 'csv') {
      return {
        content: Buffer.from(
          await this.exportCashBookCsv(input.actor.tenantId, query, {
            mode: 'background',
          }),
          'utf8',
        ),
        contentType: 'text/csv',
        fileName: this.queuedFileName(input.reportKey, 'csv'),
      };
    }
    return {
      content: await this.buildCashBookPdfContent(
        input.actor.tenantId,
        query,
        input.actor,
        'background',
      ),
      contentType: 'application/pdf',
      fileName: this.queuedFileName(input.reportKey, 'pdf'),
    };
  }

  private async buildGeneralLedgerPdfContent(
    tenantId: string,
    query: GeneralLedgerQueryDto,
    actor: AuthContext,
    mode: 'sync' | 'background',
  ) {
    const data = await this.reportsService.getGeneralLedger(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      sourceModule: query.sourceModule,
      sourceType: query.sourceType,
      sourceId: query.sourceId,
      page: mode === 'background' ? 1 : query.page,
      sort: query.sort,
      limit: this.rowLimitForMode(mode),
    });
    this.ensureWithinExportLimit('General Ledger', data.pagination.total, mode);
    const rows: Array<Record<string, unknown>> = [
      {
        Date: 'OPENING',
        Journal: '',
        Description: `${formatCsvDecimal(data.openingBalance)} ${data.openingBalanceSide}`,
        Debit: '',
        Credit: '',
        Balance: '',
      },
      ...data.rows.map((row) => ({
        Date: row.entryDate,
        Journal: row.entryNumber ?? '',
        Description: row.description ?? '',
        Debit: formatCsvDecimal(row.debit),
        Credit: formatCsvDecimal(row.credit),
        Balance: `${formatCsvDecimal(row.runningBalance)} ${row.runningBalanceSide}`,
      })),
      {
        Date: 'CLOSING',
        Journal: '',
        Description: data.accountCode ?? data.accountId ?? '',
        Debit: formatCsvDecimal(data.totals.debit),
        Credit: formatCsvDecimal(data.totals.credit),
        Balance: `${formatCsvDecimal(data.closingBalance)} ${data.closingBalanceSide}`,
      },
    ];

    return this.buildPdfContent({
      tenantId,
      actor,
      title: 'General Ledger',
      subtitle: this.periodSubtitle(query),
      rows,
    });
  }

  private async buildCashBookPdfContent(
    tenantId: string,
    query: CashBookQueryDto,
    actor: AuthContext,
    mode: 'sync' | 'background',
  ) {
    const data = await this.reportsService.getCashBook(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      accountKind: query.accountKind,
      page: mode === 'background' ? 1 : query.page,
      limit: this.rowLimitForMode(mode),
    });
    this.ensureWithinExportLimit('Cash Book', data.pagination.total, mode);
    const rows: Array<Record<string, unknown>> = data.rows.map((row) => ({
      Date: row.entryDate,
      Journal: row.entryNumber ?? '',
      Description: row.narration ?? '',
      Receipt: formatCsvDecimal(row.receiptAmount),
      Payment: formatCsvDecimal(row.paymentAmount),
      Balance: `${formatCsvDecimal(row.runningBalance)} ${row.runningBalanceSide}`,
    }));
    rows.push({
      Date: 'TOTAL',
      Journal: '',
      Description: data.account
        ? `${data.account.code} - ${data.account.name}`
        : '',
      Receipt: formatCsvDecimal(data.totalReceipts),
      Payment: formatCsvDecimal(data.totalPayments),
      Balance: `${formatCsvDecimal(data.closingBalance)} ${data.closingBalanceSide}`,
    });

    return this.buildPdfContent({
      tenantId,
      actor,
      title: 'Cash Book',
      subtitle: this.periodSubtitle(query),
      rows,
    });
  }

  private async buildPdfContent(input: {
    tenantId: string;
    actor: AuthContext;
    title: string;
    subtitle: string;
    rows: Array<Record<string, unknown>>;
    summaryCards?: Array<{
      label: string;
      value: string | number;
      note?: string | null;
    }>;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    return buildTableReportPdf({
      schoolName: tenant?.name ?? input.actor.tenantSlug,
      title: input.title,
      subtitle: input.subtitle,
      rows: input.rows,
      summaryCards: input.summaryCards,
    });
  }

  private async getQueuedReportRowCount(input: {
    reportKey: AccountingQueuedReportKey;
    filters: Record<string, unknown>;
    actor: AuthContext;
  }) {
    if (input.reportKey === 'accounting.general-ledger') {
      const data = await this.reportsService.getGeneralLedger(
        input.actor.tenantId,
        {
          ...(input.filters as unknown as GeneralLedgerQueryDto),
          page: 1,
          limit: 1,
        },
      );
      return data.pagination.total;
    }

    const data = await this.reportsService.getCashBook(input.actor.tenantId, {
      ...(input.filters as unknown as CashBookQueryDto),
      page: 1,
      limit: 1,
    });
    return data.pagination.total;
  }

  private rowLimitForMode(mode: 'sync' | 'background' = 'sync') {
    return mode === 'background'
      ? ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT
      : ACCOUNTING_SYNC_EXPORT_ROW_LIMIT;
  }

  private ensureWithinExportLimit(
    reportName: string,
    totalRows: number,
    mode: 'sync' | 'background' = 'sync',
  ) {
    const limit = this.rowLimitForMode(mode);
    if (totalRows <= limit) {
      return;
    }

    throw new BadRequestException(
      `${reportName} export has ${totalRows} rows, which exceeds the ${mode === 'sync' ? 'synchronous' : mode} export limit of ${limit}. Narrow the filters before exporting.`,
    );
  }

  private queuedReportJobId(input: {
    reportKey: AccountingQueuedReportKey;
    format: AccountingQueuedReportFormat;
    filters: Record<string, unknown>;
    actor: AuthContext;
  }) {
    return createHash('sha256')
      .update(
        [
          input.actor.tenantId,
          input.actor.userId,
          input.reportKey,
          input.format,
          stableStringify(input.filters),
        ].join(':'),
      )
      .digest('hex');
  }

  private reportDisplayName(reportKey: AccountingQueuedReportKey) {
    return reportKey === 'accounting.general-ledger'
      ? 'General Ledger'
      : 'Cash Book';
  }

  private queuedFileName(
    reportKey: AccountingQueuedReportKey,
    format: AccountingQueuedReportFormat,
  ) {
    return `${reportKey.replace(/\./g, '-')}-${new Date()
      .toISOString()
      .slice(0, 10)}.${format}`;
  }
}

const ACCOUNTING_SYNC_EXPORT_ROW_LIMIT = 1000;
const ACCOUNTING_BACKGROUND_EXPORT_ROW_LIMIT = 50000;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

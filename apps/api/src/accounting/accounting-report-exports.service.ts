import { Injectable } from '@nestjs/common';
import { AccountingReportsService } from './accounting-reports.service';
import { convertToCsv, formatCsvDecimal } from '../common/csv-utils';
import { TrialBalanceQueryDto } from './dto/trial-balance-query.dto';
import { GeneralLedgerQueryDto } from './dto/general-ledger-query.dto';
import { CashBookQueryDto } from './dto/cash-book-query.dto';
import { IncomeStatementQueryDto } from './dto/income-statement-query.dto';
import { BalanceSheetQueryDto } from './dto/balance-sheet-query.dto';
import { TaxSummaryQueryDto } from './dto/tax-summary-query.dto';

@Injectable()
export class AccountingReportExportsService {
  constructor(private readonly reportsService: AccountingReportsService) {}

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

  async exportGeneralLedgerCsv(
    tenantId: string,
    query: GeneralLedgerQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getGeneralLedger(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      accountCode: query.accountCode,
      page: query.page,
      limit: 10000,
    });

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

  async exportCashBookCsv(
    tenantId: string,
    query: CashBookQueryDto,
  ): Promise<string> {
    const data = await this.reportsService.getCashBook(tenantId, {
      fiscalYearId: query.fiscalYearId,
      fiscalPeriodId: query.fiscalPeriodId,
      fromDate: query.fromDate,
      toDate: query.toDate,
      accountId: query.accountId,
      page: query.page,
      limit: 10000,
    });

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
}

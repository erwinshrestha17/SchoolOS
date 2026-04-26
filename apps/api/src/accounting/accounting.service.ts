import { Injectable, NotFoundException } from '@nestjs/common';
import { AccountingPeriodStatus, JournalLineSide } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountingPeriodDto } from './dto/create-accounting-period.dto';

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listPeriods(actor: AuthContext) {
    return this.prisma.accountingPeriod.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ startsOn: 'desc' }],
    });
  }

  async createPeriod(dto: CreateAccountingPeriodDto, actor: AuthContext) {
    const period = await this.prisma.accountingPeriod.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        startsOn: new Date(dto.startsOn),
        endsOn: new Date(dto.endsOn),
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'accounting_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: period.id,
      after: {
        name: period.name,
      },
    });

    return period;
  }

  async buildReports(actor: AuthContext) {
    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        journalLines: {
          include: {
            journalEntry: true,
          },
        },
      },
      orderBy: [{ code: 'asc' }],
    });

    const trialBalance = accounts.map((account) => {
      const debit = account.journalLines
        .filter((line) => line.side === JournalLineSide.DEBIT)
        .reduce((sum, line) => sum + Number(line.amount), 0);
      const credit = account.journalLines
        .filter((line) => line.side === JournalLineSide.CREDIT)
        .reduce((sum, line) => sum + Number(line.amount), 0);

      return {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        debit,
        credit,
        balance: debit - credit,
      };
    });

    const totals = trialBalance.reduce(
      (acc, row) => ({
        debit: acc.debit + row.debit,
        credit: acc.credit + row.credit,
      }),
      { debit: 0, credit: 0 },
    );
    const income = trialBalance
      .filter((row) => row.type === 'INCOME')
      .reduce((sum, row) => sum + row.credit - row.debit, 0);
    const expenses = trialBalance
      .filter((row) => row.type === 'EXPENSE')
      .reduce((sum, row) => sum + row.debit - row.credit, 0);

    return {
      trialBalance,
      totals,
      incomeStatement: {
        income,
        expenses,
        netIncome: income - expenses,
      },
      balanced: Math.abs(totals.debit - totals.credit) < 0.01,
    };
  }

  async closePeriod(id: string, actor: AuthContext) {
    const period = await this.prisma.accountingPeriod.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!period) {
      throw new NotFoundException('Accounting period not found in this tenant');
    }

    const closed = await this.prisma.accountingPeriod.update({
      where: { id: period.id },
      data: {
        status: AccountingPeriodStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    await this.auditService.record({
      action: 'close',
      resource: 'accounting_period',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: closed.id,
      after: {
        name: closed.name,
        status: closed.status,
      },
    });

    return closed;
  }
}

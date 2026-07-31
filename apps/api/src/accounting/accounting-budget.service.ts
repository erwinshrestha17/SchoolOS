import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateFiscalBudgetDto } from './dto/create-fiscal-budget.dto';
import { UpsertFiscalBudgetLinesDto } from './dto/upsert-fiscal-budget-lines.dto';
import { ApproveFiscalBudgetDto } from './dto/approve-fiscal-budget.dto';

@Injectable()
export class AccountingBudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listBudgets(tenantId: string, fiscalYearId?: string) {
    return this.prisma.fiscalBudget.findMany({
      where: {
        tenantId,
        ...(fiscalYearId ? { fiscalYearId } : {}),
      },
      include: {
        lines: {
          include: {
            chartAccount: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
      orderBy: [{ fiscalYearId: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createBudget(
    tenantId: string,
    userId: string,
    dto: CreateFiscalBudgetDto,
  ) {
    const fiscalYear = await this.prisma.fiscalYear.findFirst({
      where: { id: dto.fiscalYearId, tenantId },
    });
    if (!fiscalYear) throw new NotFoundException('Fiscal year not found');

    const existing = await this.prisma.fiscalBudget.findFirst({
      where: {
        tenantId,
        fiscalYearId: dto.fiscalYearId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A budget with this name already exists for the fiscal year.',
      );
    }

    const budget = await this.prisma.fiscalBudget.create({
      data: {
        tenantId,
        fiscalYearId: dto.fiscalYearId,
        name: dto.name,
        createdById: userId,
      },
      include: { lines: true },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'fiscal_budget',
      tenantId,
      userId,
      resourceId: budget.id,
      after: budget,
    });

    return budget;
  }

  async upsertBudgetLines(
    tenantId: string,
    userId: string,
    budgetId: string,
    dto: UpsertFiscalBudgetLinesDto,
  ) {
    const budget = await this.prisma.fiscalBudget.findFirst({
      where: { id: budgetId, tenantId },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status !== 'DRAFT') {
      throw new BadRequestException('Only draft budgets can be edited.');
    }

    const accountIds = dto.lines.map((line) => line.chartAccountId);
    const accounts = await this.prisma.chartAccount.findMany({
      where: { tenantId, id: { in: accountIds } },
    });
    if (accounts.length !== new Set(accountIds).size) {
      throw new BadRequestException(
        'One or more chart accounts are invalid for this tenant.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        await tx.fiscalBudgetLine.upsert({
          where: {
            tenantId_budgetId_chartAccountId: {
              tenantId,
              budgetId,
              chartAccountId: line.chartAccountId,
            },
          },
          create: {
            tenantId,
            budgetId,
            chartAccountId: line.chartAccountId,
            fiscalPeriodId: line.fiscalPeriodId,
            amount: new Prisma.Decimal(line.amount),
          },
          update: {
            fiscalPeriodId: line.fiscalPeriodId,
            amount: new Prisma.Decimal(line.amount),
          },
        });
      }
    });

    const updated = await this.prisma.fiscalBudget.findFirst({
      where: { id: budgetId, tenantId },
      include: {
        lines: {
          include: {
            chartAccount: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    await this.auditService.record({
      action: 'update',
      resource: 'fiscal_budget',
      tenantId,
      userId,
      resourceId: budgetId,
      after: { lineCount: dto.lines.length },
    });

    return updated;
  }

  async approveBudget(
    tenantId: string,
    userId: string,
    budgetId: string,
    dto: ApproveFiscalBudgetDto,
  ) {
    const budget = await this.prisma.fiscalBudget.findFirst({
      where: { id: budgetId, tenantId },
      include: { lines: true },
    });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.status !== 'DRAFT') {
      throw new BadRequestException('Only draft budgets can be approved.');
    }
    if (budget.lines.length === 0) {
      throw new BadRequestException(
        'Add at least one budget line before approval.',
      );
    }

    const approved = await this.prisma.fiscalBudget.update({
      where: { id: budgetId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: userId,
      },
      include: {
        lines: {
          include: {
            chartAccount: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    await this.auditService.record({
      action: 'approve',
      resource: 'fiscal_budget',
      tenantId,
      userId,
      resourceId: budgetId,
      after: { reason: dto.reason, status: approved.status },
    });

    return approved;
  }
}

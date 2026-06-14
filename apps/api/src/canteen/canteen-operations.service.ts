import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

interface DateRangeInput {
  from?: string;
  to?: string;
}

interface SupplierPurchaseReportInput extends DateRangeInput {
  supplierId?: string;
}

@Injectable()
export class CanteenOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async closeStockDate(
    input: { date: string; reason: string },
    actor: AuthContext,
  ) {
    const dateKey = this.toDateKey(input.date);
    const existing = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: actor.tenantId,
        resource: 'canteen_stock_close',
        action: 'close',
        resourceId: dateKey,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      throw new ConflictException('Canteen stock date is already closed');
    }

    await this.auditService.record({
      action: 'close',
      resource: 'canteen_stock_close',
      resourceId: dateKey,
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { date: dateKey, reason: input.reason },
    });

    return { date: dateKey, closed: true, reason: input.reason };
  }

  async listStockCloses(actor: AuthContext, input: DateRangeInput = {}) {
    const { from, to } = this.dateRange(input);
    return this.prisma.auditLog.findMany({
      where: {
        tenantId: actor.tenantId,
        resource: 'canteen_stock_close',
        action: 'close',
        createdAt: { gte: from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async wastageSummary(actor: AuthContext, input: DateRangeInput = {}) {
    const { from, to } = this.dateRange(input);
    const rows = await this.prisma.canteenWastage.groupBy({
      by: ['inventoryItemId'],
      where: {
        tenantId: actor.tenantId,
        wastageDate: { gte: from, lte: to },
      },
      _count: { _all: true },
      _sum: { quantity: true, totalCost: true },
      orderBy: [{ _sum: { totalCost: 'desc' } }],
    });

    const itemIds = rows.map((row) => row.inventoryItemId);
    const items = await this.prisma.canteenInventoryItem.findMany({
      where: { tenantId: actor.tenantId, id: { in: itemIds } },
      select: { id: true, name: true, category: true, unit: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return rows.map((row) => ({
      inventoryItemId: row.inventoryItemId,
      inventoryItem: itemById.get(row.inventoryItemId) ?? null,
      wastageCount: row._count._all,
      totalQuantity: row._sum.quantity ?? new Prisma.Decimal(0),
      totalCost: row._sum.totalCost ?? new Prisma.Decimal(0),
    }));
  }

  async lowStockAlerts(actor: AuthContext) {
    const items = await this.prisma.canteenInventoryItem.findMany({
      where: { tenantId: actor.tenantId, isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 1000,
    });

    return items.filter((item) => item.currentStock.lte(item.minStockLevel));
  }

  async supplierPurchaseSummary(
    actor: AuthContext,
    input: SupplierPurchaseReportInput = {},
  ) {
    const { from, to } = this.dateRange(input);
    const rows = await this.prisma.canteenPurchaseBill.groupBy({
      by: ['supplierId'],
      where: {
        tenantId: actor.tenantId,
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        billDate: { gte: from, lte: to },
      },
      _count: { _all: true },
      _sum: {
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
        netAmount: true,
      },
      orderBy: [{ _sum: { netAmount: 'desc' } }],
    });

    const supplierIds = rows.map((row) => row.supplierId);
    const suppliers = await this.prisma.canteenSupplier.findMany({
      where: { tenantId: actor.tenantId, id: { in: supplierIds } },
      select: { id: true, name: true, phone: true, panNumber: true },
    });
    const supplierById = new Map(
      suppliers.map((supplier) => [supplier.id, supplier]),
    );

    return rows.map((row) => ({
      supplierId: row.supplierId,
      supplier: supplierById.get(row.supplierId) ?? null,
      billCount: row._count._all,
      totalAmount: row._sum.totalAmount ?? new Prisma.Decimal(0),
      taxAmount: row._sum.taxAmount ?? new Prisma.Decimal(0),
      discountAmount: row._sum.discountAmount ?? new Prisma.Decimal(0),
      netAmount: row._sum.netAmount ?? new Prisma.Decimal(0),
    }));
  }

  async purchaseBillDetail(id: string, actor: AuthContext) {
    const bill = await this.prisma.canteenPurchaseBill.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
        createdBy: true,
      },
    });

    if (!bill) {
      throw new NotFoundException(
        'Canteen purchase bill not found in this tenant',
      );
    }

    return {
      ...bill,
      editLock: await this.getPurchaseBillEditLock(bill, actor),
    };
  }

  async purchaseBillEditLock(id: string, actor: AuthContext) {
    const bill = await this.prisma.canteenPurchaseBill.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!bill) {
      throw new NotFoundException(
        'Canteen purchase bill not found in this tenant',
      );
    }

    return this.getPurchaseBillEditLock(bill, actor);
  }

  private async getPurchaseBillEditLock(
    bill: { id: string; billDate: Date; isPaid: boolean; paidAt: Date | null },
    actor: AuthContext,
  ) {
    const reasons: string[] = [];
    if (bill.isPaid || bill.paidAt) {
      reasons.push('Vendor bill is paid');
    }

    const dateKey = this.toDateKey(bill.billDate);
    const stockClose = await this.prisma.auditLog.findFirst({
      where: {
        tenantId: actor.tenantId,
        resource: 'canteen_stock_close',
        action: 'close',
        resourceId: dateKey,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (stockClose) {
      reasons.push(`Stock date ${dateKey} is closed`);
    }

    return {
      purchaseBillId: bill.id,
      locked: reasons.length > 0,
      reasons,
    };
  }

  private dateRange(input: DateRangeInput = {}) {
    const from = input.from
      ? this.startOfDay(input.from)
      : new Date('1970-01-01T00:00:00.000Z');
    const to = input.to ? this.endOfDay(input.to) : new Date();
    return { from, to };
  }

  private startOfDay(value: string | Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string | Date) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private toDateKey(value: string | Date) {
    return this.startOfDay(value).toISOString().slice(0, 10);
  }
}

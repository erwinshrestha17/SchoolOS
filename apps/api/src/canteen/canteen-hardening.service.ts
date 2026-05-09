import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AudienceType,
  CanteenEnrollmentStatus,
  CanteenMealServingStatus,
  ConsentType,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CanteenReasonDto,
  CanteenLowBalanceAlertDto,
} from './dto/canteen-hardening.dto';

@Injectable()
export class CanteenHardeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
  ) {}

  pauseEnrollment(id: string, dto: CanteenReasonDto, actor: AuthContext) {
    return this.transitionEnrollment(
      id,
      CanteenEnrollmentStatus.PAUSED,
      dto.reason,
      actor,
      'pause',
    );
  }

  resumeEnrollment(id: string, dto: CanteenReasonDto, actor: AuthContext) {
    return this.transitionEnrollment(
      id,
      CanteenEnrollmentStatus.ACTIVE,
      dto.reason,
      actor,
      'resume',
    );
  }

  endEnrollment(id: string, dto: CanteenReasonDto, actor: AuthContext) {
    return this.transitionEnrollment(
      id,
      CanteenEnrollmentStatus.ENDED,
      dto.reason,
      actor,
      'end',
    );
  }

  async cancelServing(id: string, dto: CanteenReasonDto, actor: AuthContext) {
    return this.transitionServing(
      id,
      CanteenMealServingStatus.CANCELLED,
      dto.reason,
      actor,
      'cancel',
    );
  }

  async markServingNotTaken(
    id: string,
    dto: CanteenReasonDto,
    actor: AuthContext,
  ) {
    return this.transitionServing(
      id,
      CanteenMealServingStatus.NOT_TAKEN,
      dto.reason,
      actor,
      'not_taken',
    );
  }

  async sendLowBalanceAlerts(
    dto: CanteenLowBalanceAlertDto,
    actor: AuthContext,
  ) {
    const windowKey = dto.windowKey ?? new Date().toISOString().slice(0, 10);
    const wallets = await this.prisma.canteenWallet.findMany({
      where: { tenantId: actor.tenantId },
      include: { student: true },
      orderBy: [{ balance: 'asc' }],
      take: 500,
    });

    const lowBalanceWallets = wallets.filter((wallet) =>
      wallet.balance.lte(wallet.lowBalanceThreshold),
    );

    let queued = 0;
    let skipped = 0;

    for (const wallet of lowBalanceWallets) {
      const sourceId = `canteen-low-balance:${wallet.studentId}:${wallet.lowBalanceThreshold.toString()}:${windowKey}`;
      const existing = await this.prisma.notificationDelivery.count({
        where: {
          tenantId: actor.tenantId,
          sourceType: 'canteen_low_balance',
          sourceId,
        },
      });

      if (existing > 0) {
        skipped += 1;
        continue;
      }

      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'canteen_low_balance',
        sourceId,
        audienceType: AudienceType.ALL,
        studentIds: [wallet.studentId],
        title: 'Canteen wallet low balance',
        body: `Canteen wallet balance is ${wallet.balance.toString()}, below the threshold ${wallet.lowBalanceThreshold.toString()}.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });
      queued += 1;
    }

    await this.auditService.record({
      action: 'send_low_balance_alerts',
      resource: 'canteen_wallet',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        walletCount: lowBalanceWallets.length,
        queued,
        skipped,
        windowKey,
      },
    });

    return {
      windowKey,
      walletCount: lowBalanceWallets.length,
      queued,
      skipped,
    };
  }

  async exportDailyMealCountCsv(actor: AuthContext, date?: string) {
    const mealDate = date ? new Date(date) : new Date();
    mealDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.canteenMealServing.groupBy({
      by: ['mealType', 'status'],
      where: { tenantId: actor.tenantId, mealDate },
      _count: { _all: true },
      orderBy: [{ mealType: 'asc' }],
    });

    await this.auditService.record({
      action: 'export',
      resource: 'canteen_daily_meal_count_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        rowCount: rows.length,
        date: mealDate.toISOString().slice(0, 10),
      },
    });

    return [
      ['Meal Type', 'Status', 'Count'],
      ...rows.map((row) => [row.mealType, row.status, row._count._all]),
    ]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');
  }

  async exportItemWiseSalesCsv(
    actor: AuthContext,
    input: { from?: string; to?: string },
  ) {
    const from = input.from
      ? new Date(input.from)
      : new Date('1970-01-01T00:00:00.000Z');
    const to = input.to ? new Date(input.to) : new Date();

    const rows = await this.prisma.canteenPosSaleItem.groupBy({
      by: ['menuItemId', 'itemName', 'category'],
      where: {
        tenantId: actor.tenantId,
        sale: {
          tenantId: actor.tenantId,
          status: 'COMPLETED',
          saleDate: { gte: from, lte: to },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: [{ _sum: { lineTotal: 'desc' } }],
    });

    await this.auditService.record({
      action: 'export',
      resource: 'canteen_item_wise_sales_report',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: { rowCount: rows.length },
    });

    return [
      ['Menu Item ID', 'Item Name', 'Category', 'Quantity', 'Sales Amount'],
      ...rows.map((row) => [
        row.menuItemId,
        row.itemName,
        row.category,
        row._sum.quantity ?? 0,
        row._sum.lineTotal?.toString() ?? '0',
      ]),
    ]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');
  }

  private async transitionEnrollment(
    id: string,
    status: CanteenEnrollmentStatus,
    reason: string,
    actor: AuthContext,
    action: string,
  ) {
    const existing = await this.prisma.canteenStudentEnrollment.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        'Canteen enrollment not found in this tenant',
      );
    }

    const updated = await this.prisma.canteenStudentEnrollment.update({
      where: { id: existing.id },
      data: {
        status,
        notes: reason,
        endsOn:
          status === CanteenEnrollmentStatus.ENDED
            ? new Date()
            : existing.endsOn,
      },
    });

    await this.auditService.record({
      action,
      resource: 'canteen_enrollment',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: { status: existing.status },
      after: { status: updated.status, reason },
    });

    return updated;
  }

  private async transitionServing(
    id: string,
    status: CanteenMealServingStatus,
    reason: string,
    actor: AuthContext,
    action: string,
  ) {
    const existing = await this.prisma.canteenMealServing.findFirst({
      where: { id, tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException(
        'Canteen meal serving not found in this tenant',
      );
    }

    const updated = await this.prisma.canteenMealServing.update({
      where: { id: existing.id },
      data: {
        status,
        notes: reason,
      },
    });

    await this.auditService.record({
      action,
      resource: 'canteen_meal_serving',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: id,
      before: { status: existing.status },
      after: { status: updated.status, reason },
    });

    return updated;
  }
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

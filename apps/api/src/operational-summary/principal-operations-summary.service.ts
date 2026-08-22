import { Injectable } from '@nestjs/common';
import { getNepalSchoolDay } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementsService } from '../plans/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';

type MetricValue = number | string | null;
type ModuleStatus = 'ready' | 'empty' | 'partial' | 'locked';

type PrincipalOperationsModuleSummary = {
  status: ModuleStatus;
  metrics: Record<string, MetricValue>;
};

@Injectable()
export class PrincipalOperationsSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async getSummary(actor: AuthContext) {
    const day = getNepalSchoolDay();
    const enabled = new Set(
      (await this.entitlements.getEntitlements(actor.tenantId)).modules,
    );

    const [library, transport, canteen] = await Promise.all([
      enabled.has('library')
        ? this.library(actor.tenantId, day)
        : Promise.resolve(locked()),
      enabled.has('transport')
        ? this.transport(actor.tenantId, day)
        : Promise.resolve(locked()),
      enabled.has('canteen')
        ? this.canteen(actor.tenantId, day)
        : Promise.resolve(locked()),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      modules: { library, transport, canteen },
    };
  }

  private async library(
    tenantId: string,
    day: ReturnType<typeof getNepalSchoolDay>,
  ): Promise<PrincipalOperationsModuleSummary> {
    const [activeLoans, overdueLoans, returnsDueToday, lostOrDamagedCopies] =
      await Promise.all([
        safe(() =>
          this.prisma.libraryIssue.count({
            where: { tenantId, status: 'ISSUED' },
          }),
        ),
        safe(() =>
          this.prisma.libraryIssue.count({
            where: { tenantId, status: 'OVERDUE' },
          }),
        ),
        safe(() =>
          this.prisma.libraryIssue.count({
            where: {
              tenantId,
              dueAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
              returnedAt: null,
            },
          }),
        ),
        safe(() =>
          this.prisma.libraryCopy.count({
            where: { tenantId, status: { in: ['LOST', 'DAMAGED'] } },
          }),
        ),
      ]);

    return moduleSummary({
      activeLoans,
      overdueLoans,
      returnsDueToday,
      lostOrDamagedCopies,
    });
  }

  private async transport(
    tenantId: string,
    day: ReturnType<typeof getNepalSchoolDay>,
  ): Promise<PrincipalOperationsModuleSummary> {
    const now = new Date();
    const staleGpsAt = new Date(now.getTime() - 15 * 60_000);
    const thirtyDays = new Date(day.endExclusiveUtc.getTime() + 30 * 86_400_000);
    const [activeTripsToday, delayedTrips, tripsWithStaleGps, vehicleDocumentRisks] =
      await Promise.all([
        safe(() =>
          this.prisma.transportTrip.count({
            where: {
              tenantId,
              status: 'ACTIVE',
              startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            },
          }),
        ),
        safe(() =>
          this.prisma.transportTrip.count({
            where: { tenantId, status: 'ACTIVE', isDelayed: true },
          }),
        ),
        safe(() =>
          this.prisma.transportTrip.count({
            where: {
              tenantId,
              status: 'ACTIVE',
              locationPings: { none: { recordedAt: { gte: staleGpsAt } } },
            },
          }),
        ),
        safe(() =>
          this.prisma.transportVehicle.count({
            where: {
              tenantId,
              OR: [
                { insuranceExpiry: { lte: thirtyDays } },
                { fitnessCertificateExp: { lte: thirtyDays } },
                { registrationExpiry: { lte: thirtyDays } },
                { documentExpiry: { lte: thirtyDays } },
              ],
            },
          }),
        ),
      ]);

    return moduleSummary({
      activeTripsToday,
      delayedTrips,
      tripsWithStaleGps,
      vehicleDocumentRisks,
    });
  }

  private async canteen(
    tenantId: string,
    day: ReturnType<typeof getNepalSchoolDay>,
  ): Promise<PrincipalOperationsModuleSummary> {
    const [completedSalesToday, servingsToday, outOfStockItems, salesTodayAmount] =
      await Promise.all([
        safe(() =>
          this.prisma.canteenPosSale.count({
            where: {
              tenantId,
              completedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            },
          }),
        ),
        safe(() =>
          this.prisma.canteenMealServing.count({
            where: {
              tenantId,
              mealDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
            },
          }),
        ),
        safe(() =>
          this.prisma.canteenInventoryItem.count({
            where: { tenantId, currentStock: { lte: 0 }, isActive: true },
          }),
        ),
        safe(async () => {
          const result = await this.prisma.canteenPosSale.aggregate({
            where: {
              tenantId,
              completedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            },
            _sum: { totalAmount: true },
          });
          return result._sum.totalAmount?.toString() ?? '0';
        }),
      ]);

    return moduleSummary({
      completedSalesToday,
      servingsToday,
      outOfStockItems,
      salesTodayAmount,
    });
  }
}

async function safe<T extends number | string>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch {
    return null;
  }
}

function locked(): PrincipalOperationsModuleSummary {
  return { status: 'locked', metrics: {} };
}

function moduleSummary(
  metrics: Record<string, MetricValue>,
): PrincipalOperationsModuleSummary {
  const values = Object.values(metrics);
  if (values.some((value) => value === null)) {
    return { status: 'partial', metrics };
  }
  const meaningful = values.some((value) =>
    typeof value === 'number' ? value > 0 : Number(value) > 0,
  );
  return { status: meaningful ? 'ready' : 'empty', metrics };
}

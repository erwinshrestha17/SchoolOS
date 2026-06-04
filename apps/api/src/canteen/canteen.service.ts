import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CanteenEnrollmentStatus,
  CanteenMealPlanStatus,
  CanteenMealServingStatus,
  CanteenMenuItemStatus,
  CanteenPaymentMethod,
  CanteenPosSaleStatus,
  CanteenWalletTransactionSource,
  CanteenWalletTransactionType,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AccountingPostingService } from '../accounting/accounting-posting.service';
import type { AuthContext } from '../auth/auth.types';
import { buildSimplePdf } from '../common/pdf/simple-pdf';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceService } from '../finance/finance.service';
import {
  CompleteCanteenPosSaleDto,
  CreateCanteenMealPlanDto,
  CreateCanteenMenuItemDto,
  CreateCanteenPosSaleDto,
  EnrollCanteenStudentDto,
  ServeCanteenMealDto,
  TopUpCanteenWalletDto,
  UpdateCanteenEnrollmentDto,
  UpdateCanteenMealPlanDto,
  UpdateCanteenMenuItemDto,
  UpdateCanteenStatusDto,
  UpsertCanteenSpendingControlDto,
} from './dto/canteen.dto';
import {
  CanteenCorrectionDto,
  CanteenReversalDto,
  CreateCanteenInventoryItemDto,
  CreateCanteenPurchaseBillDto,
  CreateCanteenSupplierDto,
  CreateCanteenWastageDto,
  ManualStockAdjustmentDto,
  OverrideAllergyDto,
} from './dto/canteen-hardened.dto';

type Tx = Prisma.TransactionClient;
interface PurchaseBillItemData {
  tenantId: string;
  inventoryItemId: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  expiryDate: Date | null;
  batchNumber: string | null;
}
interface PaginationQuery {
  page?: string;
  limit?: string;
}
interface ListMenuItemsQuery extends PaginationQuery {
  query?: string;
  category?: string;
  status?: string;
}
interface ListMealPlansQuery extends PaginationQuery {
  status?: string;
  mealType?: string;
}
interface ListEnrollmentsQuery extends PaginationQuery {
  studentId?: string;
  mealPlanId?: string;
  status?: string;
}
interface ListServingsQuery extends PaginationQuery {
  date?: string;
  mealType?: string;
}
interface ListPosSalesQuery extends PaginationQuery {
  status?: string;
  studentId?: string;
  from?: string;
  to?: string;
}
interface DateRangeQuery {
  from?: string;
  to?: string;
}
interface StudentDateRangeQuery extends DateRangeQuery {
  studentId?: string;
}
interface SaleItem {
  id: string;
  name: string;
  category: string;
  unitPrice: Prisma.Decimal;
  quantity: number;
  lineTotal: Prisma.Decimal;
}

@Injectable()
export class CanteenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly financeService: FinanceService,
  ) {}

  async createMenuItem(dto: CreateCanteenMenuItemDto, actor: AuthContext) {
    const item = await this.prisma.canteenMenuItem.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        category: dto.category.trim(),
        description: dto.description ?? null,
        unitPrice: new Prisma.Decimal(dto.unitPrice),
        isMealItem: dto.isMealItem ?? false,
        allergenTags: dto.allergenTags ?? [],
      },
    });
    await this.audit(actor, 'create', 'canteen_menu_item', item.id, null, item);
    return item;
  }

  async listMenuItems(actor: AuthContext, options: ListMenuItemsQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.CanteenMenuItemWhereInput = {
      tenantId: actor.tenantId,
      ...(options.query
        ? {
            OR: [
              { name: { contains: options.query, mode: 'insensitive' } },
              { category: { contains: options.query, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(options.category ? { category: options.category } : {}),
      ...(options.status
        ? { status: this.parseMenuItemStatus(options.status) }
        : {}),
      archivedAt: null,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenMenuItem.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take,
      }),
      this.prisma.canteenMenuItem.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async updateMenuItem(
    id: string,
    dto: UpdateCanteenMenuItemDto,
    actor: AuthContext,
  ) {
    const existing = await this.requireMenuItem(actor.tenantId, id);
    const updated = await this.prisma.canteenMenuItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined
          ? { category: dto.category.trim() }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.unitPrice !== undefined
          ? { unitPrice: new Prisma.Decimal(dto.unitPrice) }
          : {}),
        ...(dto.isMealItem !== undefined ? { isMealItem: dto.isMealItem } : {}),
        ...(dto.allergenTags !== undefined
          ? { allergenTags: dto.allergenTags }
          : {}),
      },
    });
    await this.audit(
      actor,
      'update',
      'canteen_menu_item',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async updateMenuItemStatus(
    id: string,
    dto: UpdateCanteenStatusDto,
    actor: AuthContext,
  ) {
    const existing = await this.requireMenuItem(actor.tenantId, id);
    const status = this.parseMenuItemStatus(dto.status);
    const updated = await this.prisma.canteenMenuItem.update({
      where: { id },
      data: { status },
    });
    await this.audit(actor, 'mark_status', 'canteen_menu_item', id, existing, {
      status,
      reason: dto.reason ?? null,
    });
    return updated;
  }

  async archiveMenuItem(id: string, reason: string, actor: AuthContext) {
    const existing = await this.requireMenuItem(actor.tenantId, id);
    const updated = await this.prisma.canteenMenuItem.update({
      where: { id },
      data: {
        status: CanteenMenuItemStatus.ARCHIVED,
        archivedAt: new Date(),
        archiveReason: reason,
      },
    });
    await this.audit(actor, 'archive', 'canteen_menu_item', id, existing, {
      status: CanteenMenuItemStatus.ARCHIVED,
      reason,
    });
    return updated;
  }

  async createMealPlan(dto: CreateCanteenMealPlanDto, actor: AuthContext) {
    const plan = await this.prisma.canteenMealPlan.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        mealType: dto.mealType.trim(),
        price: new Prisma.Decimal(dto.price),
        billingFrequency: dto.billingFrequency ?? 'MONTHLY',
        duplicateServingPrevention: dto.duplicateServingPrevention ?? true,
      },
    });
    await this.audit(actor, 'create', 'canteen_meal_plan', plan.id, null, plan);
    return plan;
  }

  async listMealPlans(actor: AuthContext, options: ListMealPlansQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.CanteenMealPlanWhereInput = {
      tenantId: actor.tenantId,
      ...(options.status
        ? { status: this.parseMealPlanStatus(options.status) }
        : {}),
      ...(options.mealType ? { mealType: options.mealType } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenMealPlan.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.canteenMealPlan.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async updateMealPlan(
    id: string,
    dto: UpdateCanteenMealPlanDto,
    actor: AuthContext,
  ) {
    const existing = await this.requireMealPlan(actor.tenantId, id);
    const updated = await this.prisma.canteenMealPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.mealType !== undefined ? { mealType: dto.mealType } : {}),
        ...(dto.price !== undefined
          ? { price: new Prisma.Decimal(dto.price) }
          : {}),
        ...(dto.billingFrequency !== undefined
          ? { billingFrequency: dto.billingFrequency }
          : {}),
        ...(dto.duplicateServingPrevention !== undefined
          ? { duplicateServingPrevention: dto.duplicateServingPrevention }
          : {}),
      },
    });
    await this.audit(
      actor,
      'update',
      'canteen_meal_plan',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async updateMealPlanStatus(
    id: string,
    dto: UpdateCanteenStatusDto,
    actor: AuthContext,
  ) {
    const existing = await this.requireMealPlan(actor.tenantId, id);
    const status = this.parseMealPlanStatus(dto.status);
    const updated = await this.prisma.canteenMealPlan.update({
      where: { id },
      data: { status },
    });
    await this.audit(actor, 'mark_status', 'canteen_meal_plan', id, existing, {
      status,
      reason: dto.reason ?? null,
    });
    return updated;
  }

  async enrollStudent(dto: EnrollCanteenStudentDto, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const plan = await this.requireMealPlan(actor.tenantId, dto.mealPlanId);
    if (plan.status !== CanteenMealPlanStatus.ACTIVE) {
      throw new ConflictException('Inactive meal plans cannot be assigned');
    }
    const startsOn = this.dateOnly(dto.startsOn);
    const endsOn = dto.endsOn ? this.dateOnly(dto.endsOn) : null;
    const enrollment = await this.prisma.$transaction(async (tx) => {
      await this.assertNoDuplicateMealPlanEnrollment(tx, {
        tenantId: actor.tenantId,
        studentId: dto.studentId,
        mealPlanId: dto.mealPlanId,
        startsOn,
        endsOn,
      });

      const created = await tx.canteenStudentEnrollment.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          mealPlanId: dto.mealPlanId,
          startsOn,
          endsOn,
          notes: dto.notes ?? null,
        },
      });

      if (plan.price.gt(0)) {
        const invoice = await this.financeService.createCanteenMealPlanInvoice(
          tx,
          {
            actor,
            studentId: dto.studentId,
            mealPlanName: plan.name,
            mealType: plan.mealType,
            amount: plan.price,
            dueDate: startsOn,
            servicePeriodStart: startsOn,
            servicePeriodEnd: endsOn,
            sourceEnrollmentId: created.id,
          },
        );

        return tx.canteenStudentEnrollment.update({
          where: { id: created.id },
          data: {
            feeInvoiceId: invoice.id,
            feePostedAt: new Date(),
          },
        });
      }

      return created;
    });

    await this.audit(
      actor,
      'create',
      'canteen_enrollment',
      enrollment.id,
      null,
      enrollment,
    );
    return enrollment;
  }

  async listEnrollments(
    actor: AuthContext,
    options: ListEnrollmentsQuery = {},
  ) {
    const { skip, take, page } = this.pagination(options);
    const where: Prisma.CanteenStudentEnrollmentWhereInput = {
      tenantId: actor.tenantId,
      ...(options.studentId ? { studentId: options.studentId } : {}),
      ...(options.mealPlanId ? { mealPlanId: options.mealPlanId } : {}),
      ...(options.status
        ? { status: this.parseEnrollmentStatus(options.status) }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenStudentEnrollment.findMany({
        where,
        include: { mealPlan: true, student: true },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.canteenStudentEnrollment.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async updateEnrollment(
    id: string,
    dto: UpdateCanteenEnrollmentDto,
    actor: AuthContext,
  ) {
    const existing = await this.requireEnrollment(actor.tenantId, id);
    if (dto.mealPlanId) {
      const plan = await this.requireMealPlan(actor.tenantId, dto.mealPlanId);
      if (plan.status !== CanteenMealPlanStatus.ACTIVE) {
        throw new ConflictException('Inactive meal plans cannot be assigned');
      }
    }
    const updated = await this.prisma.canteenStudentEnrollment.update({
      where: { id },
      data: {
        ...(dto.mealPlanId !== undefined ? { mealPlanId: dto.mealPlanId } : {}),
        ...(dto.startsOn !== undefined
          ? { startsOn: this.dateOnly(dto.startsOn) }
          : {}),
        ...(dto.endsOn !== undefined
          ? { endsOn: dto.endsOn ? this.dateOnly(dto.endsOn) : null }
          : {}),
        ...(dto.status !== undefined
          ? { status: this.parseEnrollmentStatus(dto.status) }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    await this.audit(
      actor,
      'update',
      'canteen_enrollment',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async cancelEnrollment(id: string, actor: AuthContext) {
    const existing = await this.requireEnrollment(actor.tenantId, id);
    const updated = await this.prisma.canteenStudentEnrollment.update({
      where: { id },
      data: { status: CanteenEnrollmentStatus.CANCELLED },
    });
    await this.audit(
      actor,
      'cancel',
      'canteen_enrollment',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async serveMeal(
    dto: ServeCanteenMealDto & { overrideReason?: string },
    actor: AuthContext,
  ) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const mealDate = this.dateOnly(dto.mealDate ?? this.todayIso());
    const serving = await this.prisma.$transaction(async (tx) => {
      const enrollment = await this.resolveServingEnrollment(
        tx,
        dto,
        actor.tenantId,
        mealDate,
      );
      if (enrollment?.status === CanteenEnrollmentStatus.CANCELLED) {
        throw new ConflictException('Cancelled enrollments cannot be served');
      }
      const mealType = dto.mealType ?? enrollment?.mealPlan.mealType ?? 'LUNCH';
      const preventDuplicate =
        dto.preventDuplicate ??
        enrollment?.mealPlan.duplicateServingPrevention ??
        true;
      if (preventDuplicate) {
        const duplicate = await tx.canteenMealServing.findFirst({
          where: {
            tenantId: actor.tenantId,
            studentId: dto.studentId,
            mealDate,
            mealType,
            status: CanteenMealServingStatus.SERVED,
          },
        });
        if (duplicate) {
          throw new ConflictException(
            'Meal already served for this student, meal, and date',
          );
        }
      }
      const dietaryWarning = await this.buildDietaryWarning(
        tx,
        actor.tenantId,
        dto.studentId,
      );

      if (dietaryWarning && !dto.overrideReason) {
        throw new BadRequestException({
          message: 'Dietary warning detected. Override reason required.',
          dietaryWarning,
        });
      }

      if (
        dietaryWarning &&
        dto.overrideReason &&
        !actor.permissions.includes('canteen:serving:override')
      ) {
        throw new ForbiddenException(
          'You do not have permission to override dietary warnings',
        );
      }

      return tx.canteenMealServing.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
          enrollmentId: enrollment?.id ?? dto.enrollmentId ?? null,
          mealPlanId: enrollment?.mealPlanId ?? dto.mealPlanId ?? null,
          mealType,
          mealDate,
          servedByUserId: actor.userId,
          dietaryWarning,
          overrideReason: dto.overrideReason ?? null,
          overriddenById: dto.overrideReason ? actor.userId : null,
          notes: dto.notes ?? null,
        },
      });
    });
    await this.audit(
      actor,
      'serve',
      'canteen_meal_serving',
      serving.id,
      null,
      serving,
    );
    return serving;
  }

  async reverseWalletTransaction(
    id: string,
    dto: CanteenReversalDto,
    actor: AuthContext,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const original = await tx.canteenWalletTransaction.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!original) throw new NotFoundException('Transaction not found');
      if (original.reversalOfId || original.correctionOfId) {
        throw new ConflictException('Cannot reverse a reversal or correction');
      }
      const existingReversal = await tx.canteenWalletTransaction.findFirst({
        where: { tenantId: actor.tenantId, reversalOfId: id },
      });
      if (existingReversal)
        throw new ConflictException('Transaction already reversed');

      const wallet = await tx.canteenWallet.findUniqueOrThrow({
        where: { id: original.walletId },
      });

      // Calculate reversal amount (opposite of original)
      const reversalAmount = original.amount.mul(-1);
      const newBalance = wallet.balance.add(reversalAmount);
      if (newBalance.lt(0)) {
        throw new ConflictException(
          'Wallet reversal cannot make balance negative',
        );
      }

      const updatedWallet = await tx.canteenWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const reversal = await tx.canteenWalletTransaction.create({
        data: {
          tenantId: actor.tenantId,
          walletId: wallet.id,
          studentId: original.studentId,
          type: reversalAmount.gt(0)
            ? CanteenWalletTransactionType.TOP_UP
            : CanteenWalletTransactionType.DEDUCTION,
          source: CanteenWalletTransactionSource.CORRECTION,
          amount: reversalAmount.abs(),
          balanceAfter: newBalance,
          reversalOfId: id,
          reason: dto.reason,
          createdByUserId: actor.userId,
        },
      });

      // Accounting posting for reversal
      if (original.source === CanteenWalletTransactionSource.POS_SALE) {
        await this.accountingPostingService.postCanteenReversal(
          {
            tenantId: actor.tenantId,
            originalTransactionId: original.id,
            reversalTransactionId: reversal.id,
            amount: original.amount,
            reason: dto.reason,
          },
          actor,
          tx,
        );
      }

      return { wallet: updatedWallet, transaction: reversal };
    });

    await this.audit(
      actor,
      'reverse',
      'canteen_wallet_transaction',
      id,
      null,
      result.transaction,
    );
    return result;
  }

  async correctWalletTransaction(
    id: string,
    dto: CanteenCorrectionDto,
    actor: AuthContext,
  ) {
    // Correction is essentially a reversal + a new transaction, or just an adjustment movement
    // Here we implement it as an adjustment movement linked to the original
    const result = await this.prisma.$transaction(async (tx) => {
      const original = await tx.canteenWalletTransaction.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!original) throw new NotFoundException('Transaction not found');

      const wallet = await tx.canteenWallet.findUniqueOrThrow({
        where: { id: original.walletId },
      });

      const adjustmentAmount = new Prisma.Decimal(dto.amount).sub(
        original.amount,
      );
      const newBalance = wallet.balance.add(adjustmentAmount);
      if (newBalance.lt(0)) {
        throw new ConflictException(
          'Wallet correction cannot make balance negative',
        );
      }

      const updatedWallet = await tx.canteenWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const correction = await tx.canteenWalletTransaction.create({
        data: {
          tenantId: actor.tenantId,
          walletId: wallet.id,
          studentId: original.studentId,
          type: adjustmentAmount.gt(0)
            ? CanteenWalletTransactionType.TOP_UP
            : CanteenWalletTransactionType.DEDUCTION,
          source: CanteenWalletTransactionSource.CORRECTION,
          amount: adjustmentAmount.abs(),
          balanceAfter: newBalance,
          correctionOfId: id,
          reason: dto.reason,
          createdByUserId: actor.userId,
        },
      });

      return { wallet: updatedWallet, transaction: correction };
    });

    await this.audit(
      actor,
      'correct',
      'canteen_wallet_transaction',
      id,
      null,
      result.transaction,
    );
    return result;
  }

  async listDailyServings(actor: AuthContext, options: ListServingsQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const mealDate = this.dateOnly(options.date ?? this.todayIso());
    const where: Prisma.CanteenMealServingWhereInput = {
      tenantId: actor.tenantId,
      mealDate,
      ...(options.mealType ? { mealType: options.mealType } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenMealServing.findMany({
        where,
        include: { student: true, mealPlan: true },
        orderBy: [{ servedAt: 'desc' }],
        skip,
        take,
      }),
      this.prisma.canteenMealServing.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async getOrCreateWallet(studentId: string, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, studentId);
    const wallet = await this.prisma.$transaction((tx) =>
      this.getOrCreateWalletInTx(tx, actor.tenantId, studentId),
    );
    await this.audit(actor, 'ensure', 'canteen_wallet', wallet.id, null, {
      studentId,
    });
    return wallet;
  }

  async walletBalance(studentId: string, actor: AuthContext) {
    const wallet = await this.getOrCreateWallet(studentId, actor);
    return {
      walletId: wallet.id,
      studentId,
      balance: wallet.balance,
      lowBalanceThreshold: wallet.lowBalanceThreshold,
    };
  }

  async topUpWallet(
    studentId: string,
    dto: TopUpCanteenWalletDto,
    actor: AuthContext,
  ) {
    await this.ensureStudent(actor.tenantId, studentId);
    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existingTransaction =
          await tx.canteenWalletTransaction.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
            include: { wallet: true },
          });

        if (existingTransaction) {
          if (
            existingTransaction.tenantId !== actor.tenantId ||
            existingTransaction.studentId !== studentId
          ) {
            throw new ConflictException('Duplicate wallet request key');
          }

          return {
            wallet: existingTransaction.wallet,
            transaction: existingTransaction,
          };
        }
      }

      const wallet = await this.getOrCreateWalletInTx(
        tx,
        actor.tenantId,
        studentId,
      );
      const updated = await tx.canteenWallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: new Prisma.Decimal(dto.amount) },
          ...(dto.lowBalanceThreshold !== undefined
            ? {
                lowBalanceThreshold: new Prisma.Decimal(
                  dto.lowBalanceThreshold,
                ),
              }
            : {}),
        },
      });
      const transaction = await tx.canteenWalletTransaction.create({
        data: {
          tenantId: actor.tenantId,
          walletId: wallet.id,
          studentId,
          type: CanteenWalletTransactionType.TOP_UP,
          source: CanteenWalletTransactionSource.MANUAL,
          amount: new Prisma.Decimal(dto.amount),
          balanceAfter: updated.balance,
          referenceType: 'manual_top_up',
          referenceId: dto.idempotencyKey ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
          note: dto.note ?? null,
          createdByUserId: actor.userId,
        },
      });

      await this.accountingPostingService.postCanteenTopUp(
        {
          tenantId: actor.tenantId,
          walletId: wallet.id,
          transactionId: transaction.id,
          studentId,
          amount: new Prisma.Decimal(dto.amount),
          paymentMethod: 'CASH', // Assuming cash for manual top-up or add to DTO
          note: dto.note,
        },
        actor,
        tx,
      );

      return { wallet: updated, transaction };
    });
    await this.audit(
      actor,
      'top_up',
      'canteen_wallet',
      result.wallet.id,
      null,
      result.transaction,
    );
    return result;
  }

  async transactionHistory(
    studentId: string,
    actor: AuthContext,
    options: PaginationQuery = {},
  ) {
    const { skip, take, page } = this.pagination(options);
    const wallet = await this.getWalletByStudent(studentId, actor.tenantId);
    const where = { tenantId: actor.tenantId, walletId: wallet.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenWalletTransaction.findMany({
        where,
        orderBy: [{ transactionDate: 'desc' }],
        skip,
        take,
      }),
      this.prisma.canteenWalletTransaction.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async createPosSale(dto: CreateCanteenPosSaleDto, actor: AuthContext) {
    if (!dto.items?.length) {
      throw new BadRequestException('At least one sale item is required');
    }

    if (dto.idempotencyKey) {
      const existing = await this.prisma.canteenPosSale.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true },
      });
      if (existing) {
        if (existing.tenantId !== actor.tenantId) {
          throw new ConflictException('Duplicate POS request key');
        }

        return existing;
      }
    }

    const paymentMethod = this.parsePaymentMethod(dto.paymentMethod);
    if (paymentMethod === CanteenPaymentMethod.WALLET && !dto.studentId) {
      throw new BadRequestException('studentId is required for wallet payment');
    }
    if (dto.studentId) {
      await this.ensureStudent(actor.tenantId, dto.studentId);
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      const { items, subtotal } = await this.resolveSaleItems(
        tx,
        actor.tenantId,
        dto.items,
      );
      await this.enforceSpendingControls(
        tx,
        actor.tenantId,
        dto.studentId,
        items,
        subtotal,
      );
      const wallet =
        paymentMethod === CanteenPaymentMethod.WALLET && dto.studentId
          ? await this.getOrCreateWalletInTx(tx, actor.tenantId, dto.studentId)
          : null;
      return tx.canteenPosSale.create({
        data: {
          tenantId: actor.tenantId,
          studentId: dto.studentId ?? null,
          staffId: dto.staffId ?? null,
          walletId: wallet?.id ?? null,
          paymentMethod,
          subtotal,
          totalAmount: subtotal,
          createdByUserId: actor.userId,
          notes: dto.notes ?? null,
          idempotencyKey: dto.idempotencyKey ?? null,
          items: {
            create: items.map((item) => ({
              tenantId: actor.tenantId,
              menuItemId: item.id,
              itemName: item.name,
              category: item.category,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });
    });
    await this.audit(actor, 'create', 'canteen_pos_sale', sale.id, null, sale);
    return sale;
  }

  async completePosSale(
    id: string,
    dto: CompleteCanteenPosSaleDto,
    actor: AuthContext,
  ) {
    const sale = await this.prisma.$transaction(async (tx) => {
      const existing = await this.requirePosSale(tx, actor.tenantId, id);
      if (existing.status === CanteenPosSaleStatus.COMPLETED) {
        return tx.canteenPosSale.findUniqueOrThrow({
          where: { id },
          include: { items: true },
        });
      }
      if (existing.status !== CanteenPosSaleStatus.DRAFT) {
        throw new ConflictException('Only draft POS sales can be completed');
      }

      const dietaryWarning = existing.studentId
        ? await this.buildPosSaleDietaryWarning(
            tx,
            actor.tenantId,
            existing.studentId,
            id,
          )
        : null;
      if (dietaryWarning && !dto.overrideReason) {
        throw new BadRequestException({
          message: 'Dietary warning detected. Override reason required.',
          dietaryWarning,
        });
      }
      if (
        dietaryWarning &&
        dto.overrideReason &&
        !actor.permissions.includes('canteen:serving:override')
      ) {
        throw new ForbiddenException(
          'You do not have permission to override dietary warnings',
        );
      }

      if (existing.paymentMethod === CanteenPaymentMethod.WALLET) {
        if (!existing.walletId || !existing.studentId) {
          throw new ConflictException('Wallet sale is missing wallet linkage');
        }
        const update = await tx.canteenWallet.updateMany({
          where: {
            tenantId: actor.tenantId,
            id: existing.walletId,
            balance: { gte: existing.totalAmount },
          },
          data: { balance: { decrement: existing.totalAmount } },
        });
        if (update.count !== 1) {
          throw new ConflictException('Wallet balance cannot go negative');
        }
        const wallet = await tx.canteenWallet.findUniqueOrThrow({
          where: { id: existing.walletId },
        });
        await tx.canteenWalletTransaction.create({
          data: {
            tenantId: actor.tenantId,
            walletId: wallet.id,
            studentId: existing.studentId,
            type: CanteenWalletTransactionType.DEDUCTION,
            source: CanteenWalletTransactionSource.POS_SALE,
            amount: existing.totalAmount,
            balanceAfter: wallet.balance,
            referenceType: 'canteen_pos_sale',
            referenceId: id,
            note: dto.note ?? null,
            createdByUserId: actor.userId,
          },
        });
      }

      await this.accountingPostingService.postCanteenSale(
        {
          tenantId: actor.tenantId,
          saleId: id,
          studentId: existing.studentId,
          walletId: existing.walletId,
          amount: existing.totalAmount,
          paymentMethod: existing.paymentMethod,
          note: dto.note ?? existing.notes,
        },
        actor,
        tx,
      );
      if (dietaryWarning && dto.overrideReason) {
        await tx.auditLog.create({
          data: {
            action: 'override_dietary_warning',
            resource: 'canteen_pos_sale',
            resourceId: id,
            tenantId: actor.tenantId,
            userId: actor.userId,
            after: {
              dietaryWarning,
              overrideReason: dto.overrideReason,
              studentId: existing.studentId,
            },
          },
        });
      }
      return tx.canteenPosSale.update({
        where: { id },
        data: {
          status: CanteenPosSaleStatus.COMPLETED,
          completedAt: new Date(),
          receiptNumber: await this.generateReceiptNumber(tx, actor.tenantId),
        },
        include: { items: true },
      });
    });
    await this.audit(actor, 'complete', 'canteen_pos_sale', id, null, sale);
    return sale;
  }

  async cancelPosSale(id: string, actor: AuthContext) {
    const existing = await this.requirePosSale(this.prisma, actor.tenantId, id);
    if (existing.status === CanteenPosSaleStatus.COMPLETED) {
      throw new ConflictException(
        'Completed POS sales require reversal/correction workflow later',
      );
    }
    const updated = await this.prisma.canteenPosSale.update({
      where: { id },
      data: {
        status: CanteenPosSaleStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });
    await this.audit(
      actor,
      'cancel',
      'canteen_pos_sale',
      id,
      existing,
      updated,
    );
    return updated;
  }

  async getPosReceipt(id: string, actor: AuthContext) {
    const sale = await this.prisma.canteenPosSale.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        tenant: true,
        items: true,
        student: true,
        staff: true,
        wallet: true,
        createdBy: true,
      },
    });

    if (!sale) {
      throw new NotFoundException('Canteen POS sale not found in this tenant');
    }

    if (sale.status !== CanteenPosSaleStatus.COMPLETED) {
      throw new ConflictException('Only completed POS sales have receipts');
    }

    return {
      school: {
        name: sale.tenant.name,
        panNumber: sale.tenant.panNumber,
      },
      receiptNumber: sale.receiptNumber,
      saleId: sale.id,
      saleDate: sale.completedAt ?? sale.saleDate,
      paymentMethod: sale.paymentMethod,
      cashier: sale.createdBy?.email ?? null,
      student: sale.student
        ? {
            id: sale.student.id,
            studentSystemId: sale.student.studentSystemId,
            name: `${sale.student.firstNameEn} ${sale.student.lastNameEn}`,
          }
        : null,
      staff: sale.staff
        ? {
            id: sale.staff.id,
            employeeId: sale.staff.employeeId,
            name: `${sale.staff.firstName} ${sale.staff.lastName}`,
          }
        : null,
      items: sale.items.map((item) => ({
        name: item.itemName,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount,
      totalAmount: sale.totalAmount,
      walletBalanceAfter: sale.wallet?.balance ?? null,
    };
  }

  async getPosReceiptPdf(id: string, actor: AuthContext) {
    const receipt = await this.getPosReceipt(id, actor);
    const pdf = buildSimplePdf(
      [
        'CANTEEN POS RECEIPT',
        `School: ${receipt.school.name}`,
        receipt.school.panNumber ? `PAN: ${receipt.school.panNumber}` : '',
        `Receipt No: ${receipt.receiptNumber ?? receipt.saleId}`,
        `Sale ID: ${receipt.saleId}`,
        `Date: ${new Date(receipt.saleDate).toISOString()}`,
        `Payment: ${receipt.paymentMethod}`,
        `Cashier: ${receipt.cashier ?? 'N/A'}`,
        receipt.student
          ? `Student: ${receipt.student.name} (${receipt.student.studentSystemId ?? receipt.student.id})`
          : '',
        receipt.staff
          ? `Staff: ${receipt.staff.name} (${receipt.staff.employeeId ?? receipt.staff.id})`
          : '',
        'Items',
        ...receipt.items.map(
          (item) =>
            `${item.quantity} x ${item.name} @ ${item.unitPrice.toString()} = ${item.lineTotal.toString()}`,
        ),
        `Subtotal: NPR ${receipt.subtotal.toString()}`,
        `Discount: NPR ${receipt.discountAmount.toString()}`,
        `Total: NPR ${receipt.totalAmount.toString()}`,
        receipt.walletBalanceAfter
          ? `Wallet balance after sale: NPR ${receipt.walletBalanceAfter.toString()}`
          : '',
        `Generated: ${new Date().toISOString()}`,
      ].filter(Boolean),
    );

    await this.audit(actor, 'reprint_receipt', 'canteen_pos_sale', id, null, {
      receiptNumber: receipt.receiptNumber,
      saleId: receipt.saleId,
    });

    return pdf;
  }

  async listPosSales(actor: AuthContext, options: ListPosSalesQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const range = this.dateRange(options);
    const where: Prisma.CanteenPosSaleWhereInput = {
      tenantId: actor.tenantId,
      ...(options.status
        ? { status: this.parseSaleStatus(options.status) }
        : {}),
      ...(options.studentId ? { studentId: options.studentId } : {}),
      saleDate: { gte: range.from, lte: range.to },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenPosSale.findMany({
        where,
        include: { items: true, student: true },
        orderBy: [{ saleDate: 'desc' }],
        skip,
        take,
      }),
      this.prisma.canteenPosSale.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async upsertSpendingControl(
    dto: UpsertCanteenSpendingControlDto,
    actor: AuthContext,
  ) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const control = await this.prisma.canteenSpendingControl.upsert({
      where: {
        tenantId_studentId: {
          tenantId: actor.tenantId,
          studentId: dto.studentId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        studentId: dto.studentId,
        dailySpendingLimit:
          dto.dailySpendingLimit === undefined
            ? null
            : new Prisma.Decimal(dto.dailySpendingLimit),
        blockedCategories: dto.blockedCategories ?? [],
        blockedMenuItemIds: dto.blockedMenuItemIds ?? [],
        lowBalanceThreshold:
          dto.lowBalanceThreshold === undefined
            ? null
            : new Prisma.Decimal(dto.lowBalanceThreshold),
        isActive: dto.isActive ?? true,
      },
      update: {
        dailySpendingLimit:
          dto.dailySpendingLimit === undefined
            ? null
            : new Prisma.Decimal(dto.dailySpendingLimit),
        blockedCategories: dto.blockedCategories ?? [],
        blockedMenuItemIds: dto.blockedMenuItemIds ?? [],
        lowBalanceThreshold:
          dto.lowBalanceThreshold === undefined
            ? null
            : new Prisma.Decimal(dto.lowBalanceThreshold),
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(
      actor,
      'upsert',
      'canteen_spending_control',
      control.id,
      null,
      control,
    );
    return control;
  }

  async getSpendingControl(studentId: string, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, studentId);
    return this.prisma.canteenSpendingControl.findFirst({
      where: { tenantId: actor.tenantId, studentId },
    });
  }

  async dailyMealCountReport(actor: AuthContext, date = this.todayIso()) {
    return this.prisma.canteenMealServing.groupBy({
      by: ['mealType', 'status'],
      where: { tenantId: actor.tenantId, mealDate: this.dateOnly(date) },
      _count: { _all: true },
      orderBy: [{ mealType: 'asc' }],
    });
  }

  async itemWiseSalesReport(actor: AuthContext, range: DateRangeQuery = {}) {
    const { from, to } = this.dateRange(range);
    return this.prisma.canteenPosSaleItem.groupBy({
      by: ['menuItemId', 'itemName', 'category'],
      where: {
        tenantId: actor.tenantId,
        sale: {
          tenantId: actor.tenantId,
          status: CanteenPosSaleStatus.COMPLETED,
          saleDate: { gte: from, lte: to },
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: [{ _sum: { lineTotal: 'desc' } }],
    });
  }

  async lowBalanceWalletList(actor: AuthContext) {
    const wallets = await this.prisma.canteenWallet.findMany({
      where: { tenantId: actor.tenantId },
      include: { student: true },
      orderBy: [{ balance: 'asc' }],
      take: 200,
    });
    return wallets.filter((wallet) =>
      wallet.balance.lte(wallet.lowBalanceThreshold),
    );
  }

  async studentSpendingSummary(
    actor: AuthContext,
    options: StudentDateRangeQuery = {},
  ) {
    const { from, to } = this.dateRange(options);
    const summaries = await this.prisma.canteenPosSale.groupBy({
      by: ['studentId'],
      where: {
        tenantId: actor.tenantId,
        status: CanteenPosSaleStatus.COMPLETED,
        saleDate: { gte: from, lte: to },
        ...(options.studentId ? { studentId: options.studentId } : {}),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: [{ _sum: { totalAmount: 'desc' } }],
    });
    const studentIds = summaries
      .map((summary) => summary.studentId)
      .filter((studentId): studentId is string => Boolean(studentId));
    const students = await this.prisma.student.findMany({
      where: { tenantId: actor.tenantId, id: { in: studentIds } },
    });
    const studentsById = new Map(
      students.map((student) => [student.id, student]),
    );
    return summaries.map((summary) => ({
      studentId: summary.studentId,
      student: summary.studentId
        ? (studentsById.get(summary.studentId) ?? null)
        : null,
      saleCount: summary._count._all,
      totalSpent: summary._sum.totalAmount ?? new Prisma.Decimal(0),
    }));
  }

  async getStockLedger(
    actor: AuthContext,
    options: { inventoryItemId?: string; from?: string; to?: string } = {},
  ) {
    const { from, to } = this.dateRange({
      from: options.from,
      to: options.to,
    });
    return this.prisma.canteenStockMovement.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(options.inventoryItemId
          ? { inventoryItemId: options.inventoryItemId }
          : {}),
        movementDate: { gte: from, lte: to },
      },
      include: { inventoryItem: true, createdBy: true },
      orderBy: [{ movementDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async resolveSaleItems(
    tx: Tx,
    tenantId: string,
    saleItems: Array<{ menuItemId: string; quantity: number }>,
  ) {
    const items: SaleItem[] = [];
    let subtotal = new Prisma.Decimal(0);
    for (const saleItem of saleItems) {
      const item = await tx.canteenMenuItem.findFirst({
        where: { id: saleItem.menuItemId, tenantId },
      });
      if (!item) {
        throw new NotFoundException(
          'Canteen menu item not found in this tenant',
        );
      }
      if (item.status !== CanteenMenuItemStatus.ACTIVE) {
        throw new ConflictException('Inactive menu items cannot be sold');
      }
      const quantity = new Prisma.Decimal(saleItem.quantity);
      const lineTotal = item.unitPrice.mul(quantity);
      subtotal = subtotal.add(lineTotal);
      items.push({
        id: item.id,
        name: item.name,
        category: item.category,
        unitPrice: item.unitPrice,
        quantity: saleItem.quantity,
        lineTotal,
      });
    }
    return { items, subtotal };
  }

  private async enforceSpendingControls(
    tx: Tx,
    tenantId: string,
    studentId: string | undefined,
    items: SaleItem[],
    total: Prisma.Decimal,
  ) {
    if (!studentId) return;
    const control = await tx.canteenSpendingControl.findFirst({
      where: { tenantId, studentId, isActive: true },
    });
    if (!control) return;
    const blockedCategories = new Set(control.blockedCategories);
    const blockedItemIds = new Set(control.blockedMenuItemIds);
    const blocked = items.find(
      (item) =>
        blockedCategories.has(item.category) || blockedItemIds.has(item.id),
    );
    if (blocked) {
      throw new ConflictException(
        `Purchase blocked by spending controls for ${blocked.name}`,
      );
    }
    if (control.dailySpendingLimit) {
      const { from, to } = this.dateRange();
      const spent = await tx.canteenPosSale.aggregate({
        where: {
          tenantId,
          studentId,
          status: CanteenPosSaleStatus.COMPLETED,
          saleDate: { gte: from, lte: to },
        },
        _sum: { totalAmount: true },
      });
      const current = spent._sum.totalAmount ?? new Prisma.Decimal(0);
      if (current.add(total).gt(control.dailySpendingLimit)) {
        throw new ConflictException('Daily spending limit exceeded');
      }
    }
  }

  private resolveServingEnrollment(
    tx: Tx,
    dto: ServeCanteenMealDto,
    tenantId: string,
    mealDate: Date,
  ) {
    if (dto.enrollmentId) {
      return tx.canteenStudentEnrollment.findFirst({
        where: {
          tenantId,
          id: dto.enrollmentId,
          studentId: dto.studentId,
        },
        include: { mealPlan: true },
      });
    }
    return tx.canteenStudentEnrollment.findFirst({
      where: {
        tenantId,
        studentId: dto.studentId,
        status: CanteenEnrollmentStatus.ACTIVE,
        startsOn: { lte: mealDate },
        OR: [{ endsOn: null }, { endsOn: { gte: mealDate } }],
        ...(dto.mealType ? { mealPlan: { mealType: dto.mealType } } : {}),
      },
      include: { mealPlan: true },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  private async buildDietaryWarning(
    tx: Tx,
    tenantId: string,
    studentId: string,
  ) {
    const student = await tx.student.findFirst({
      where: { tenantId, id: studentId },
      select: { severeAllergies: true, medicalConditions: true },
    });
    const warnings = [
      student?.severeAllergies,
      student?.medicalConditions,
    ].filter(Boolean);
    return warnings.length > 0 ? warnings.join(' | ') : null;
  }

  private async buildPosSaleDietaryWarning(
    tx: Tx,
    tenantId: string,
    studentId: string,
    saleId: string,
  ) {
    const [student, saleItems] = await Promise.all([
      tx.student.findFirst({
        where: { tenantId, id: studentId },
        select: { severeAllergies: true, medicalConditions: true },
      }),
      tx.canteenPosSaleItem.findMany({
        where: { tenantId, saleId },
        include: { menuItem: true },
      }),
    ]);

    const studentWarnings = [
      student?.severeAllergies
        ? `Severe allergies: ${student.severeAllergies}`
        : null,
      student?.medicalConditions
        ? `Medical conditions: ${student.medicalConditions}`
        : null,
    ].filter((warning): warning is string => Boolean(warning));

    if (studentWarnings.length === 0) {
      return null;
    }

    const itemAllergens = uniqueStrings(
      saleItems.flatMap((item) => item.menuItem.allergenTags ?? []),
    );

    return [
      ...studentWarnings,
      itemAllergens.length > 0
        ? `Sale item allergen tags: ${itemAllergens.join(', ')}`
        : 'Sale item allergen tags are not configured',
    ].join(' | ');
  }

  private getOrCreateWalletInTx(tx: Tx, tenantId: string, studentId: string) {
    return tx.canteenWallet.upsert({
      where: { tenantId_studentId: { tenantId, studentId } },
      create: { tenantId, studentId },
      update: {},
    });
  }

  private async getWalletByStudent(studentId: string, tenantId: string) {
    const wallet = await this.prisma.canteenWallet.findFirst({
      where: { tenantId, studentId },
    });
    if (!wallet) {
      throw new NotFoundException('Canteen wallet not found for this student');
    }
    return wallet;
  }

  private async ensureStudent(tenantId: string, studentId: string) {
    const student = await this.prisma.student.findFirst({
      where: { tenantId, id: studentId },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException('Student not found in this tenant');
    }
  }

  private async requireMenuItem(tenantId: string, id: string) {
    const item = await this.prisma.canteenMenuItem.findFirst({
      where: { tenantId, id },
    });
    if (!item) {
      throw new NotFoundException('Canteen menu item not found in this tenant');
    }
    return item;
  }

  private async requireMealPlan(tenantId: string, id: string) {
    const plan = await this.prisma.canteenMealPlan.findFirst({
      where: { tenantId, id },
    });
    if (!plan) {
      throw new NotFoundException('Canteen meal plan not found in this tenant');
    }
    return plan;
  }

  private async requireEnrollment(tenantId: string, id: string) {
    const enrollment = await this.prisma.canteenStudentEnrollment.findFirst({
      where: { tenantId, id },
    });
    if (!enrollment) {
      throw new NotFoundException(
        'Canteen enrollment not found in this tenant',
      );
    }
    return enrollment;
  }

  private async requireSupplier(tenantId: string, id: string) {
    const supplier = await this.prisma.canteenSupplier.findFirst({
      where: { tenantId, id, isActive: true },
    });

    if (!supplier) {
      throw new NotFoundException('Canteen supplier not found in this tenant');
    }

    return supplier;
  }

  private async requirePosSale(
    tx: Tx | PrismaService,
    tenantId: string,
    id: string,
  ) {
    const sale = await tx.canteenPosSale.findFirst({
      where: { tenantId, id },
    });
    if (!sale) {
      throw new NotFoundException('Canteen POS sale not found in this tenant');
    }
    return sale;
  }

  private async assertNoDuplicateMealPlanEnrollment(
    tx: Tx,
    input: {
      tenantId: string;
      studentId: string;
      mealPlanId: string;
      startsOn: Date;
      endsOn: Date | null;
    },
  ) {
    const existing = await tx.canteenStudentEnrollment.findFirst({
      where: {
        tenantId: input.tenantId,
        studentId: input.studentId,
        mealPlanId: input.mealPlanId,
        status: {
          in: [CanteenEnrollmentStatus.ACTIVE, CanteenEnrollmentStatus.PAUSED],
        },
        startsOn: { lte: input.endsOn ?? input.startsOn },
        OR: [{ endsOn: null }, { endsOn: { gte: input.startsOn } }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Student already has an overlapping active meal plan enrollment',
      );
    }
  }

  private audit(
    actor: AuthContext,
    action: string,
    resource: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.auditService.record({
      action,
      resource,
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId,
      before: before ?? undefined,
      after: after ?? undefined,
    });
  }

  private async generateReceiptNumber(tx: Tx, tenantId: string) {
    const year = new Date().getUTCFullYear();
    const count = await tx.canteenPosSale.count({
      where: {
        tenantId,
        status: CanteenPosSaleStatus.COMPLETED,
        completedAt: {
          gte: new Date(`${year}-01-01`),
          lte: new Date(`${year}-12-31`),
        },
      },
    });
    return `POS-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private parseMenuItemStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!Object.values(CanteenMenuItemStatus).includes(normalized as never)) {
      throw new BadRequestException(`Invalid menu item status: ${status}`);
    }
    return normalized as CanteenMenuItemStatus;
  }

  private parseMealPlanStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!Object.values(CanteenMealPlanStatus).includes(normalized as never)) {
      throw new BadRequestException(`Invalid meal plan status: ${status}`);
    }
    return normalized as CanteenMealPlanStatus;
  }

  async createSupplier(dto: CreateCanteenSupplierDto, actor: AuthContext) {
    const supplier = await this.prisma.canteenSupplier.create({
      data: {
        tenantId: actor.tenantId,
        ...dto,
      },
    });
    await this.audit(
      actor,
      'create',
      'canteen_supplier',
      supplier.id,
      null,
      supplier,
    );
    return supplier;
  }

  async listSuppliers(actor: AuthContext, options: PaginationQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const where = { tenantId: actor.tenantId, isActive: true };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenSupplier.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.canteenSupplier.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async createInventoryItem(
    dto: CreateCanteenInventoryItemDto,
    actor: AuthContext,
  ) {
    if (dto.defaultSupplierId) {
      await this.requireSupplier(actor.tenantId, dto.defaultSupplierId);
    }

    const item = await this.prisma.canteenInventoryItem.create({
      data: {
        tenantId: actor.tenantId,
        name: dto.name,
        sku: dto.sku ?? null,
        category: dto.category,
        unit: dto.unit,
        minStockLevel: dto.minStockLevel
          ? new Prisma.Decimal(dto.minStockLevel)
          : new Prisma.Decimal(0),
        unitCost: dto.unitCost
          ? new Prisma.Decimal(dto.unitCost)
          : new Prisma.Decimal(0),
        defaultSupplierId: dto.defaultSupplierId ?? null,
      },
    });
    await this.audit(
      actor,
      'create',
      'canteen_inventory_item',
      item.id,
      null,
      item,
    );
    return item;
  }

  async listInventoryItems(
    actor: AuthContext,
    options: PaginationQuery & { category?: string } = {},
  ) {
    const { skip, take, page } = this.pagination(options);
    const where = {
      tenantId: actor.tenantId,
      isActive: true,
      ...(options.category ? { category: options.category } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.canteenInventoryItem.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.canteenInventoryItem.count({ where }),
    ]);
    return { items, meta: { page, limit: take, total } };
  }

  async createPurchaseBill(
    dto: CreateCanteenPurchaseBillDto,
    actor: AuthContext,
  ) {
    const bill = await this.prisma.$transaction(async (tx) => {
      const supplier = await tx.canteenSupplier.findFirst({
        where: {
          id: dto.supplierId,
          tenantId: actor.tenantId,
          isActive: true,
        },
      });

      if (!supplier) {
        throw new NotFoundException(
          'Canteen supplier not found in this tenant',
        );
      }

      let totalAmount = new Prisma.Decimal(0);
      const itemsData: PurchaseBillItemData[] = [];

      for (const item of dto.items) {
        const inventoryItem = await tx.canteenInventoryItem.findFirst({
          where: {
            id: item.inventoryItemId,
            tenantId: actor.tenantId,
            isActive: true,
          },
        });

        if (!inventoryItem) {
          throw new NotFoundException(
            'Canteen inventory item not found in this tenant',
          );
        }

        const lineTotal = new Prisma.Decimal(item.quantity).mul(
          new Prisma.Decimal(item.unitCost),
        );
        totalAmount = totalAmount.add(lineTotal);
        itemsData.push({
          tenantId: actor.tenantId,
          inventoryItemId: item.inventoryItemId,
          quantity: new Prisma.Decimal(item.quantity),
          unitCost: new Prisma.Decimal(item.unitCost),
          lineTotal,
          expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
          batchNumber: item.batchNumber ?? null,
        });
      }

      const netAmount = totalAmount
        .add(new Prisma.Decimal(dto.taxAmount ?? 0))
        .sub(new Prisma.Decimal(dto.discountAmount ?? 0));

      const createdBill = await tx.canteenPurchaseBill.create({
        data: {
          tenantId: actor.tenantId,
          supplierId: dto.supplierId,
          billNumber: dto.billNumber,
          billDate: new Date(dto.billDate),
          totalAmount,
          taxAmount: new Prisma.Decimal(dto.taxAmount ?? 0),
          discountAmount: new Prisma.Decimal(dto.discountAmount ?? 0),
          netAmount,
          notes: dto.notes ?? null,
          createdByUserId: actor.userId,
          items: {
            create: itemsData,
          },
        },
        include: { items: true },
      });

      await this.accountingPostingService.postCanteenPurchase(
        {
          tenantId: actor.tenantId,
          purchaseBillId: createdBill.id,
          supplierId: createdBill.supplierId,
          amount: totalAmount,
          taxAmount: createdBill.taxAmount,
          discountAmount: createdBill.discountAmount,
          netAmount: createdBill.netAmount,
          note: createdBill.notes,
          entryDate: createdBill.billDate,
        },
        actor,
        tx,
      );

      // Update stock levels and record movements
      for (const item of itemsData) {
        const invItem = await tx.canteenInventoryItem.update({
          where: { id: item.inventoryItemId },
          data: {
            currentStock: { increment: item.quantity },
            unitCost: item.unitCost, // Update last purchase cost
          },
        });

        await tx.canteenStockMovement.create({
          data: {
            tenantId: actor.tenantId,
            inventoryItemId: item.inventoryItemId,
            type: 'IN',
            quantity: item.quantity,
            balanceAfter: invItem.currentStock,
            referenceType: 'PURCHASE',
            referenceId: createdBill.id,
            movementDate: new Date(),
            createdByUserId: actor.userId,
          },
        });
      }

      return createdBill;
    });

    await this.audit(
      actor,
      'create',
      'canteen_purchase_bill',
      bill.id,
      null,
      bill,
    );
    return bill;
  }

  async recordWastage(dto: CreateCanteenWastageDto, actor: AuthContext) {
    const wastage = await this.prisma.$transaction(async (tx) => {
      const item = await tx.canteenInventoryItem.findFirstOrThrow({
        where: { id: dto.inventoryItemId, tenantId: actor.tenantId },
      });

      const quantity = new Prisma.Decimal(dto.quantity);
      if (item.currentStock.lt(quantity)) {
        throw new ConflictException('Wastage cannot make stock negative');
      }

      const totalCost = item.unitCost.mul(quantity);

      const createdWastage = await tx.canteenWastage.create({
        data: {
          tenantId: actor.tenantId,
          inventoryItemId: dto.inventoryItemId,
          quantity,
          unitCost: item.unitCost,
          totalCost,
          reason: dto.reason,
          wastageDate: new Date(dto.wastageDate),
          notes: dto.notes ?? null,
          createdByUserId: actor.userId,
        },
      });

      const stockUpdate = await tx.canteenInventoryItem.updateMany({
        where: {
          id: item.id,
          tenantId: actor.tenantId,
          currentStock: { gte: quantity },
        },
        data: { currentStock: { decrement: quantity } },
      });

      if (stockUpdate.count !== 1) {
        throw new ConflictException('Wastage cannot make stock negative');
      }

      const updatedItem = await tx.canteenInventoryItem.findUniqueOrThrow({
        where: { id: item.id },
      });

      await tx.canteenStockMovement.create({
        data: {
          tenantId: actor.tenantId,
          inventoryItemId: item.id,
          type: 'OUT',
          quantity,
          balanceAfter: updatedItem.currentStock,
          referenceType: 'WASTAGE',
          referenceId: createdWastage.id,
          reason: dto.reason,
          movementDate: new Date(),
          createdByUserId: actor.userId,
        },
      });

      return createdWastage;
    });

    await this.audit(
      actor,
      'record_wastage',
      'canteen_inventory_item',
      dto.inventoryItemId,
      null,
      wastage,
    );
    return wastage;
  }

  async manualStockAdjustment(
    dto: ManualStockAdjustmentDto,
    actor: AuthContext,
  ) {
    const adjustment = await this.prisma.$transaction(async (tx) => {
      const item = await tx.canteenInventoryItem.findFirstOrThrow({
        where: { id: dto.inventoryItemId, tenantId: actor.tenantId },
      });

      const quantity = new Prisma.Decimal(dto.quantity);
      if (quantity.isZero()) {
        throw new BadRequestException(
          'Stock adjustment quantity cannot be zero',
        );
      }

      const nextStock = item.currentStock.add(quantity);
      if (nextStock.lt(0)) {
        throw new ConflictException(
          'Stock adjustment cannot make stock negative',
        );
      }

      const updatedItem = await tx.canteenInventoryItem.update({
        where: { id: item.id },
        data: { currentStock: nextStock },
      });

      return tx.canteenStockMovement.create({
        data: {
          tenantId: actor.tenantId,
          inventoryItemId: item.id,
          type: quantity.gt(0) ? 'IN' : 'OUT',
          quantity: quantity.abs(),
          balanceAfter: updatedItem.currentStock,
          referenceType: 'MANUAL',
          reason: dto.reason,
          movementDate: new Date(),
          createdByUserId: actor.userId,
        },
      });
    });

    await this.audit(
      actor,
      'adjust_stock',
      'canteen_inventory_item',
      dto.inventoryItemId,
      null,
      adjustment,
    );
    return adjustment;
  }

  private parseEnrollmentStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!Object.values(CanteenEnrollmentStatus).includes(normalized as never)) {
      throw new BadRequestException(`Invalid enrollment status: ${status}`);
    }
    return normalized as CanteenEnrollmentStatus;
  }

  private parseSaleStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!Object.values(CanteenPosSaleStatus).includes(normalized as never)) {
      throw new BadRequestException(`Invalid POS sale status: ${status}`);
    }
    return normalized as CanteenPosSaleStatus;
  }

  private parsePaymentMethod(paymentMethod: string) {
    const normalized = paymentMethod.toUpperCase();
    if (!Object.values(CanteenPaymentMethod).includes(normalized as never)) {
      throw new BadRequestException(`Invalid payment method: ${paymentMethod}`);
    }
    return normalized as CanteenPaymentMethod;
  }

  private pagination(options: PaginationQuery) {
    const page = Math.max(Number(options.page ?? 1), 1);
    const take = Math.min(Math.max(Number(options.limit ?? 50), 1), 100);
    return { page, take, skip: (page - 1) * take };
  }

  private dateRange(options: DateRangeQuery = {}) {
    return {
      from: options.from ? new Date(options.from) : this.startOfDay(new Date()),
      to: options.to ? new Date(options.to) : this.endOfDay(new Date()),
    };
  }

  private dateOnly(input: string) {
    return this.startOfDay(new Date(input));
  }

  private todayIso() {
    return new Date().toISOString().slice(0, 10);
  }

  private startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  }

  private endOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(23, 59, 59, 999);
    return next;
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

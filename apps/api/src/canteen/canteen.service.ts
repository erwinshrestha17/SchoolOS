import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
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

type SqlClient = PrismaService | Prisma.TransactionClient;
type PaginationQuery = { page?: string; limit?: string };
type ListMenuItemsQuery = PaginationQuery & { query?: string; category?: string; status?: string };
type ListMealPlansQuery = PaginationQuery & { status?: string; mealType?: string };
type ListEnrollmentsQuery = PaginationQuery & { studentId?: string; mealPlanId?: string; status?: string };
type ListServingsQuery = PaginationQuery & { date?: string; mealType?: string };
type ListPosSalesQuery = PaginationQuery & { status?: string; studentId?: string; from?: string; to?: string };
type DateRangeQuery = { from?: string; to?: string };
type StudentDateRangeQuery = DateRangeQuery & { studentId?: string };
type Row = Record<string, unknown>;
type WalletRow = Row & { id: string; balance: Prisma.Decimal | number | string; lowBalanceThreshold: Prisma.Decimal | number | string };
type SaleItemRow = Row & { id: string; name: string; category: string; unitPrice: Prisma.Decimal | number | string; status: string; quantity: number; lineTotal: number };

@Injectable()
export class CanteenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createMenuItem(dto: CreateCanteenMenuItemDto, actor: AuthContext) {
    const item = await this.one<Row>(
      this.prisma,
      `INSERT INTO "CanteenMenuItem" ("tenantId", "name", "category", "description", "unitPrice", "isMealItem", "allergenTags")
       VALUES ($1, $2, $3, $4, $5::numeric, $6, $7::text[]) RETURNING *`,
      actor.tenantId,
      dto.name,
      dto.category,
      dto.description ?? null,
      dto.unitPrice,
      dto.isMealItem ?? false,
      dto.allergenTags ?? [],
    );
    await this.audit(actor, 'create', 'canteen_menu_item', String(item.id), null, item);
    return item;
  }

  async listMenuItems(actor: AuthContext, options: ListMenuItemsQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const clauses = ['"tenantId" = $1'];
    const params: unknown[] = [actor.tenantId];
    if (options.query) {
      params.push(`%${options.query}%`);
      clauses.push(`("name" ILIKE $${params.length} OR "category" ILIKE $${params.length})`);
    }
    if (options.category) {
      params.push(options.category);
      clauses.push(`"category" = $${params.length}`);
    }
    if (options.status) {
      params.push(this.parseActiveStatus(options.status));
      clauses.push(`"status" = $${params.length}::"CanteenMenuItemStatus"`);
    }
    const whereSql = clauses.join(' AND ');
    const items = await this.query<Row>(this.prisma, `SELECT * FROM "CanteenMenuItem" WHERE ${whereSql} ORDER BY "name" ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, ...params, take, skip);
    const total = await this.count(this.prisma, 'CanteenMenuItem', whereSql, params);
    return { items, meta: { page, limit: take, total } };
  }

  async updateMenuItem(id: string, dto: UpdateCanteenMenuItemDto, actor: AuthContext) {
    const existing = await this.findTenantRow('CanteenMenuItem', id, actor.tenantId);
    const updated = await this.one<Row>(
      this.prisma,
      `UPDATE "CanteenMenuItem" SET
         "name" = COALESCE($3, "name"),
         "category" = COALESCE($4, "category"),
         "description" = COALESCE($5, "description"),
         "unitPrice" = COALESCE($6::numeric, "unitPrice"),
         "isMealItem" = COALESCE($7, "isMealItem"),
         "allergenTags" = COALESCE($8::text[], "allergenTags"),
         "updatedAt" = CURRENT_TIMESTAMP
       WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`,
      actor.tenantId,
      id,
      dto.name ?? null,
      dto.category ?? null,
      dto.description ?? null,
      dto.unitPrice ?? null,
      dto.isMealItem ?? null,
      dto.allergenTags ?? null,
    );
    await this.audit(actor, 'update', 'canteen_menu_item', id, existing, updated);
    return updated;
  }

  async updateMenuItemStatus(id: string, dto: UpdateCanteenStatusDto, actor: AuthContext) {
    const status = this.parseActiveStatus(dto.status);
    const existing = await this.findTenantRow('CanteenMenuItem', id, actor.tenantId);
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenMenuItem" SET "status" = $3::"CanteenMenuItemStatus", "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id, status);
    await this.audit(actor, 'mark_status', 'canteen_menu_item', id, existing, { status, reason: dto.reason ?? null });
    return updated;
  }

  async createMealPlan(dto: CreateCanteenMealPlanDto, actor: AuthContext) {
    const plan = await this.one<Row>(this.prisma, `INSERT INTO "CanteenMealPlan" ("tenantId", "name", "description", "mealType", "price", "billingFrequency", "duplicateServingPrevention") VALUES ($1, $2, $3, $4, $5::numeric, $6, $7) RETURNING *`, actor.tenantId, dto.name, dto.description ?? null, dto.mealType, dto.price, dto.billingFrequency ?? 'MONTHLY', dto.duplicateServingPrevention ?? true);
    await this.audit(actor, 'create', 'canteen_meal_plan', String(plan.id), null, plan);
    return plan;
  }

  async listMealPlans(actor: AuthContext, options: ListMealPlansQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const clauses = ['"tenantId" = $1'];
    const params: unknown[] = [actor.tenantId];
    if (options.status) { params.push(this.parseActiveStatus(options.status)); clauses.push(`"status" = $${params.length}::"CanteenMealPlanStatus"`); }
    if (options.mealType) { params.push(options.mealType); clauses.push(`"mealType" = $${params.length}`); }
    const whereSql = clauses.join(' AND ');
    const items = await this.query<Row>(this.prisma, `SELECT * FROM "CanteenMealPlan" WHERE ${whereSql} ORDER BY "createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, ...params, take, skip);
    const total = await this.count(this.prisma, 'CanteenMealPlan', whereSql, params);
    return { items, meta: { page, limit: take, total } };
  }

  async updateMealPlan(id: string, dto: UpdateCanteenMealPlanDto, actor: AuthContext) {
    const existing = await this.findTenantRow('CanteenMealPlan', id, actor.tenantId);
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenMealPlan" SET "name" = COALESCE($3, "name"), "description" = COALESCE($4, "description"), "mealType" = COALESCE($5, "mealType"), "price" = COALESCE($6::numeric, "price"), "billingFrequency" = COALESCE($7, "billingFrequency"), "duplicateServingPrevention" = COALESCE($8, "duplicateServingPrevention"), "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id, dto.name ?? null, dto.description ?? null, dto.mealType ?? null, dto.price ?? null, dto.billingFrequency ?? null, dto.duplicateServingPrevention ?? null);
    await this.audit(actor, 'update', 'canteen_meal_plan', id, existing, updated);
    return updated;
  }

  async updateMealPlanStatus(id: string, dto: UpdateCanteenStatusDto, actor: AuthContext) {
    const status = this.parseActiveStatus(dto.status);
    const existing = await this.findTenantRow('CanteenMealPlan', id, actor.tenantId);
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenMealPlan" SET "status" = $3::"CanteenMealPlanStatus", "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id, status);
    await this.audit(actor, 'mark_status', 'canteen_meal_plan', id, existing, { status, reason: dto.reason ?? null });
    return updated;
  }

  async enrollStudent(dto: EnrollCanteenStudentDto, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const plan = await this.findTenantRow('CanteenMealPlan', dto.mealPlanId, actor.tenantId);
    if (plan.status !== 'ACTIVE') throw new ConflictException('Inactive meal plans cannot be assigned');
    const enrollment = await this.one<Row>(this.prisma, `INSERT INTO "CanteenStudentEnrollment" ("tenantId", "studentId", "mealPlanId", "startsOn", "endsOn", "notes") VALUES ($1, $2, $3, $4::date, $5::date, $6) RETURNING *`, actor.tenantId, dto.studentId, dto.mealPlanId, dto.startsOn, dto.endsOn ?? null, dto.notes ?? null);
    await this.audit(actor, 'create', 'canteen_enrollment', String(enrollment.id), null, enrollment);
    return enrollment;
  }

  async listEnrollments(actor: AuthContext, options: ListEnrollmentsQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const clauses = ['e."tenantId" = $1'];
    const params: unknown[] = [actor.tenantId];
    if (options.studentId) { params.push(options.studentId); clauses.push(`e."studentId" = $${params.length}`); }
    if (options.mealPlanId) { params.push(options.mealPlanId); clauses.push(`e."mealPlanId" = $${params.length}`); }
    if (options.status) { params.push(this.parseEnrollmentStatus(options.status)); clauses.push(`e."status" = $${params.length}::"CanteenEnrollmentStatus"`); }
    const whereSql = clauses.join(' AND ');
    const items = await this.query<Row>(this.prisma, `SELECT e.*, p."name" AS "mealPlanName", p."mealType" FROM "CanteenStudentEnrollment" e JOIN "CanteenMealPlan" p ON p."id" = e."mealPlanId" AND p."tenantId" = e."tenantId" WHERE ${whereSql} ORDER BY e."createdAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, ...params, take, skip);
    const rows = await this.query<{ count: bigint }>(this.prisma, `SELECT COUNT(*)::bigint AS count FROM "CanteenStudentEnrollment" e WHERE ${whereSql}`, ...params);
    return { items, meta: { page, limit: take, total: Number(rows[0]?.count ?? 0) } };
  }

  async updateEnrollment(id: string, dto: UpdateCanteenEnrollmentDto, actor: AuthContext) {
    const existing = await this.findTenantRow('CanteenStudentEnrollment', id, actor.tenantId);
    if (dto.mealPlanId) {
      const plan = await this.findTenantRow('CanteenMealPlan', dto.mealPlanId, actor.tenantId);
      if (plan.status !== 'ACTIVE') throw new ConflictException('Inactive meal plans cannot be assigned');
    }
    const status = dto.status ? this.parseEnrollmentStatus(dto.status) : null;
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenStudentEnrollment" SET "mealPlanId" = COALESCE($3, "mealPlanId"), "startsOn" = COALESCE($4::date, "startsOn"), "endsOn" = COALESCE($5::date, "endsOn"), "status" = COALESCE($6::"CanteenEnrollmentStatus", "status"), "notes" = COALESCE($7, "notes"), "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id, dto.mealPlanId ?? null, dto.startsOn ?? null, dto.endsOn ?? null, status, dto.notes ?? null);
    await this.audit(actor, 'update', 'canteen_enrollment', id, existing, updated);
    return updated;
  }

  async cancelEnrollment(id: string, actor: AuthContext) {
    const existing = await this.findTenantRow('CanteenStudentEnrollment', id, actor.tenantId);
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenStudentEnrollment" SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id);
    await this.audit(actor, 'cancel', 'canteen_enrollment', id, existing, updated);
    return updated;
  }

  async serveMeal(dto: ServeCanteenMealDto, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const mealDate = dto.mealDate ?? this.todayIso();
    const serving = await this.prisma.$transaction(async (tx) => {
      const enrollment = await this.resolveServingEnrollment(tx, dto, actor.tenantId, mealDate);
      if (enrollment?.status === 'CANCELLED') throw new ConflictException('Cancelled enrollments cannot be served');
      const mealType = dto.mealType ?? String(enrollment?.mealType ?? 'LUNCH');
      if (dto.preventDuplicate ?? Boolean(enrollment?.duplicateServingPrevention ?? true)) {
        const duplicate = await this.query<Row>(tx, `SELECT "id" FROM "CanteenMealServing" WHERE "tenantId" = $1 AND "studentId" = $2 AND "mealDate" = $3::date AND "mealType" = $4 AND "status" = 'SERVED' LIMIT 1`, actor.tenantId, dto.studentId, mealDate, mealType);
        if (duplicate.length > 0) throw new ConflictException('Meal already served for this student, meal, and date');
      }
      const warning = await this.buildDietaryWarning(tx, actor.tenantId, dto.studentId);
      return this.one<Row>(tx, `INSERT INTO "CanteenMealServing" ("tenantId", "studentId", "enrollmentId", "mealPlanId", "mealType", "mealDate", "servedByUserId", "dietaryWarning", "notes") VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9) RETURNING *`, actor.tenantId, dto.studentId, enrollment?.id ?? dto.enrollmentId ?? null, enrollment?.mealPlanId ?? dto.mealPlanId ?? null, mealType, mealDate, actor.userId, warning, dto.notes ?? null);
    });
    await this.audit(actor, 'serve', 'canteen_meal_serving', String(serving.id), null, serving);
    return serving;
  }

  async listDailyServings(actor: AuthContext, options: ListServingsQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const date = options.date ?? this.todayIso();
    const clauses = ['ms."tenantId" = $1', 'ms."mealDate" = $2::date'];
    const params: unknown[] = [actor.tenantId, date];
    if (options.mealType) { params.push(options.mealType); clauses.push(`ms."mealType" = $${params.length}`); }
    const whereSql = clauses.join(' AND ');
    const items = await this.query<Row>(this.prisma, `SELECT ms.*, s."studentSystemId", s."firstNameEn", s."lastNameEn" FROM "CanteenMealServing" ms JOIN "Student" s ON s."id" = ms."studentId" AND s."tenantId" = ms."tenantId" WHERE ${whereSql} ORDER BY ms."servedAt" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, ...params, take, skip);
    const rows = await this.query<{ count: bigint }>(this.prisma, `SELECT COUNT(*)::bigint AS count FROM "CanteenMealServing" ms WHERE ${whereSql}`, ...params);
    return { items, meta: { page, limit: take, total: Number(rows[0]?.count ?? 0) } };
  }

  async getOrCreateWallet(studentId: string, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, studentId);
    const wallet = await this.prisma.$transaction((tx) => this.getOrCreateWalletInTx(tx, actor.tenantId, studentId));
    await this.audit(actor, 'ensure', 'canteen_wallet', wallet.id, null, { studentId });
    return wallet;
  }

  async walletBalance(studentId: string, actor: AuthContext) {
    const wallet = await this.getOrCreateWallet(studentId, actor);
    return { walletId: wallet.id, studentId, balance: wallet.balance, lowBalanceThreshold: wallet.lowBalanceThreshold };
  }

  async topUpWallet(studentId: string, dto: TopUpCanteenWalletDto, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, studentId);
    const result = await this.prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWalletInTx(tx, actor.tenantId, studentId);
      if (dto.lowBalanceThreshold !== undefined) await this.execute(tx, `UPDATE "CanteenWallet" SET "lowBalanceThreshold" = $3::numeric, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2`, actor.tenantId, wallet.id, dto.lowBalanceThreshold);
      const updated = await this.one<WalletRow>(tx, `UPDATE "CanteenWallet" SET "balance" = "balance" + $3::numeric, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, wallet.id, dto.amount);
      const transaction = await this.one<Row>(tx, `INSERT INTO "CanteenWalletTransaction" ("tenantId", "walletId", "studentId", "type", "source", "amount", "balanceAfter", "referenceType", "note", "createdByUserId") VALUES ($1, $2, $3, 'TOP_UP', 'MANUAL', $4::numeric, $5::numeric, 'manual_top_up', $6, $7) RETURNING *`, actor.tenantId, wallet.id, studentId, dto.amount, updated.balance, dto.note ?? null, actor.userId);
      return { wallet: updated, transaction };
    });
    await this.audit(actor, 'top_up', 'canteen_wallet', result.wallet.id, null, result.transaction);
    return result;
  }

  async transactionHistory(studentId: string, actor: AuthContext, options: PaginationQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const wallet = await this.getWalletByStudent(studentId, actor.tenantId);
    const items = await this.query<Row>(this.prisma, `SELECT * FROM "CanteenWalletTransaction" WHERE "tenantId" = $1 AND "walletId" = $2 ORDER BY "transactionDate" DESC LIMIT $3 OFFSET $4`, actor.tenantId, wallet.id, take, skip);
    const total = await this.count(this.prisma, 'CanteenWalletTransaction', '"tenantId" = $1 AND "walletId" = $2', [actor.tenantId, wallet.id]);
    return { items, meta: { page, limit: take, total } };
  }

  async createPosSale(dto: CreateCanteenPosSaleDto, actor: AuthContext) {
    if (!dto.items?.length) throw new BadRequestException('At least one sale item is required');
    if (dto.paymentMethod === 'WALLET' && !dto.studentId) throw new BadRequestException('studentId is required for wallet payment');
    if (dto.studentId) await this.ensureStudent(actor.tenantId, dto.studentId);
    const sale = await this.prisma.$transaction(async (tx) => {
      const { items, subtotal } = await this.resolveSaleItems(tx, actor.tenantId, dto.items);
      await this.enforceSpendingControls(tx, actor.tenantId, dto.studentId, items, subtotal);
      const wallet = dto.paymentMethod === 'WALLET' && dto.studentId ? await this.getOrCreateWalletInTx(tx, actor.tenantId, dto.studentId) : null;
      const created = await this.one<Row>(tx, `INSERT INTO "CanteenPosSale" ("tenantId", "studentId", "staffId", "walletId", "paymentMethod", "subtotal", "totalAmount", "createdByUserId", "notes") VALUES ($1, $2, $3, $4, $5::"CanteenPaymentMethod", $6::numeric, $6::numeric, $7, $8) RETURNING *`, actor.tenantId, dto.studentId ?? null, dto.staffId ?? null, wallet?.id ?? null, dto.paymentMethod, subtotal, actor.userId, dto.notes ?? null);
      for (const item of items) await this.execute(tx, `INSERT INTO "CanteenPosSaleItem" ("tenantId", "saleId", "menuItemId", "itemName", "category", "quantity", "unitPrice", "lineTotal") VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric)`, actor.tenantId, created.id, item.id, item.name, item.category, item.quantity, item.unitPrice, item.lineTotal);
      return created;
    });
    await this.audit(actor, 'create', 'canteen_pos_sale', String(sale.id), null, sale);
    return sale;
  }

  async completePosSale(id: string, dto: CompleteCanteenPosSaleDto, actor: AuthContext) {
    const sale = await this.prisma.$transaction(async (tx) => {
      const existing = await this.findTenantRowInTx(tx, 'CanteenPosSale', id, actor.tenantId);
      if (existing.status !== 'DRAFT') throw new ConflictException('Only draft POS sales can be completed');
      if (existing.paymentMethod === 'WALLET') {
        const walletId = String(existing.walletId ?? '');
        const studentId = String(existing.studentId ?? '');
        const wallet = await this.getWalletById(tx, actor.tenantId, walletId);
        const total = Number(existing.totalAmount);
        if (Number(wallet.balance) < total) throw new ConflictException('Wallet balance cannot go negative');
        const updatedWallet = await this.one<WalletRow>(tx, `UPDATE "CanteenWallet" SET "balance" = "balance" - $3::numeric, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 AND "balance" >= $3::numeric RETURNING *`, actor.tenantId, walletId, total);
        await this.one<Row>(tx, `INSERT INTO "CanteenWalletTransaction" ("tenantId", "walletId", "studentId", "type", "source", "amount", "balanceAfter", "referenceType", "referenceId", "note", "createdByUserId") VALUES ($1, $2, $3, 'DEDUCTION', 'POS_SALE', $4::numeric, $5::numeric, 'canteen_pos_sale', $6, $7, $8) RETURNING *`, actor.tenantId, walletId, studentId, total, updatedWallet.balance, id, dto.note ?? null, actor.userId);
      }
      return this.one<Row>(tx, `UPDATE "CanteenPosSale" SET "status" = 'COMPLETED', "completedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id);
    });
    await this.audit(actor, 'complete', 'canteen_pos_sale', id, null, sale);
    return sale;
  }

  async cancelPosSale(id: string, actor: AuthContext) {
    const existing = await this.findTenantRow('CanteenPosSale', id, actor.tenantId);
    if (existing.status === 'COMPLETED') throw new ConflictException('Completed POS sales require reversal/correction workflow later');
    const updated = await this.one<Row>(this.prisma, `UPDATE "CanteenPosSale" SET "status" = 'CANCELLED', "cancelledAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "tenantId" = $1 AND "id" = $2 RETURNING *`, actor.tenantId, id);
    await this.audit(actor, 'cancel', 'canteen_pos_sale', id, existing, updated);
    return updated;
  }

  async listPosSales(actor: AuthContext, options: ListPosSalesQuery = {}) {
    const { skip, take, page } = this.pagination(options);
    const clauses = ['ps."tenantId" = $1'];
    const params: unknown[] = [actor.tenantId];
    if (options.status) { params.push(options.status); clauses.push(`ps."status" = $${params.length}::"CanteenPosSaleStatus"`); }
    if (options.studentId) { params.push(options.studentId); clauses.push(`ps."studentId" = $${params.length}`); }
    if (options.from) { params.push(options.from); clauses.push(`ps."saleDate" >= $${params.length}::timestamp`); }
    if (options.to) { params.push(options.to); clauses.push(`ps."saleDate" <= $${params.length}::timestamp`); }
    const whereSql = clauses.join(' AND ');
    const items = await this.query<Row>(this.prisma, `SELECT ps.*, COALESCE(json_agg(psi.*) FILTER (WHERE psi."id" IS NOT NULL), '[]') AS items FROM "CanteenPosSale" ps LEFT JOIN "CanteenPosSaleItem" psi ON psi."saleId" = ps."id" AND psi."tenantId" = ps."tenantId" WHERE ${whereSql} GROUP BY ps."id" ORDER BY ps."saleDate" DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, ...params, take, skip);
    const rows = await this.query<{ count: bigint }>(this.prisma, `SELECT COUNT(*)::bigint AS count FROM "CanteenPosSale" ps WHERE ${whereSql}`, ...params);
    return { items, meta: { page, limit: take, total: Number(rows[0]?.count ?? 0) } };
  }

  async upsertSpendingControl(dto: UpsertCanteenSpendingControlDto, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, dto.studentId);
    const control = await this.one<Row>(this.prisma, `INSERT INTO "CanteenSpendingControl" ("tenantId", "studentId", "dailySpendingLimit", "blockedCategories", "blockedMenuItemIds", "lowBalanceThreshold", "isActive") VALUES ($1, $2, $3::numeric, $4::text[], $5::text[], $6::numeric, COALESCE($7, TRUE)) ON CONFLICT ("tenantId", "studentId") DO UPDATE SET "dailySpendingLimit" = EXCLUDED."dailySpendingLimit", "blockedCategories" = EXCLUDED."blockedCategories", "blockedMenuItemIds" = EXCLUDED."blockedMenuItemIds", "lowBalanceThreshold" = EXCLUDED."lowBalanceThreshold", "isActive" = EXCLUDED."isActive", "updatedAt" = CURRENT_TIMESTAMP RETURNING *`, actor.tenantId, dto.studentId, dto.dailySpendingLimit ?? null, dto.blockedCategories ?? [], dto.blockedMenuItemIds ?? [], dto.lowBalanceThreshold ?? null, dto.isActive ?? true);
    await this.audit(actor, 'upsert', 'canteen_spending_control', String(control.id), null, control);
    return control;
  }

  async getSpendingControl(studentId: string, actor: AuthContext) {
    await this.ensureStudent(actor.tenantId, studentId);
    const rows = await this.query<Row>(this.prisma, `SELECT * FROM "CanteenSpendingControl" WHERE "tenantId" = $1 AND "studentId" = $2 LIMIT 1`, actor.tenantId, studentId);
    return rows[0] ?? null;
  }

  dailyMealCountReport(actor: AuthContext, date = this.todayIso()) {
    return this.query<Row>(this.prisma, `SELECT "mealType", "status", COUNT(*)::int AS count FROM "CanteenMealServing" WHERE "tenantId" = $1 AND "mealDate" = $2::date GROUP BY "mealType", "status" ORDER BY "mealType" ASC`, actor.tenantId, date);
  }

  itemWiseSalesReport(actor: AuthContext, range: DateRangeQuery = {}) {
    const { from, to } = this.dateRange(range);
    return this.query<Row>(this.prisma, `SELECT psi."menuItemId", psi."itemName", psi."category", SUM(psi."quantity")::int AS quantity, SUM(psi."lineTotal") AS "totalSales" FROM "CanteenPosSaleItem" psi JOIN "CanteenPosSale" ps ON ps."id" = psi."saleId" AND ps."tenantId" = psi."tenantId" WHERE ps."tenantId" = $1 AND ps."status" = 'COMPLETED' AND ps."saleDate" >= $2::timestamp AND ps."saleDate" <= $3::timestamp GROUP BY psi."menuItemId", psi."itemName", psi."category" ORDER BY "totalSales" DESC`, actor.tenantId, from, to);
  }

  lowBalanceWalletList(actor: AuthContext) {
    return this.query<Row>(this.prisma, `SELECT w.*, s."studentSystemId", s."firstNameEn", s."lastNameEn" FROM "CanteenWallet" w JOIN "Student" s ON s."id" = w."studentId" AND s."tenantId" = w."tenantId" WHERE w."tenantId" = $1 AND w."balance" <= w."lowBalanceThreshold" ORDER BY w."balance" ASC`, actor.tenantId);
  }

  studentSpendingSummary(actor: AuthContext, options: StudentDateRangeQuery = {}) {
    const { from, to } = this.dateRange(options);
    const clauses = ['ps."tenantId" = $1', `ps."status" = 'COMPLETED'`, 'ps."saleDate" >= $2::timestamp', 'ps."saleDate" <= $3::timestamp'];
    const params: unknown[] = [actor.tenantId, from, to];
    if (options.studentId) { params.push(options.studentId); clauses.push(`ps."studentId" = $${params.length}`); }
    return this.query<Row>(this.prisma, `SELECT ps."studentId", s."studentSystemId", s."firstNameEn", s."lastNameEn", COUNT(ps."id")::int AS "saleCount", COALESCE(SUM(ps."totalAmount"), 0) AS "totalSpent" FROM "CanteenPosSale" ps LEFT JOIN "Student" s ON s."id" = ps."studentId" AND s."tenantId" = ps."tenantId" WHERE ${clauses.join(' AND ')} GROUP BY ps."studentId", s."studentSystemId", s."firstNameEn", s."lastNameEn" ORDER BY "totalSpent" DESC`, ...params);
  }

  private async resolveSaleItems(tx: SqlClient, tenantId: string, saleItems: Array<{ menuItemId: string; quantity: number }>) {
    const items: SaleItemRow[] = [];
    let subtotal = 0;
    for (const saleItem of saleItems) {
      const item = await this.findTenantRowInTx(tx, 'CanteenMenuItem', saleItem.menuItemId, tenantId);
      if (item.status !== 'ACTIVE') throw new ConflictException('Inactive menu items cannot be sold');
      const unitPrice = Number(item.unitPrice);
      const lineTotal = unitPrice * saleItem.quantity;
      subtotal += lineTotal;
      items.push({ id: String(item.id), name: String(item.name), category: String(item.category), unitPrice: item.unitPrice as Prisma.Decimal | number | string, status: String(item.status), quantity: saleItem.quantity, lineTotal });
    }
    return { items, subtotal };
  }

  private async enforceSpendingControls(tx: SqlClient, tenantId: string, studentId: string | undefined, items: SaleItemRow[], total: number) {
    if (!studentId) return;
    const rows = await this.query<Row>(tx, `SELECT * FROM "CanteenSpendingControl" WHERE "tenantId" = $1 AND "studentId" = $2 AND "isActive" = TRUE LIMIT 1`, tenantId, studentId);
    const control = rows[0];
    if (!control) return;
    const blockedCategories = new Set(control.blockedCategories as string[] | undefined);
    const blockedItemIds = new Set(control.blockedMenuItemIds as string[] | undefined);
    const blocked = items.find((item) => blockedCategories.has(item.category) || blockedItemIds.has(item.id));
    if (blocked) throw new ConflictException(`Purchase blocked by spending controls for ${blocked.name}`);
    if (control.dailySpendingLimit !== null && control.dailySpendingLimit !== undefined) {
      const spentRows = await this.query<{ total: Prisma.Decimal | number | string }>(tx, `SELECT COALESCE(SUM("totalAmount"), 0) AS total FROM "CanteenPosSale" WHERE "tenantId" = $1 AND "studentId" = $2 AND "status" = 'COMPLETED' AND "saleDate"::date = CURRENT_DATE`, tenantId, studentId);
      if (Number(spentRows[0]?.total ?? 0) + total > Number(control.dailySpendingLimit)) throw new ConflictException('Daily spending limit exceeded');
    }
  }

  private async resolveServingEnrollment(tx: SqlClient, dto: ServeCanteenMealDto, tenantId: string, mealDate: string) {
    if (dto.enrollmentId) {
      return this.one<Row>(tx, `SELECT e.*, p."mealType", p."duplicateServingPrevention" FROM "CanteenStudentEnrollment" e JOIN "CanteenMealPlan" p ON p."id" = e."mealPlanId" AND p."tenantId" = e."tenantId" WHERE e."tenantId" = $1 AND e."id" = $2 AND e."studentId" = $3 LIMIT 1`, tenantId, dto.enrollmentId, dto.studentId);
    }
    const rows = await this.query<Row>(tx, `SELECT e.*, p."mealType", p."duplicateServingPrevention" FROM "CanteenStudentEnrollment" e JOIN "CanteenMealPlan" p ON p."id" = e."mealPlanId" AND p."tenantId" = e."tenantId" WHERE e."tenantId" = $1 AND e."studentId" = $2 AND e."status" = 'ACTIVE' AND e."startsOn" <= $3::date AND (e."endsOn" IS NULL OR e."endsOn" >= $3::date) AND ($4::text IS NULL OR p."mealType" = $4) ORDER BY e."createdAt" DESC LIMIT 1`, tenantId, dto.studentId, mealDate, dto.mealType ?? null);
    return rows[0] ?? null;
  }

  private async buildDietaryWarning(tx: SqlClient, tenantId: string, studentId: string) {
    const student = await this.one<Row>(tx, `SELECT "severeAllergies", "medicalConditions" FROM "Student" WHERE "tenantId" = $1 AND "id" = $2 LIMIT 1`, tenantId, studentId);
    const warnings = [student.severeAllergies, student.medicalConditions].filter(Boolean).map(String);
    return warnings.length > 0 ? warnings.join(' | ') : null;
  }

  private async getOrCreateWalletInTx(tx: SqlClient, tenantId: string, studentId: string) {
    const rows = await this.query<WalletRow>(tx, `INSERT INTO "CanteenWallet" ("tenantId", "studentId") VALUES ($1, $2) ON CONFLICT ("tenantId", "studentId") DO UPDATE SET "updatedAt" = "CanteenWallet"."updatedAt" RETURNING *`, tenantId, studentId);
    return rows[0];
  }

  private async getWalletByStudent(studentId: string, tenantId: string) {
    const rows = await this.query<WalletRow>(this.prisma, `SELECT * FROM "CanteenWallet" WHERE "tenantId" = $1 AND "studentId" = $2 LIMIT 1`, tenantId, studentId);
    if (!rows[0]) throw new NotFoundException('Canteen wallet not found for this student');
    return rows[0];
  }

  private async getWalletById(tx: SqlClient, tenantId: string, walletId: string) {
    const rows = await this.query<WalletRow>(tx, `SELECT * FROM "CanteenWallet" WHERE "tenantId" = $1 AND "id" = $2 LIMIT 1`, tenantId, walletId);
    if (!rows[0]) throw new NotFoundException('Canteen wallet not found');
    return rows[0];
  }

  private async ensureStudent(tenantId: string, studentId: string) {
    const rows = await this.query<{ id: string }>(this.prisma, `SELECT "id" FROM "Student" WHERE "tenantId" = $1 AND "id" = $2 LIMIT 1`, tenantId, studentId);
    if (!rows[0]) throw new NotFoundException('Student not found in this tenant');
  }

  private findTenantRow(table: string, id: string, tenantId: string) { return this.findTenantRowInTx(this.prisma, table, id, tenantId); }

  private async findTenantRowInTx(tx: SqlClient, table: string, id: string, tenantId: string) {
    const rows = await this.query<Row>(tx, `SELECT * FROM "${table}" WHERE "tenantId" = $1 AND "id" = $2 LIMIT 1`, tenantId, id);
    if (!rows[0]) throw new NotFoundException(`${table} not found in this tenant`);
    return rows[0];
  }

  private async count(tx: SqlClient, table: string, whereSql: string, params: unknown[]) {
    const rows = await this.query<{ count: bigint }>(tx, `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE ${whereSql}`, ...params);
    return Number(rows[0]?.count ?? 0);
  }

  private query<T>(tx: SqlClient, sql: string, ...params: unknown[]) {
    return (tx as { $queryRawUnsafe: <R = T[]>(query: string, ...values: unknown[]) => Promise<R> }).$queryRawUnsafe<T[]>(sql, ...params);
  }

  private async one<T>(tx: SqlClient, sql: string, ...params: unknown[]) {
    const rows = await this.query<T>(tx, sql, ...params);
    if (!rows[0]) throw new NotFoundException('Requested canteen record was not found');
    return rows[0];
  }

  private execute(tx: SqlClient, sql: string, ...params: unknown[]) {
    return (tx as { $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number> }).$executeRawUnsafe(sql, ...params);
  }

  private audit(actor: AuthContext, action: string, resource: string, resourceId: string, before: unknown, after: unknown) {
    return this.auditService.record({ action, resource, tenantId: actor.tenantId, userId: actor.userId, resourceId, before: before ? (before as Prisma.InputJsonValue) : undefined, after: after ? (after as Prisma.InputJsonValue) : undefined });
  }

  private parseActiveStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!['ACTIVE', 'INACTIVE'].includes(normalized)) throw new BadRequestException(`Invalid active status: ${status}`);
    return normalized;
  }

  private parseEnrollmentStatus(status: string) {
    const normalized = status.toUpperCase();
    if (!['ACTIVE', 'PAUSED', 'CANCELLED', 'ENDED'].includes(normalized)) throw new BadRequestException(`Invalid enrollment status: ${status}`);
    return normalized;
  }

  private pagination(options: PaginationQuery) {
    const page = Math.max(Number(options.page ?? 1), 1);
    const take = Math.min(Math.max(Number(options.limit ?? 50), 1), 100);
    return { page, take, skip: (page - 1) * take };
  }

  private dateRange(options: DateRangeQuery = {}) { return { from: options.from ?? `${this.todayIso()}T00:00:00`, to: options.to ?? `${this.todayIso()}T23:59:59` }; }
  private todayIso() { return new Date().toISOString().slice(0, 10); }
}

// Accounting integration boundary placeholder:
// Confirmed canteen revenue and wallet liability postings must later flow through AccountingPostingService only.
// No canteen service should directly write M9 ledger rows.

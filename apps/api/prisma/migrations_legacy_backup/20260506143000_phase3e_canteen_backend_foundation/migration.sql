-- Phase 3E: M8C Canteen Management backend foundation

DO $$ BEGIN CREATE TYPE "CanteenMenuItemStatus" AS ENUM ('ACTIVE', 'INACTIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenMealPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenEnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'ENDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenWalletTransactionType" AS ENUM ('TOP_UP', 'DEDUCTION', 'REFUND', 'ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenWalletTransactionSource" AS ENUM ('MANUAL', 'POS_SALE', 'MEAL_PURCHASE', 'FEE_INTEGRATION', 'ACCOUNTING_ADJUSTMENT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenPosSaleStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenMealServingStatus" AS ENUM ('SERVED', 'NOT_TAKEN', 'ABSENT', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CanteenPaymentMethod" AS ENUM ('CASH', 'WALLET', 'STAFF_CREDIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CanteenMenuItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "unitPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "status" "CanteenMenuItemStatus" NOT NULL DEFAULT 'ACTIVE',
  "isMealItem" BOOLEAN NOT NULL DEFAULT FALSE,
  "allergenTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CanteenMealPlan" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mealType" TEXT NOT NULL,
  "price" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  "status" "CanteenMealPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "duplicateServingPrevention" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CanteenStudentEnrollment" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT,
  "mealPlanId" TEXT NOT NULL REFERENCES "CanteenMealPlan"("id") ON DELETE RESTRICT,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE,
  "status" "CanteenEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CanteenMealServing" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT,
  "enrollmentId" TEXT REFERENCES "CanteenStudentEnrollment"("id") ON DELETE SET NULL,
  "mealPlanId" TEXT REFERENCES "CanteenMealPlan"("id") ON DELETE SET NULL,
  "mealType" TEXT NOT NULL,
  "mealDate" DATE NOT NULL,
  "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "CanteenMealServingStatus" NOT NULL DEFAULT 'SERVED',
  "servedByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "dietaryWarning" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CanteenWallet" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT,
  "balance" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "lowBalanceThreshold" NUMERIC(12,2) NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanteenWallet_balance_non_negative" CHECK ("balance" >= 0)
);

CREATE TABLE IF NOT EXISTS "CanteenWalletTransaction" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "walletId" TEXT NOT NULL REFERENCES "CanteenWallet"("id") ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT,
  "type" "CanteenWalletTransactionType" NOT NULL,
  "source" "CanteenWalletTransactionSource" NOT NULL,
  "amount" NUMERIC(12,2) NOT NULL,
  "balanceAfter" NUMERIC(12,2) NOT NULL,
  "referenceType" TEXT,
  "referenceId" TEXT,
  "note" TEXT,
  "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanteenWalletTransaction_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE IF NOT EXISTS "CanteenPosSale" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "studentId" TEXT REFERENCES "Student"("id") ON DELETE SET NULL,
  "staffId" TEXT REFERENCES "Staff"("id") ON DELETE SET NULL,
  "walletId" TEXT REFERENCES "CanteenWallet"("id") ON DELETE SET NULL,
  "saleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentMethod" "CanteenPaymentMethod" NOT NULL DEFAULT 'CASH',
  "status" "CanteenPosSaleStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CanteenPosSaleItem" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "saleId" TEXT NOT NULL REFERENCES "CanteenPosSale"("id") ON DELETE CASCADE,
  "menuItemId" TEXT NOT NULL REFERENCES "CanteenMenuItem"("id") ON DELETE RESTRICT,
  "itemName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" NUMERIC(12,2) NOT NULL,
  "lineTotal" NUMERIC(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanteenPosSaleItem_quantity_positive" CHECK ("quantity" > 0)
);

CREATE TABLE IF NOT EXISTS "CanteenSpendingControl" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE RESTRICT,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT,
  "dailySpendingLimit" NUMERIC(12,2),
  "blockedCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "blockedMenuItemIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lowBalanceThreshold" NUMERIC(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanteenWallet_tenant_student_unique" ON "CanteenWallet"("tenantId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanteenSpendingControl_tenant_student_unique" ON "CanteenSpendingControl"("tenantId", "studentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanteenMealServing_no_duplicate_served_meal" ON "CanteenMealServing"("tenantId", "studentId", "mealDate", "mealType") WHERE "status" = 'SERVED';
CREATE INDEX IF NOT EXISTS "CanteenMenuItem_tenant_name_category_idx" ON "CanteenMenuItem"("tenantId", "name", "category");
CREATE INDEX IF NOT EXISTS "CanteenMenuItem_tenant_status_idx" ON "CanteenMenuItem"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CanteenMealPlan_tenant_status_idx" ON "CanteenMealPlan"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CanteenStudentEnrollment_tenant_student_idx" ON "CanteenStudentEnrollment"("tenantId", "studentId");
CREATE INDEX IF NOT EXISTS "CanteenStudentEnrollment_tenant_plan_status_idx" ON "CanteenStudentEnrollment"("tenantId", "mealPlanId", "status");
CREATE INDEX IF NOT EXISTS "CanteenMealServing_tenant_served_date_idx" ON "CanteenMealServing"("tenantId", "mealDate", "servedAt");
CREATE INDEX IF NOT EXISTS "CanteenWalletTransaction_tenant_wallet_idx" ON "CanteenWalletTransaction"("tenantId", "walletId");
CREATE INDEX IF NOT EXISTS "CanteenWalletTransaction_tenant_transaction_date_idx" ON "CanteenWalletTransaction"("tenantId", "transactionDate");
CREATE INDEX IF NOT EXISTS "CanteenPosSale_tenant_sale_date_idx" ON "CanteenPosSale"("tenantId", "saleDate");
CREATE INDEX IF NOT EXISTS "CanteenPosSale_tenant_status_idx" ON "CanteenPosSale"("tenantId", "status");

INSERT INTO "Permission" ("id", "resource", "action", "description") VALUES
  (gen_random_uuid()::text, 'canteen:menu', 'create', 'Create canteen menu items'),
  (gen_random_uuid()::text, 'canteen:menu', 'read', 'Read canteen menu items'),
  (gen_random_uuid()::text, 'canteen:menu', 'update', 'Update canteen menu items'),
  (gen_random_uuid()::text, 'canteen:plans', 'create', 'Create canteen meal plans'),
  (gen_random_uuid()::text, 'canteen:plans', 'read', 'Read canteen meal plans'),
  (gen_random_uuid()::text, 'canteen:plans', 'update', 'Update canteen meal plans'),
  (gen_random_uuid()::text, 'canteen:enrollments', 'create', 'Create canteen enrollments'),
  (gen_random_uuid()::text, 'canteen:enrollments', 'read', 'Read canteen enrollments'),
  (gen_random_uuid()::text, 'canteen:enrollments', 'update', 'Update canteen enrollments'),
  (gen_random_uuid()::text, 'canteen:serving', 'create', 'Serve canteen meals'),
  (gen_random_uuid()::text, 'canteen:serving', 'read', 'Read canteen servings'),
  (gen_random_uuid()::text, 'canteen:wallets', 'create', 'Create canteen wallets'),
  (gen_random_uuid()::text, 'canteen:wallets', 'read', 'Read canteen wallets'),
  (gen_random_uuid()::text, 'canteen:wallets', 'update', 'Top up canteen wallets'),
  (gen_random_uuid()::text, 'canteen:pos', 'create', 'Create canteen POS sales'),
  (gen_random_uuid()::text, 'canteen:pos', 'read', 'Read canteen POS sales'),
  (gen_random_uuid()::text, 'canteen:pos', 'update', 'Update canteen POS sales'),
  (gen_random_uuid()::text, 'canteen:controls', 'create', 'Create canteen spending controls'),
  (gen_random_uuid()::text, 'canteen:controls', 'read', 'Read canteen spending controls'),
  (gen_random_uuid()::text, 'canteen:controls', 'update', 'Update canteen spending controls'),
  (gen_random_uuid()::text, 'canteen:reports', 'read', 'Read canteen reports')
ON CONFLICT ("resource", "action") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."resource" IN (
  'canteen:menu',
  'canteen:plans',
  'canteen:enrollments',
  'canteen:serving',
  'canteen:wallets',
  'canteen:pos',
  'canteen:controls',
  'canteen:reports'
)
WHERE r."name" IN ('super_admin', 'admin', 'principal', 'platform_super_admin')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

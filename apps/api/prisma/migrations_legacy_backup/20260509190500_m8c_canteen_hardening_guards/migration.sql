-- M8C Canteen Management hardening guardrails.
-- Enforces tenant ownership, Decimal-safe positive amounts, immutable wallet ledger,
-- duplicate serving prevention, wallet/POS consistency, spending-control integrity, and report indexes.

CREATE OR REPLACE FUNCTION "enforce_canteen_menu_item_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."name"), '') = '' THEN
    RAISE EXCEPTION 'Canteen menu item name is required';
  END IF;

  IF COALESCE(TRIM(NEW."category"), '') = '' THEN
    RAISE EXCEPTION 'Canteen menu item category is required';
  END IF;

  IF NEW."unitPrice" < 0 THEN
    RAISE EXCEPTION 'Canteen menu item price cannot be negative';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'INACTIVE') THEN
    RAISE EXCEPTION 'Invalid canteen menu item status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_menu_item_guard" ON "CanteenMenuItem";
CREATE TRIGGER "canteen_menu_item_guard"
BEFORE INSERT OR UPDATE
ON "CanteenMenuItem"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_menu_item_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_meal_plan_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."name"), '') = '' THEN
    RAISE EXCEPTION 'Canteen meal plan name is required';
  END IF;

  IF COALESCE(TRIM(NEW."mealType"), '') = '' THEN
    RAISE EXCEPTION 'Canteen meal type is required';
  END IF;

  IF NEW."price" < 0 THEN
    RAISE EXCEPTION 'Canteen meal plan price cannot be negative';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'INACTIVE') THEN
    RAISE EXCEPTION 'Invalid canteen meal plan status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_meal_plan_guard" ON "CanteenMealPlan";
CREATE TRIGGER "canteen_meal_plan_guard"
BEFORE INSERT OR UPDATE
ON "CanteenMealPlan"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_meal_plan_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_enrollment_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  plan_tenant_id text;
  plan_status text;
  overlap_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen enrollment student is missing or outside tenant';
  END IF;

  SELECT "tenantId", "status"::text INTO plan_tenant_id, plan_status FROM "CanteenMealPlan" WHERE "id" = NEW."mealPlanId";
  IF plan_tenant_id IS NULL OR plan_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen enrollment meal plan is missing or outside tenant';
  END IF;

  IF NEW."status" = 'ACTIVE' AND plan_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Active canteen enrollment requires active meal plan';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'PAUSED', 'CANCELLED', 'ENDED') THEN
    RAISE EXCEPTION 'Invalid canteen enrollment status';
  END IF;

  IF NEW."endsOn" IS NOT NULL AND NEW."endsOn" < NEW."startsOn" THEN
    RAISE EXCEPTION 'Canteen enrollment endsOn cannot be before startsOn';
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    SELECT "id" INTO overlap_id
    FROM "CanteenStudentEnrollment"
    WHERE "tenantId" = NEW."tenantId"
      AND "studentId" = NEW."studentId"
      AND "mealPlanId" = NEW."mealPlanId"
      AND "status" = 'ACTIVE'
      AND "id" <> COALESCE(NEW."id", '')
      AND "startsOn" <= COALESCE(NEW."endsOn", NEW."startsOn")
      AND ("endsOn" IS NULL OR "endsOn" >= NEW."startsOn")
    LIMIT 1;

    IF overlap_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate active canteen enrollment exists for this date range';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_enrollment_guard" ON "CanteenStudentEnrollment";
CREATE TRIGGER "canteen_enrollment_guard"
BEFORE INSERT OR UPDATE
ON "CanteenStudentEnrollment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_enrollment_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_serving_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  enrollment_tenant_id text;
  enrollment_student_id text;
  enrollment_status text;
  enrollment_starts_on date;
  enrollment_ends_on date;
  plan_tenant_id text;
  duplicate_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen serving student is missing or outside tenant';
  END IF;

  IF NEW."enrollmentId" IS NOT NULL THEN
    SELECT "tenantId", "studentId", "status"::text, "startsOn", "endsOn"
      INTO enrollment_tenant_id, enrollment_student_id, enrollment_status, enrollment_starts_on, enrollment_ends_on
    FROM "CanteenStudentEnrollment"
    WHERE "id" = NEW."enrollmentId";

    IF enrollment_tenant_id IS NULL OR enrollment_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Canteen serving enrollment is missing or outside tenant';
    END IF;

    IF enrollment_student_id <> NEW."studentId" THEN
      RAISE EXCEPTION 'Canteen serving enrollment does not match student';
    END IF;

    IF enrollment_status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'Canteen serving requires active enrollment';
    END IF;

    IF NEW."mealDate" < enrollment_starts_on OR (enrollment_ends_on IS NOT NULL AND NEW."mealDate" > enrollment_ends_on) THEN
      RAISE EXCEPTION 'Canteen serving date is outside enrollment range';
    END IF;
  END IF;

  IF NEW."mealPlanId" IS NOT NULL THEN
    SELECT "tenantId" INTO plan_tenant_id FROM "CanteenMealPlan" WHERE "id" = NEW."mealPlanId";
    IF plan_tenant_id IS NULL OR plan_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Canteen serving meal plan is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."status" NOT IN ('SERVED', 'CANCELLED', 'NOT_TAKEN') THEN
    RAISE EXCEPTION 'Invalid canteen meal serving status';
  END IF;

  IF NEW."status" = 'SERVED' THEN
    SELECT "id" INTO duplicate_id
    FROM "CanteenMealServing"
    WHERE "tenantId" = NEW."tenantId"
      AND "studentId" = NEW."studentId"
      AND "mealDate" = NEW."mealDate"
      AND "mealType" = NEW."mealType"
      AND "status" = 'SERVED'
      AND "id" <> COALESCE(NEW."id", '')
    LIMIT 1;

    IF duplicate_id IS NOT NULL THEN
      RAISE EXCEPTION 'Duplicate canteen meal serving exists for this student, meal, and date';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_serving_guard" ON "CanteenMealServing";
CREATE TRIGGER "canteen_serving_guard"
BEFORE INSERT OR UPDATE
ON "CanteenMealServing"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_serving_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_wallet_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen wallet student is missing or outside tenant';
  END IF;

  IF NEW."balance" < 0 THEN
    RAISE EXCEPTION 'Canteen wallet balance cannot be negative';
  END IF;

  IF NEW."lowBalanceThreshold" < 0 THEN
    RAISE EXCEPTION 'Canteen low balance threshold cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_wallet_guard" ON "CanteenWallet";
CREATE TRIGGER "canteen_wallet_guard"
BEFORE INSERT OR UPDATE
ON "CanteenWallet"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_wallet_guard"();

CREATE OR REPLACE FUNCTION "prevent_canteen_wallet_transaction_update"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Canteen wallet transactions are immutable; create correction transaction instead';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_wallet_transaction_immutable_guard" ON "CanteenWalletTransaction";
CREATE TRIGGER "canteen_wallet_transaction_immutable_guard"
BEFORE UPDATE OR DELETE
ON "CanteenWalletTransaction"
FOR EACH ROW
EXECUTE FUNCTION "prevent_canteen_wallet_transaction_update"();

CREATE OR REPLACE FUNCTION "enforce_canteen_wallet_transaction_guard"()
RETURNS trigger AS $$
DECLARE
  wallet_tenant_id text;
  wallet_student_id text;
BEGIN
  SELECT "tenantId", "studentId" INTO wallet_tenant_id, wallet_student_id FROM "CanteenWallet" WHERE "id" = NEW."walletId";

  IF wallet_tenant_id IS NULL OR wallet_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen wallet transaction wallet is missing or outside tenant';
  END IF;

  IF wallet_student_id <> NEW."studentId" THEN
    RAISE EXCEPTION 'Canteen wallet transaction student does not match wallet';
  END IF;

  IF NEW."amount" <= 0 THEN
    RAISE EXCEPTION 'Canteen wallet transaction amount must be positive';
  END IF;

  IF NEW."balanceAfter" < 0 THEN
    RAISE EXCEPTION 'Canteen wallet transaction balanceAfter cannot be negative';
  END IF;

  IF NEW."type" NOT IN ('TOP_UP', 'DEDUCTION', 'REFUND', 'ADJUSTMENT') THEN
    RAISE EXCEPTION 'Invalid canteen wallet transaction type';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_wallet_transaction_guard" ON "CanteenWalletTransaction";
CREATE TRIGGER "canteen_wallet_transaction_guard"
BEFORE INSERT
ON "CanteenWalletTransaction"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_wallet_transaction_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_pos_sale_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  staff_tenant_id text;
  wallet_tenant_id text;
  wallet_student_id text;
BEGIN
  IF NEW."studentId" IS NOT NULL THEN
    SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
    IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Canteen POS sale student is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."staffId" IS NOT NULL THEN
    SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";
    IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Canteen POS sale staff is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."walletId" IS NOT NULL THEN
    SELECT "tenantId", "studentId" INTO wallet_tenant_id, wallet_student_id FROM "CanteenWallet" WHERE "id" = NEW."walletId";
    IF wallet_tenant_id IS NULL OR wallet_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Canteen POS sale wallet is missing or outside tenant';
    END IF;
    IF NEW."studentId" IS NULL OR wallet_student_id <> NEW."studentId" THEN
      RAISE EXCEPTION 'Canteen POS wallet does not match sale student';
    END IF;
  END IF;

  IF NEW."subtotal" < 0 OR NEW."totalAmount" < 0 THEN
    RAISE EXCEPTION 'Canteen POS sale amount cannot be negative';
  END IF;

  IF NEW."status" NOT IN ('DRAFT', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid canteen POS sale status';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'COMPLETED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Completed canteen POS sale cannot transition silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_pos_sale_guard" ON "CanteenPosSale";
CREATE TRIGGER "canteen_pos_sale_guard"
BEFORE INSERT OR UPDATE
ON "CanteenPosSale"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_pos_sale_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_pos_sale_item_guard"()
RETURNS trigger AS $$
DECLARE
  sale_tenant_id text;
  menu_item_tenant_id text;
BEGIN
  SELECT "tenantId" INTO sale_tenant_id FROM "CanteenPosSale" WHERE "id" = NEW."saleId";
  IF sale_tenant_id IS NULL OR sale_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen POS sale item sale is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO menu_item_tenant_id FROM "CanteenMenuItem" WHERE "id" = NEW."menuItemId";
  IF menu_item_tenant_id IS NULL OR menu_item_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen POS sale item menu item is missing or outside tenant';
  END IF;

  IF NEW."quantity" <= 0 THEN
    RAISE EXCEPTION 'Canteen POS sale item quantity must be positive';
  END IF;

  IF NEW."unitPrice" < 0 OR NEW."lineTotal" < 0 THEN
    RAISE EXCEPTION 'Canteen POS sale item amount cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_pos_sale_item_guard" ON "CanteenPosSaleItem";
CREATE TRIGGER "canteen_pos_sale_item_guard"
BEFORE INSERT OR UPDATE
ON "CanteenPosSaleItem"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_pos_sale_item_guard"();

CREATE OR REPLACE FUNCTION "enforce_canteen_spending_control_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Canteen spending control student is missing or outside tenant';
  END IF;

  IF NEW."dailySpendingLimit" IS NOT NULL AND NEW."dailySpendingLimit" < 0 THEN
    RAISE EXCEPTION 'Canteen daily spending limit cannot be negative';
  END IF;

  IF NEW."lowBalanceThreshold" IS NOT NULL AND NEW."lowBalanceThreshold" < 0 THEN
    RAISE EXCEPTION 'Canteen spending control low balance threshold cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "canteen_spending_control_guard" ON "CanteenSpendingControl";
CREATE TRIGGER "canteen_spending_control_guard"
BEFORE INSERT OR UPDATE
ON "CanteenSpendingControl"
FOR EACH ROW
EXECUTE FUNCTION "enforce_canteen_spending_control_guard"();

CREATE UNIQUE INDEX IF NOT EXISTS "CanteenMealServing_tenant_student_meal_date_served_uidx"
ON "CanteenMealServing"("tenantId", "studentId", "mealDate", "mealType")
WHERE "status" = 'SERVED';

CREATE INDEX IF NOT EXISTS "CanteenMenuItem_tenant_category_status_idx" ON "CanteenMenuItem"("tenantId", "category", "status");
CREATE INDEX IF NOT EXISTS "CanteenMealPlan_tenant_meal_status_idx" ON "CanteenMealPlan"("tenantId", "mealType", "status");
CREATE INDEX IF NOT EXISTS "CanteenStudentEnrollment_tenant_student_status_idx" ON "CanteenStudentEnrollment"("tenantId", "studentId", "status", "startsOn");
CREATE INDEX IF NOT EXISTS "CanteenStudentEnrollment_tenant_plan_status_idx" ON "CanteenStudentEnrollment"("tenantId", "mealPlanId", "status", "startsOn");
CREATE INDEX IF NOT EXISTS "CanteenMealServing_tenant_date_meal_idx" ON "CanteenMealServing"("tenantId", "mealDate", "mealType", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "CanteenWallet_tenant_student_uidx" ON "CanteenWallet"("tenantId", "studentId");
CREATE INDEX IF NOT EXISTS "CanteenWallet_tenant_balance_idx" ON "CanteenWallet"("tenantId", "balance");
CREATE INDEX IF NOT EXISTS "CanteenWalletTransaction_tenant_wallet_date_idx" ON "CanteenWalletTransaction"("tenantId", "walletId", "transactionDate");
CREATE INDEX IF NOT EXISTS "CanteenPosSale_tenant_status_date_idx" ON "CanteenPosSale"("tenantId", "status", "saleDate");
CREATE INDEX IF NOT EXISTS "CanteenPosSale_tenant_student_date_idx" ON "CanteenPosSale"("tenantId", "studentId", "saleDate");
CREATE INDEX IF NOT EXISTS "CanteenPosSaleItem_tenant_menu_item_idx" ON "CanteenPosSaleItem"("tenantId", "menuItemId");

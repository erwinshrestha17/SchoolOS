-- Phase 7.4 — Online payment authority.
--
-- 1. OnlinePaymentIntent: verification bookkeeping, reconciler index, amount /
--    success invariants and an immutability guard (an intent is the immutable
--    record of what the school asked the provider to collect).
-- 2. TenantPaymentMerchant: the school's own merchant account at a
--    platform-managed gateway (D3). No row => online payments unavailable.
--
-- Preflights FAIL (never edit or fabricate payment rows).

DO $$
DECLARE
  v_count integer;
  v_ids text;
BEGIN
  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "OnlinePaymentIntent" WHERE "amount" <= 0 LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.4 preflight: % OnlinePaymentIntent row(s) have a non-positive amount (first ids: %).', v_count, v_ids;
  END IF;

  SELECT count(*), string_agg("id", ', ' ORDER BY "id")
    INTO v_count, v_ids
  FROM (
    SELECT "id" FROM "OnlinePaymentIntent"
    WHERE "status" = 'SUCCEEDED' AND "paymentId" IS NULL
    LIMIT 20
  ) bad;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Phase 7.4 preflight: % SUCCEEDED OnlinePaymentIntent row(s) have no payment (first ids: %). Link them to the settled payment or reconcile them before migrating.', v_count, v_ids;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- OnlinePaymentIntent
-- ---------------------------------------------------------------------------
ALTER TABLE "OnlinePaymentIntent"
  ADD COLUMN "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);

CREATE INDEX "OnlinePaymentIntent_status_updatedAt_idx"
  ON "OnlinePaymentIntent"("status", "updatedAt");

ALTER TABLE "OnlinePaymentIntent"
  ADD CONSTRAINT "OnlinePaymentIntent_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "OnlinePaymentIntent_succeeded_has_payment"
    CHECK ("status" <> 'SUCCEEDED' OR "paymentId" IS NOT NULL);

CREATE OR REPLACE FUNCTION schoolos_guard_online_payment_intent()
RETURNS trigger AS $$
BEGIN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
     OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
     OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
     OR NEW."amount" IS DISTINCT FROM OLD."amount"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."requestedByUserId" IS DISTINCT FROM OLD."requestedByUserId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'OnlinePaymentIntent % is immutable: the requested payment details cannot change.', OLD."id"
      USING ERRCODE = '23000';
  END IF;
  IF OLD."status" = 'SUCCEEDED' AND NEW."status" <> 'SUCCEEDED' THEN
    RAISE EXCEPTION 'OnlinePaymentIntent % is already settled and cannot leave SUCCEEDED.', OLD."id"
      USING ERRCODE = '23000';
  END IF;
  IF OLD."paymentId" IS NOT NULL AND NEW."paymentId" IS DISTINCT FROM OLD."paymentId" THEN
    RAISE EXCEPTION 'OnlinePaymentIntent % payment link is write-once.', OLD."id"
      USING ERRCODE = '23000';
  END IF;
  IF OLD."providerReference" IS NOT NULL
     AND NEW."providerReference" IS DISTINCT FROM OLD."providerReference" THEN
    RAISE EXCEPTION 'OnlinePaymentIntent % provider reference is write-once.', OLD."id"
      USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "OnlinePaymentIntent_guard"
  BEFORE UPDATE ON "OnlinePaymentIntent"
  FOR EACH ROW EXECUTE FUNCTION schoolos_guard_online_payment_intent();

-- ---------------------------------------------------------------------------
-- TenantPaymentMerchant
-- ---------------------------------------------------------------------------
CREATE TABLE "TenantPaymentMerchant" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "environment" "ProviderEnvironment" NOT NULL,
  "merchantId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantPaymentMerchant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantPaymentMerchant_merchantId_present" CHECK (length(btrim("merchantId")) > 0),
  CONSTRAINT "TenantPaymentMerchant_provider_upper" CHECK ("provider" = upper(btrim("provider")) AND length("provider") > 0)
);

CREATE UNIQUE INDEX "TenantPaymentMerchant_tenantId_provider_environment_key"
  ON "TenantPaymentMerchant"("tenantId", "provider", "environment");
CREATE UNIQUE INDEX "TenantPaymentMerchant_provider_environment_merchantId_key"
  ON "TenantPaymentMerchant"("provider", "environment", "merchantId");
CREATE INDEX "TenantPaymentMerchant_tenantId_enabled_idx"
  ON "TenantPaymentMerchant"("tenantId", "enabled");

ALTER TABLE "TenantPaymentMerchant"
  ADD CONSTRAINT "TenantPaymentMerchant_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

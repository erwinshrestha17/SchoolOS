ALTER TABLE "CanteenSpendingControl"
ADD COLUMN IF NOT EXISTS "monthlySpendingLimit" DECIMAL(12,2);

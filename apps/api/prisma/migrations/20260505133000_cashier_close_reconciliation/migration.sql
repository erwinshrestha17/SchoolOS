-- Add day-end reconciliation capture to cashier closes.
ALTER TABLE "CashierClose"
  ADD COLUMN "expectedCashAmount" DECIMAL(12, 2),
  ADD COLUMN "actualCashAmount" DECIMAL(12, 2),
  ADD COLUMN "varianceAmount" DECIMAL(12, 2),
  ADD COLUMN "varianceReason" TEXT,
  ADD COLUMN "denominationBreakdown" JSONB,
  ADD COLUMN "methodBreakdown" JSONB;

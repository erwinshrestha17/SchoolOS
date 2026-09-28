-- Preserve old payroll history. No historical reviewer or finalizer is invented.
ALTER TYPE "PayrollRunStatus" ADD VALUE 'VALIDATED';
ALTER TYPE "PayrollRunStatus" ADD VALUE 'FINALIZED';
ALTER TABLE "PayrollRun"
  ADD COLUMN "validatedById" TEXT,
  ADD COLUMN "validatedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "approvedSourceFingerprint" TEXT;

ALTER TYPE "PayslipStatus" ADD VALUE IF NOT EXISTS 'VOID';

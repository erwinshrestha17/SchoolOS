-- Keep all original runs and payslips when a void/cancelled run is replaced.
ALTER TABLE "PayrollRun" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "predecessorRunId" TEXT;
DROP INDEX "PayrollRun_tenantId_periodMonth_periodYear_key";
CREATE UNIQUE INDEX "PayrollRun_tenantId_periodMonth_periodYear_revision_key"
  ON "PayrollRun" ("tenantId", "periodMonth", "periodYear", "revision");
CREATE UNIQUE INDEX "PayrollRun_predecessorRunId_key" ON "PayrollRun" ("predecessorRunId");
CREATE UNIQUE INDEX "PayrollRun_one_active_period_key" ON "PayrollRun" ("tenantId", "periodMonth", "periodYear")
  WHERE "status" NOT IN ('VOID', 'CANCELLED');
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_predecessorRunId_fkey"
  FOREIGN KEY ("predecessorRunId") REFERENCES "PayrollRun" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_revision_positive" CHECK ("revision" >= 1);

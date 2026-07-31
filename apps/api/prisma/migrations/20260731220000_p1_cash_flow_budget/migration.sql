-- Extend accounting report mapping types for cash flow classification
ALTER TYPE "AccountingReportMappingType" ADD VALUE IF NOT EXISTS 'CASH_FLOW_OPERATING';
ALTER TYPE "AccountingReportMappingType" ADD VALUE IF NOT EXISTS 'CASH_FLOW_INVESTING';
ALTER TYPE "AccountingReportMappingType" ADD VALUE IF NOT EXISTS 'CASH_FLOW_FINANCING';

-- Fiscal budget persistence (P1 minimal)
CREATE TYPE "FiscalBudgetStatus" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED');

CREATE TABLE "FiscalBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FiscalBudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "FiscalBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FiscalBudgetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalBudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalBudget_tenantId_fiscalYearId_name_key" ON "FiscalBudget"("tenantId", "fiscalYearId", "name");
CREATE INDEX "FiscalBudget_tenantId_fiscalYearId_status_idx" ON "FiscalBudget"("tenantId", "fiscalYearId", "status");

CREATE UNIQUE INDEX "FiscalBudgetLine_tenantId_budgetId_chartAccountId_key" ON "FiscalBudgetLine"("tenantId", "budgetId", "chartAccountId");
CREATE INDEX "FiscalBudgetLine_tenantId_budgetId_idx" ON "FiscalBudgetLine"("tenantId", "budgetId");
CREATE INDEX "FiscalBudgetLine_tenantId_chartAccountId_idx" ON "FiscalBudgetLine"("tenantId", "chartAccountId");

ALTER TABLE "FiscalBudget" ADD CONSTRAINT "FiscalBudget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalBudget" ADD CONSTRAINT "FiscalBudget_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalBudget" ADD CONSTRAINT "FiscalBudget_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FiscalBudget" ADD CONSTRAINT "FiscalBudget_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FiscalBudgetLine" ADD CONSTRAINT "FiscalBudgetLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalBudgetLine" ADD CONSTRAINT "FiscalBudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "FiscalBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FiscalBudgetLine" ADD CONSTRAINT "FiscalBudgetLine_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalBudgetLine" ADD CONSTRAINT "FiscalBudgetLine_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

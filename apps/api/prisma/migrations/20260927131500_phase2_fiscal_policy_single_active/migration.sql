-- A fiscal reopen request must resolve one unambiguous active policy.
-- Existing duplicate active policies require an explicit audited cleanup before migration.
CREATE UNIQUE INDEX "ApprovalPolicy_one_active_fiscal_reopen_per_tenant"
ON "ApprovalPolicy" ("tenantId", "workflowType")
WHERE "isActive" = true
  AND "workflowType" IN ('FISCAL_PERIOD_REOPEN', 'FISCAL_YEAR_REOPEN');

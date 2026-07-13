-- AlterTable
ALTER TABLE "JournalEntrySequence" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "BankStatementImportBatch_tenant_account_created_idx" RENAME TO "BankStatementImportBatch_tenantId_accountId_createdAt_idx";

-- RenameIndex
ALTER INDEX "BankStatementImportBatch_tenant_account_fingerprint_key" RENAME TO "BankStatementImportBatch_tenantId_accountId_fingerprint_key";

-- RenameIndex
ALTER INDEX "PayrollException_code_status_idx" RENAME TO "PayrollException_tenantId_code_status_idx";

-- RenameIndex
ALTER INDEX "PayrollException_period_status_severity_idx" RENAME TO "PayrollException_tenantId_periodYear_periodMonth_status_sev_idx";

-- RenameIndex
ALTER INDEX "PayrollException_run_status_idx" RENAME TO "PayrollException_tenantId_payrollRunId_status_idx";

-- RenameIndex
ALTER INDEX "PayrollException_staff_status_idx" RENAME TO "PayrollException_tenantId_staffId_status_idx";

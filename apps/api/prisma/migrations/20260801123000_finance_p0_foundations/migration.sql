-- P0 finance foundations are additive. Legacy accounting periods and bank
-- statement compatibility fields remain in place.

CREATE TYPE "AccountingPostingBatchStatus" AS ENUM ('DRAFT', 'READY', 'POSTING', 'POSTED', 'FAILED', 'REVERSED');
CREATE TYPE "AccountingPostingItemStatus" AS ENUM ('READY', 'POSTED', 'FAILED', 'SKIPPED');
CREATE TYPE "CashierCloseStatus" AS ENUM ('OPEN', 'COUNTED', 'SUBMITTED', 'APPROVED', 'CLOSED', 'DEPOSITED');
CREATE TYPE "PaymentAllocationType" AS ENUM ('INVOICE', 'ADVANCE', 'UNALLOCATED', 'REFUND', 'REVERSAL', 'REALLOCATION');
ALTER TYPE "JournalSourceType" ADD VALUE 'PAYMENT_ALLOCATION';
CREATE TYPE "FinanceVendorStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "FinanceExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED');
CREATE TYPE "FinancePayableStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'VOID');
CREATE TYPE "BankReconciliationStatus" AS ENUM ('OPEN', 'FINALIZED', 'REOPENED');
CREATE TYPE "BankReconciliationMatchType" AS ENUM ('EXACT', 'SUGGESTED', 'TIMING_DIFFERENCE', 'ADJUSTMENT', 'MANUAL');
CREATE TYPE "BankReconciliationMatchStatus" AS ENUM ('MATCHED', 'UNMATCHED');
CREATE TYPE "CashDepositStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'DEPOSITED', 'REVERSED');
CREATE TYPE "PayrollAccountingSnapshotStatus" AS ENUM ('FROZEN', 'POSTED', 'CORRECTED');
ALTER TYPE "ApprovalWorkflowType" ADD VALUE 'FISCAL_PERIOD_REOPEN';

ALTER TABLE "FiscalPeriod"
  ADD COLUMN "reopenedWarning" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "legacyAccountingPeriodId" TEXT;
ALTER TABLE "AccountingPeriod"
  ADD COLUMN "canonicalFiscalPeriodId" TEXT;

CREATE UNIQUE INDEX "FiscalPeriod_legacyAccountingPeriodId_key" ON "FiscalPeriod"("legacyAccountingPeriodId");
CREATE UNIQUE INDEX "AccountingPeriod_canonicalFiscalPeriodId_key" ON "AccountingPeriod"("canonicalFiscalPeriodId");

UPDATE "FiscalPeriod" AS fiscal
SET "legacyAccountingPeriodId" = legacy."id"
FROM "AccountingPeriod" AS legacy
WHERE fiscal."tenantId" = legacy."tenantId"
  AND fiscal."startDate" = legacy."startsOn"
  AND fiscal."endDate" = legacy."endsOn";

UPDATE "AccountingPeriod" AS legacy
SET "canonicalFiscalPeriodId" = fiscal."id"
FROM "FiscalPeriod" AS fiscal
WHERE fiscal."legacyAccountingPeriodId" = legacy."id";

ALTER TABLE "Payment" ALTER COLUMN "invoiceId" DROP NOT NULL;

ALTER TABLE "CashierClose"
  ALTER COLUMN "closedAt" DROP NOT NULL,
  ADD COLUMN "status" "CashierCloseStatus" NOT NULL DEFAULT 'CLOSED',
  ADD COLUMN "activeSessionKey" TEXT,
  ADD COLUMN "countedThroughAt" TIMESTAMP(3),
  ADD COLUMN "countedAt" TIMESTAMP(3),
  ADD COLUMN "countedById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "submittedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "depositedAt" TIMESTAMP(3),
  ADD COLUMN "depositedById" TEXT,
  ADD COLUMN "depositId" TEXT,
  ADD COLUMN "reopenedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedById" TEXT,
  ADD COLUMN "reopenReason" TEXT;

CREATE INDEX "CashierClose_tenantId_status_openedAt_idx" ON "CashierClose"("tenantId", "status", "openedAt");
CREATE UNIQUE INDEX "CashierClose_tenantId_activeSessionKey_key" ON "CashierClose"("tenantId", "activeSessionKey");

ALTER TABLE "ReportExport"
  ADD COLUMN "normalizedParameters" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "rowCount" INTEGER,
  ADD COLUMN "displayedTotals" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "definitionVersion" TEXT NOT NULL DEFAULT '1.0',
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "classification" TEXT NOT NULL DEFAULT 'CONFIDENTIAL',
  ADD COLUMN "watermark" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "failureDetail" TEXT,
  ADD COLUMN "auditEventId" TEXT;

CREATE INDEX "ReportExport_tenantId_status_createdAt_idx" ON "ReportExport"("tenantId", "status", "createdAt");
CREATE INDEX "ReportExport_tenantId_expiresAt_idx" ON "ReportExport"("tenantId", "expiresAt");
CREATE INDEX "ReportExport_tenantId_checksum_idx" ON "ReportExport"("tenantId", "checksum");

CREATE TABLE "AccountingPostingBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "fiscalPeriodId" TEXT,
  "sourceModule" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceBatchId" TEXT NOT NULL,
  "postingType" TEXT NOT NULL DEFAULT 'DEFAULT',
  "status" "AccountingPostingBatchStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceTotal" DECIMAL(18,2) NOT NULL,
  "postedTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reconciliationDifference" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "normalizedPayload" JSONB NOT NULL DEFAULT '{}',
  "idempotencyKey" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "failureCode" TEXT,
  "failureDetail" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "requestedById" TEXT,
  "postedById" TEXT,
  "postedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingPostingBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingPostingBatch_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AccountingPostingBatch_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingPostingBatch_tenantId_idempotencyKey_key" ON "AccountingPostingBatch"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "AccountingPostingBatch_tenantId_sourceModule_sourceType_sou_key" ON "AccountingPostingBatch"("tenantId", "sourceModule", "sourceType", "sourceBatchId", "postingType");
CREATE INDEX "AccountingPostingBatch_tenantId_status_createdAt_idx" ON "AccountingPostingBatch"("tenantId", "status", "createdAt");
CREATE INDEX "AccountingPostingBatch_tenantId_fiscalYearId_fiscalPeriodId_idx" ON "AccountingPostingBatch"("tenantId", "fiscalYearId", "fiscalPeriodId", "status");
CREATE INDEX "AccountingPostingBatch_tenantId_sourceModule_sourceBatchId_idx" ON "AccountingPostingBatch"("tenantId", "sourceModule", "sourceBatchId");
CREATE INDEX "AccountingPostingBatch_tenantId_journalEntryId_idx" ON "AccountingPostingBatch"("tenantId", "journalEntryId");

CREATE TABLE "AccountingPostingItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceItemId" TEXT NOT NULL,
  "lineNumber" INTEGER NOT NULL,
  "accountId" TEXT NOT NULL,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "AccountingPostingItemStatus" NOT NULL DEFAULT 'READY',
  "failureDetail" TEXT,
  "journalLineId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingPostingItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingPostingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AccountingPostingBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AccountingPostingItem_tenantId_batchId_sourceItemId_lineNum_key" ON "AccountingPostingItem"("tenantId", "batchId", "sourceItemId", "lineNumber");
CREATE INDEX "AccountingPostingItem_tenantId_batchId_status_idx" ON "AccountingPostingItem"("tenantId", "batchId", "status");
CREATE INDEX "AccountingPostingItem_tenantId_accountId_idx" ON "AccountingPostingItem"("tenantId", "accountId");
CREATE INDEX "AccountingPostingItem_tenantId_journalLineId_idx" ON "AccountingPostingItem"("tenantId", "journalLineId");

CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "allocationType" "PaymentAllocationType" NOT NULL DEFAULT 'INVOICE',
  "allocationGroupId" TEXT,
  "reason" TEXT,
  "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "allocatedById" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversedById" TEXT,
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PaymentAllocation" ("id", "tenantId", "paymentId", "invoiceId", "amount", "allocationType", "allocatedAt", "createdAt")
SELECT gen_random_uuid()::text, "tenantId", "id", "invoiceId", "amount", 'INVOICE', "paidAt", "createdAt"
FROM "Payment"
WHERE "invoiceId" IS NOT NULL;

INSERT INTO "PaymentAllocation" ("id", "tenantId", "paymentId", "invoiceId", "amount", "allocationType", "allocationGroupId", "reason", "allocatedAt", "allocatedById", "createdAt")
SELECT gen_random_uuid()::text, p."tenantId", p."id", p."invoiceId", -pr."amount", 'REFUND', pr."id", pr."reason", pr."refundDate", pr."createdById", pr."createdAt"
FROM "PaymentRefund" pr
JOIN "Payment" p ON p."id" = pr."paymentId" AND p."tenantId" = pr."tenantId"
WHERE p."invoiceId" IS NOT NULL;

INSERT INTO "PaymentAllocation" ("id", "tenantId", "paymentId", "invoiceId", "amount", "allocationType", "allocationGroupId", "reason", "allocatedAt", "allocatedById", "createdAt")
SELECT gen_random_uuid()::text, p."tenantId", p."id", p."invoiceId", -p."amount", 'REVERSAL', p."id", p."reversalReason", COALESCE(p."reversedAt", p."paidAt"), p."reversedById", COALESCE(p."reversedAt", p."paidAt")
FROM "Payment" p
WHERE p."invoiceId" IS NOT NULL AND p."status" = 'REVERSED';

CREATE INDEX "PaymentAllocation_tenantId_paymentId_allocatedAt_idx" ON "PaymentAllocation"("tenantId", "paymentId", "allocatedAt");
CREATE INDEX "PaymentAllocation_tenantId_invoiceId_allocatedAt_idx" ON "PaymentAllocation"("tenantId", "invoiceId", "allocatedAt");
CREATE INDEX "PaymentAllocation_tenantId_allocationType_allocatedAt_idx" ON "PaymentAllocation"("tenantId", "allocationType", "allocatedAt");
CREATE INDEX "PaymentAllocation_tenantId_paymentId_allocationGroupId_idx" ON "PaymentAllocation"("tenantId", "paymentId", "allocationGroupId");

CREATE TABLE "FinanceVendor" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "vendorCode" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "panNumber" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "status" "FinanceVendorStatus" NOT NULL DEFAULT 'ACTIVE',
  "duplicateKey" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceVendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinanceVendor_tenantId_vendorCode_key" ON "FinanceVendor"("tenantId", "vendorCode");
CREATE INDEX "FinanceVendor_tenantId_status_displayName_idx" ON "FinanceVendor"("tenantId", "status", "displayName");
CREATE INDEX "FinanceVendor_tenantId_panNumber_idx" ON "FinanceVendor"("tenantId", "panNumber");
CREATE INDEX "FinanceVendor_tenantId_duplicateKey_idx" ON "FinanceVendor"("tenantId", "duplicateKey");

CREATE TABLE "FinanceExpense" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "expenseNumber" TEXT NOT NULL,
  "vendorId" TEXT,
  "fiscalYearId" TEXT NOT NULL,
  "fiscalPeriodId" TEXT,
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "description" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "status" "FinanceExpenseStatus" NOT NULL DEFAULT 'DRAFT',
  "recurringReference" TEXT,
  "supportingFileAssetId" TEXT,
  "duplicateFingerprint" TEXT,
  "idempotencyKey" TEXT,
  "postingBatchId" TEXT,
  "reversalOfId" TEXT,
  "correctionReason" TEXT,
  "createdById" TEXT,
  "approvedById" TEXT,
  "approvedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinanceExpense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceExpense_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "FinanceVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceExpense_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinanceExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceExpense_tenantId_expenseNumber_key" ON "FinanceExpense"("tenantId", "expenseNumber");
CREATE UNIQUE INDEX "FinanceExpense_tenantId_idempotencyKey_key" ON "FinanceExpense"("tenantId", "idempotencyKey");
CREATE INDEX "FinanceExpense_tenantId_status_expenseDate_idx" ON "FinanceExpense"("tenantId", "status", "expenseDate");
CREATE INDEX "FinanceExpense_tenantId_vendorId_status_idx" ON "FinanceExpense"("tenantId", "vendorId", "status");
CREATE INDEX "FinanceExpense_tenantId_fiscalYearId_fiscalPeriodId_idx" ON "FinanceExpense"("tenantId", "fiscalYearId", "fiscalPeriodId");
CREATE INDEX "FinanceExpense_tenantId_duplicateFingerprint_idx" ON "FinanceExpense"("tenantId", "duplicateFingerprint");
CREATE INDEX "FinanceExpense_tenantId_postingBatchId_idx" ON "FinanceExpense"("tenantId", "postingBatchId");

CREATE TABLE "FinancePayable" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payableNumber" TEXT NOT NULL,
  "vendorId" TEXT,
  "expenseId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "originalAmount" DECIMAL(18,2) NOT NULL,
  "outstandingAmount" DECIMAL(18,2) NOT NULL,
  "status" "FinancePayableStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancePayable_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancePayable_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "FinanceVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancePayable_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "FinanceExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinancePayable_expenseId_key" ON "FinancePayable"("expenseId");
CREATE UNIQUE INDEX "FinancePayable_tenantId_payableNumber_key" ON "FinancePayable"("tenantId", "payableNumber");
CREATE INDEX "FinancePayable_tenantId_status_dueDate_idx" ON "FinancePayable"("tenantId", "status", "dueDate");
CREATE INDEX "FinancePayable_tenantId_vendorId_status_idx" ON "FinancePayable"("tenantId", "vendorId", "status");

CREATE TABLE "FinancePayableSettlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payableId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL,
  "paymentReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "reversalOfId" TEXT,
  "reversalReason" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancePayableSettlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinancePayableSettlement_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "FinancePayable"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinancePayableSettlement_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinancePayableSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinancePayableSettlement_tenantId_idempotencyKey_key" ON "FinancePayableSettlement"("tenantId", "idempotencyKey");
CREATE INDEX "FinancePayableSettlement_tenantId_payableId_settledAt_idx" ON "FinancePayableSettlement"("tenantId", "payableId", "settledAt");
CREATE INDEX "FinancePayableSettlement_tenantId_journalEntryId_idx" ON "FinancePayableSettlement"("tenantId", "journalEntryId");

CREATE TABLE "BankReconciliationSession" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "fiscalPeriodId" TEXT,
  "statementFrom" TIMESTAMP(3) NOT NULL,
  "statementTo" TIMESTAMP(3) NOT NULL,
  "openingBookBalance" DECIMAL(18,2) NOT NULL,
  "closingBookBalance" DECIMAL(18,2) NOT NULL,
  "openingBankBalance" DECIMAL(18,2) NOT NULL,
  "closingBankBalance" DECIMAL(18,2) NOT NULL,
  "difference" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "finalizedAt" TIMESTAMP(3),
  "finalizedById" TEXT,
  "reopenReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankReconciliationSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationSession_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BankReconciliationSession_tenantId_accountId_status_idx" ON "BankReconciliationSession"("tenantId", "accountId", "status");
CREATE INDEX "BankReconciliationSession_tenantId_fiscalPeriodId_status_idx" ON "BankReconciliationSession"("tenantId", "fiscalPeriodId", "status");
CREATE INDEX "BankReconciliationSession_tenantId_statementFrom_statementT_idx" ON "BankReconciliationSession"("tenantId", "statementFrom", "statementTo");

CREATE TABLE "BankReconciliationMatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "bankStatementId" TEXT NOT NULL,
  "journalLineId" TEXT,
  "matchType" "BankReconciliationMatchType" NOT NULL,
  "status" "BankReconciliationMatchStatus" NOT NULL DEFAULT 'MATCHED',
  "bankAmount" DECIMAL(18,2) NOT NULL,
  "bookAmount" DECIMAL(18,2) NOT NULL,
  "difference" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reason" TEXT,
  "matchedById" TEXT NOT NULL,
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unmatchedById" TEXT,
  "unmatchedAt" TIMESTAMP(3),
  "unmatchReason" TEXT,
  CONSTRAINT "BankReconciliationMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationMatch_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BankReconciliationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankReconciliationMatch_tenantId_sessionId_bankStatementId__key" ON "BankReconciliationMatch"("tenantId", "sessionId", "bankStatementId", "journalLineId");
CREATE INDEX "BankReconciliationMatch_tenantId_sessionId_status_idx" ON "BankReconciliationMatch"("tenantId", "sessionId", "status");
CREATE INDEX "BankReconciliationMatch_tenantId_bankStatementId_idx" ON "BankReconciliationMatch"("tenantId", "bankStatementId");
CREATE INDEX "BankReconciliationMatch_tenantId_journalLineId_idx" ON "BankReconciliationMatch"("tenantId", "journalLineId");

CREATE TABLE "BankReconciliationHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT,
  "beforeState" JSONB,
  "afterState" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankReconciliationHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankReconciliationHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BankReconciliationSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BankReconciliationHistory_tenantId_sessionId_createdAt_idx" ON "BankReconciliationHistory"("tenantId", "sessionId", "createdAt");
CREATE INDEX "BankReconciliationHistory_tenantId_actorUserId_createdAt_idx" ON "BankReconciliationHistory"("tenantId", "actorUserId", "createdAt");

CREATE TABLE "CashDeposit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "depositNumber" TEXT NOT NULL,
  "cashierCloseId" TEXT,
  "accountId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "depositDate" TIMESTAMP(3) NOT NULL,
  "referenceNumber" TEXT,
  "status" "CashDepositStatus" NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" TEXT NOT NULL,
  "journalEntryId" TEXT,
  "submittedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "depositedById" TEXT,
  "depositedAt" TIMESTAMP(3),
  "reversalReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashDeposit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashDeposit_tenantId_depositNumber_key" ON "CashDeposit"("tenantId", "depositNumber");
CREATE UNIQUE INDEX "CashDeposit_tenantId_idempotencyKey_key" ON "CashDeposit"("tenantId", "idempotencyKey");
CREATE INDEX "CashDeposit_tenantId_status_depositDate_idx" ON "CashDeposit"("tenantId", "status", "depositDate");
CREATE INDEX "CashDeposit_tenantId_cashierCloseId_idx" ON "CashDeposit"("tenantId", "cashierCloseId");
CREATE INDEX "CashDeposit_tenantId_accountId_depositDate_idx" ON "CashDeposit"("tenantId", "accountId", "depositDate");
CREATE INDEX "CashDeposit_tenantId_journalEntryId_idx" ON "CashDeposit"("tenantId", "journalEntryId");

CREATE TABLE "ReportSavedView" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reportId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedFilters" JSONB NOT NULL DEFAULT '{}',
  "columnConfiguration" JSONB NOT NULL DEFAULT '{}',
  "sortConfiguration" JSONB NOT NULL DEFAULT '{}',
  "requiredPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isShared" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReportSavedView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReportSavedView_tenantId_createdById_reportId_name_key" ON "ReportSavedView"("tenantId", "createdById", "reportId", "name");
CREATE INDEX "ReportSavedView_tenantId_reportId_createdAt_idx" ON "ReportSavedView"("tenantId", "reportId", "createdAt");
CREATE INDEX "ReportSavedView_tenantId_createdById_reportId_idx" ON "ReportSavedView"("tenantId", "createdById", "reportId");

CREATE TABLE "PayrollAccountingSnapshot" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "PayrollAccountingSnapshotStatus" NOT NULL DEFAULT 'FROZEN',
  "sourceTotal" DECIMAL(18,2) NOT NULL,
  "earningTotal" DECIMAL(18,2) NOT NULL,
  "deductionTotal" DECIMAL(18,2) NOT NULL,
  "netPayTotal" DECIMAL(18,2) NOT NULL,
  "liabilityTotal" DECIMAL(18,2) NOT NULL,
  "normalizedSnapshot" JSONB NOT NULL,
  "checksum" TEXT NOT NULL,
  "postingBatchId" TEXT,
  "correctionOfId" TEXT,
  "correctionReason" TEXT,
  "frozenById" TEXT NOT NULL,
  "frozenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollAccountingSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollAccountingSnapshot_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollAccountingSnapshot_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "PayrollAccountingSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PayrollAccountingSnapshot_tenantId_payrollRunId_snapshotVer_key" ON "PayrollAccountingSnapshot"("tenantId", "payrollRunId", "snapshotVersion");
CREATE UNIQUE INDEX "PayrollAccountingSnapshot_tenantId_checksum_key" ON "PayrollAccountingSnapshot"("tenantId", "checksum");
CREATE INDEX "PayrollAccountingSnapshot_tenantId_status_frozenAt_idx" ON "PayrollAccountingSnapshot"("tenantId", "status", "frozenAt");
CREATE INDEX "PayrollAccountingSnapshot_tenantId_fiscalYearId_status_idx" ON "PayrollAccountingSnapshot"("tenantId", "fiscalYearId", "status");
CREATE INDEX "PayrollAccountingSnapshot_tenantId_postingBatchId_idx" ON "PayrollAccountingSnapshot"("tenantId", "postingBatchId");

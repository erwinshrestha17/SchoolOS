DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BankStatement"
    WHERE "journalLineId" IS NOT NULL
    GROUP BY "tenantId", "journalLineId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one-to-one bank reconciliation: duplicate tenant journal-line matches exist';
  END IF;
END $$;

CREATE TABLE "BankStatementImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankStatementImportBatch_tenant_account_fingerprint_key"
ON "BankStatementImportBatch"("tenantId", "accountId", "fingerprint");

CREATE INDEX "BankStatementImportBatch_tenant_account_created_idx"
ON "BankStatementImportBatch"("tenantId", "accountId", "createdAt");

CREATE UNIQUE INDEX "BankStatement_tenantId_journalLineId_key"
ON "BankStatement"("tenantId", "journalLineId");

ALTER TABLE "BankStatementImportBatch"
ADD CONSTRAINT "BankStatementImportBatch_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankStatementImportBatch"
ADD CONSTRAINT "BankStatementImportBatch_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

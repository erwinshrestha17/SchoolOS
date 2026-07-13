-- CreateTable
CREATE TABLE "BankStatementImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
    "totalRows" INTEGER NOT NULL,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "insertedRows" INTEGER,
    "duplicateRows" INTEGER,
    "errorRows" INTEGER,
    "errorSummary" TEXT,
    "fileAssetId" TEXT,
    "importBatchId" TEXT,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BankStatementImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImportJob_tenantId_accountId_createdAt_idx" ON "BankStatementImportJob"("tenantId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "BankStatementImportJob_tenantId_status_idx" ON "BankStatementImportJob"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementImportJob_tenantId_accountId_fingerprint_key" ON "BankStatementImportJob"("tenantId", "accountId", "fingerprint");

-- AddForeignKey
ALTER TABLE "BankStatementImportJob" ADD CONSTRAINT "BankStatementImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementImportJob" ADD CONSTRAINT "BankStatementImportJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AccountingSourceMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "postingType" TEXT NOT NULL DEFAULT 'DEFAULT',
  "debitAccountId" TEXT NOT NULL,
  "creditAccountId" TEXT NOT NULL,
  "description" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,

  CONSTRAINT "AccountingSourceMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingSourceMapping_tenantId_sourceModule_sourceType_postingType_effectiveFrom_key"
  ON "AccountingSourceMapping"("tenantId", "sourceModule", "sourceType", "postingType", "effectiveFrom");

CREATE INDEX "AccountingSourceMapping_tenantId_sourceModule_sourceType_postingType_isActive_idx"
  ON "AccountingSourceMapping"("tenantId", "sourceModule", "sourceType", "postingType", "isActive");

CREATE INDEX "AccountingSourceMapping_tenantId_effectiveFrom_effectiveTo_idx"
  ON "AccountingSourceMapping"("tenantId", "effectiveFrom", "effectiveTo");

CREATE INDEX "AccountingSourceMapping_tenantId_debitAccountId_idx"
  ON "AccountingSourceMapping"("tenantId", "debitAccountId");

CREATE INDEX "AccountingSourceMapping_tenantId_creditAccountId_idx"
  ON "AccountingSourceMapping"("tenantId", "creditAccountId");

ALTER TABLE "AccountingSourceMapping"
  ADD CONSTRAINT "AccountingSourceMapping_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingSourceMapping"
  ADD CONSTRAINT "AccountingSourceMapping_debitAccountId_fkey"
  FOREIGN KEY ("debitAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingSourceMapping"
  ADD CONSTRAINT "AccountingSourceMapping_creditAccountId_fkey"
  FOREIGN KEY ("creditAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountingSourceMapping"
  ADD CONSTRAINT "AccountingSourceMapping_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingSourceMapping"
  ADD CONSTRAINT "AccountingSourceMapping_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

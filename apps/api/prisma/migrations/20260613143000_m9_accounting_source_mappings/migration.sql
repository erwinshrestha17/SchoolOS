CREATE TABLE IF NOT EXISTS "AccountingSourceMapping" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "postingType" TEXT NOT NULL DEFAULT 'DEFAULT',
  "debitAccountId" TEXT NOT NULL,
  "creditAccountId" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  "updatedById" TEXT,
  CONSTRAINT "AccountingSourceMapping_pkey" PRIMARY KEY ("id")
);

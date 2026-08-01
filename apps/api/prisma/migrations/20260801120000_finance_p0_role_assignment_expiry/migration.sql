ALTER TABLE "UserRole"
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "revokedById" TEXT,
  ADD COLUMN "revokeReason" TEXT;

CREATE INDEX "UserRole_tenantId_userId_revokedAt_expiresAt_idx"
  ON "UserRole"("tenantId", "userId", "revokedAt", "expiresAt");

CREATE INDEX "UserRole_tenantId_roleId_revokedAt_expiresAt_idx"
  ON "UserRole"("tenantId", "roleId", "revokedAt", "expiresAt");

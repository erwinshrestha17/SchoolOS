CREATE INDEX IF NOT EXISTS "ReportExport_tenantId_reportKey_createdAt_idx"
  ON "ReportExport"("tenantId", "reportKey", "createdAt");

CREATE INDEX IF NOT EXISTS "ReportExport_tenantId_requestedBy_createdAt_idx"
  ON "ReportExport"("tenantId", "requestedBy", "createdAt");

CREATE INDEX IF NOT EXISTS "ReportExport_tenantId_fileAssetId_idx"
  ON "ReportExport"("tenantId", "fileAssetId");

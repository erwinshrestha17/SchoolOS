-- Links a report export to the canonical P0 financial report catalog.
-- Additive and nullable: existing exports keep their recorded metadata and
-- non-financial exports simply leave it null.
ALTER TABLE "ReportExport" ADD COLUMN "financialReportId" TEXT;

CREATE INDEX "ReportExport_tenantId_financialReportId_createdAt_idx"
  ON "ReportExport" ("tenantId", "financialReportId", "createdAt");

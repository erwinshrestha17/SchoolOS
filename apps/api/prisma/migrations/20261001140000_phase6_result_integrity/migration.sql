-- Phase 6.4 — Result publication and correction integrity.
--
-- * Each report-card version is snapshotted at most once in history, so two
--   concurrent corrections cannot both claim the same prior version.
-- * publishStatus is a closed set, and a PUBLISHED card always records when
--   it was published (parents only ever see PUBLISHED, current cards).
-- Existing data is reported, never rewritten.

DO $$
DECLARE
  dup_count integer;
  bad_status_count integer;
  unpublished_time_count integer;
BEGIN
  SELECT count(*) INTO dup_count FROM (
    SELECT 1 FROM "ReportCardHistory"
    GROUP BY "tenantId", "reportCardId", "version"
    HAVING count(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 result preflight: % report card version(s) have duplicate history rows', dup_count
      USING HINT = 'Reconcile the duplicated ReportCardHistory rows (keep the earliest snapshot per version) before re-running.';
  END IF;

  SELECT count(*) INTO bad_status_count FROM "ReportCard"
  WHERE "publishStatus" IS NOT NULL
    AND "publishStatus" NOT IN ('UNPUBLISHED', 'READY', 'PUBLISHED', 'CORRECTED_DRAFT');
  IF bad_status_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 result preflight: % report card(s) have an unknown publishStatus', bad_status_count;
  END IF;

  SELECT count(*) INTO unpublished_time_count FROM "ReportCard"
  WHERE "publishStatus" = 'PUBLISHED' AND "publishedAt" IS NULL;
  IF unpublished_time_count > 0 THEN
    RAISE EXCEPTION 'Phase 6 result preflight: % published report card(s) have no publishedAt', unpublished_time_count
      USING HINT = 'Set publishedAt from the publication audit log for these cards, then re-run.';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "ReportCardHistory_tenantId_reportCardId_version_key" ON "ReportCardHistory"("tenantId", "reportCardId", "version");

ALTER TABLE "ReportCard"
  ADD CONSTRAINT "ReportCard_publish_status_check" CHECK (
    "publishStatus" IS NULL
    OR "publishStatus" IN ('UNPUBLISHED', 'READY', 'PUBLISHED', 'CORRECTED_DRAFT')
  ),
  ADD CONSTRAINT "ReportCard_published_has_time_check" CHECK (
    "publishStatus" IS DISTINCT FROM 'PUBLISHED' OR "publishedAt" IS NOT NULL
  );

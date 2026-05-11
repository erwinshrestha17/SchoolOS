-- M8A Library Management hardening guardrails.
-- Enforces tenant ownership, barcode uniqueness, copy lifecycle, issue/return integrity,
-- fine invoice linkage, and backend report indexes.

ALTER TABLE "LibraryBook"
ADD COLUMN IF NOT EXISTS "archivedAt" timestamp,
ADD COLUMN IF NOT EXISTS "archiveReason" text;

CREATE OR REPLACE FUNCTION "enforce_library_book_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."title"), '') = '' THEN
    RAISE EXCEPTION 'Library book title is required';
  END IF;

  IF COALESCE(TRIM(NEW."author"), '') = '' THEN
    RAISE EXCEPTION 'Library book author is required';
  END IF;

  IF NEW."purchasePrice" IS NOT NULL AND NEW."purchasePrice" < 0 THEN
    RAISE EXCEPTION 'Library book purchase price cannot be negative';
  END IF;

  IF NEW."archivedAt" IS NOT NULL AND COALESCE(TRIM(NEW."archiveReason"), '') = '' THEN
    RAISE EXCEPTION 'Library book archive reason is required';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "library_book_guard" ON "LibraryBook";
CREATE TRIGGER "library_book_guard"
BEFORE INSERT OR UPDATE
ON "LibraryBook"
FOR EACH ROW
EXECUTE FUNCTION "enforce_library_book_guard"();

CREATE OR REPLACE FUNCTION "enforce_library_copy_guard"()
RETURNS trigger AS $$
DECLARE
  book_tenant_id text;
  active_issue_id text;
BEGIN
  SELECT "tenantId" INTO book_tenant_id FROM "LibraryBook" WHERE "id" = NEW."bookId";

  IF book_tenant_id IS NULL OR book_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Library copy book is missing or outside tenant';
  END IF;

  IF COALESCE(TRIM(NEW."barcode"), '') = '' THEN
    RAISE EXCEPTION 'Library copy barcode is required';
  END IF;

  IF NEW."status" NOT IN ('AVAILABLE', 'ISSUED', 'LOST', 'DAMAGED', 'RESERVED') THEN
    RAISE EXCEPTION 'Invalid library copy status';
  END IF;

  IF NEW."replacementCost" IS NOT NULL AND NEW."replacementCost" < 0 THEN
    RAISE EXCEPTION 'Library copy replacement cost cannot be negative';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'ISSUED' AND NEW."status" = 'AVAILABLE' THEN
    SELECT "id" INTO active_issue_id
    FROM "LibraryIssue"
    WHERE "tenantId" = NEW."tenantId"
      AND "copyId" = NEW."id"
      AND "status" = 'ISSUED'
    LIMIT 1;

    IF active_issue_id IS NOT NULL THEN
      RAISE EXCEPTION 'Issued copy cannot be marked available without return workflow';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "library_copy_guard" ON "LibraryCopy";
CREATE TRIGGER "library_copy_guard"
BEFORE INSERT OR UPDATE
ON "LibraryCopy"
FOR EACH ROW
EXECUTE FUNCTION "enforce_library_copy_guard"();

CREATE OR REPLACE FUNCTION "enforce_library_issue_guard"()
RETURNS trigger AS $$
DECLARE
  copy_tenant_id text;
  copy_status text;
  student_tenant_id text;
  staff_tenant_id text;
  active_issue_id text;
  invoice_tenant_id text;
BEGIN
  SELECT "tenantId", "status"::text INTO copy_tenant_id, copy_status FROM "LibraryCopy" WHERE "id" = NEW."copyId";

  IF copy_tenant_id IS NULL OR copy_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Library issue copy is missing or outside tenant';
  END IF;

  IF NEW."borrowerStudentId" IS NULL AND NEW."borrowerStaffId" IS NULL THEN
    RAISE EXCEPTION 'Library issue requires a student or staff borrower';
  END IF;

  IF NEW."borrowerStudentId" IS NOT NULL AND NEW."borrowerStaffId" IS NOT NULL THEN
    RAISE EXCEPTION 'Library issue borrower must be either student or staff, not both';
  END IF;

  IF NEW."borrowerStudentId" IS NOT NULL THEN
    SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."borrowerStudentId";
    IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Library issue borrower student is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."borrowerStaffId" IS NOT NULL THEN
    SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."borrowerStaffId";
    IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Library issue borrower staff is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."dueAt" < NEW."issuedAt" THEN
    RAISE EXCEPTION 'Library issue due date cannot be before issue date';
  END IF;

  IF NEW."status" NOT IN ('ISSUED', 'RETURNED', 'LOST') THEN
    RAISE EXCEPTION 'Invalid library issue status';
  END IF;

  IF NEW."fineAmount" IS NOT NULL AND NEW."fineAmount" < 0 THEN
    RAISE EXCEPTION 'Library fine amount cannot be negative';
  END IF;

  IF NEW."status" = 'ISSUED' THEN
    SELECT "id" INTO active_issue_id
    FROM "LibraryIssue"
    WHERE "tenantId" = NEW."tenantId"
      AND "copyId" = NEW."copyId"
      AND "status" = 'ISSUED'
      AND "id" <> COALESCE(NEW."id", '')
    LIMIT 1;

    IF active_issue_id IS NOT NULL THEN
      RAISE EXCEPTION 'Active library issue already exists for this copy';
    END IF;
  END IF;

  IF NEW."invoiceId" IS NOT NULL THEN
    SELECT "tenantId" INTO invoice_tenant_id FROM "Invoice" WHERE "id" = NEW."invoiceId";
    IF invoice_tenant_id IS NULL OR invoice_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Library fine invoice is missing or outside tenant';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('RETURNED', 'LOST') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Closed library issue cannot transition silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "library_issue_guard" ON "LibraryIssue";
CREATE TRIGGER "library_issue_guard"
BEFORE INSERT OR UPDATE
ON "LibraryIssue"
FOR EACH ROW
EXECUTE FUNCTION "enforce_library_issue_guard"();

CREATE UNIQUE INDEX IF NOT EXISTS "LibraryCopy_tenant_barcode_uidx"
ON "LibraryCopy" ("tenantId", "barcode");

CREATE UNIQUE INDEX IF NOT EXISTS "LibraryIssue_tenant_copy_active_uidx"
ON "LibraryIssue" ("tenantId", "copyId")
WHERE "status" = 'ISSUED';

CREATE INDEX IF NOT EXISTS "LibraryBook_tenant_search_idx"
ON "LibraryBook" ("tenantId", "title", "author", "isbn", "subjectCategory");

CREATE INDEX IF NOT EXISTS "LibraryBook_tenant_archived_idx"
ON "LibraryBook" ("tenantId", "archivedAt");

CREATE INDEX IF NOT EXISTS "LibraryCopy_tenant_book_status_idx"
ON "LibraryCopy" ("tenantId", "bookId", "status");

CREATE INDEX IF NOT EXISTS "LibraryIssue_tenant_status_due_idx"
ON "LibraryIssue" ("tenantId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "LibraryIssue_tenant_student_idx"
ON "LibraryIssue" ("tenantId", "borrowerStudentId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "LibraryIssue_tenant_staff_idx"
ON "LibraryIssue" ("tenantId", "borrowerStaffId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "LibraryIssue_tenant_invoice_idx"
ON "LibraryIssue" ("tenantId", "invoiceId");

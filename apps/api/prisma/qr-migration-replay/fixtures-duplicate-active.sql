-- QR credential migration replay: DUPLICATE-ACTIVE failure dataset (Case E).
-- Temporary test fixture - isolated ids, safe to drop. Apply against the
-- PRE-QR baseline (before migration 20260712160000_student_qr_protected_artifact).
--
-- This dataset intentionally violates the new invariant "at most one ACTIVE
-- credential per (tenantId, studentId)". It must be tested in its own
-- disposable database, separate from the valid dataset, because a
-- CREATE UNIQUE INDEX statement fails for the whole table on any violation -
-- mixing it with valid rows would falsely fail unrelated cases.

BEGIN;

INSERT INTO "Tenant" (id, name, slug, mode, plan, "isActive", "createdAt")
VALUES ('ten-qr-replay-dup', 'QR Replay Duplicate Tenant', 'qr-replay-tenant-dup', 'MULTI', 'standard', true, now());

INSERT INTO "Class" (id, "tenantId", name, level)
VALUES ('cls-qr-replay-dup', 'ten-qr-replay-dup', 'QR Replay Duplicate Class', 5);

INSERT INTO "Student" (
  id, "tenantId", "studentSystemId", "firstNameEn", "lastNameEn",
  "dateOfBirth", gender, "admissionDate", "classId", "updatedAt"
)
VALUES (
  'stu-qr-case-e', 'ten-qr-replay-dup', 'QR-CASE-E', 'CaseE', 'DuplicateActive',
  '2015-01-01', 'MALE', now(), 'cls-qr-replay-dup', now()
);

-- Two ACTIVE credentials for the SAME tenant + student: this is exactly the
-- state the new partial unique index must reject.
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt")
VALUES
  ('cred-qr-case-e-active-1', 'ten-qr-replay-dup', 'stu-qr-case-e', 'hash-case-e-active-1', 'ACTIVE', now() - interval '10 days'),
  ('cred-qr-case-e-active-2', 'ten-qr-replay-dup', 'stu-qr-case-e', 'hash-case-e-active-2', 'ACTIVE', now() - interval '1 days');

COMMIT;

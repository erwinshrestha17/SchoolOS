-- QR credential migration replay: VALID legacy dataset.
-- Temporary test fixture for validating migration
-- 20260712160000_student_qr_protected_artifact against representative legacy
-- data. Not development seed data - isolated ids, safe to drop.
--
-- Apply against the PRE-QR baseline (all migrations up to and including
-- 20260525090000_student_qr_credential_history, before the partial unique
-- index migration). Every case below must migrate successfully.
--
-- NOTE: StudentQrStatus only has ACTIVE, ROTATED, REVOKED (see
-- apps/api/prisma/schema/enums.prisma). The task's "EXPIRED" rows have no
-- corresponding enum value, so they are modeled as ROTATED credentials
-- (the real "superseded/no-longer-current" status) with an "expiresAt" in
-- the past, using the real "expiresAt" column added by migration
-- 20260525090000. No schema value is invented.

BEGIN;

-- Two tenants to prove tenant scoping (Case F, G).
INSERT INTO "Tenant" (id, name, slug, mode, plan, "isActive", "createdAt")
VALUES
  ('ten-qr-replay-a', 'QR Replay Tenant A', 'qr-replay-tenant-a', 'MULTI', 'standard', true, now()),
  ('ten-qr-replay-b', 'QR Replay Tenant B', 'qr-replay-tenant-b', 'MULTI', 'standard', true, now());

INSERT INTO "Class" (id, "tenantId", name, level)
VALUES
  ('cls-qr-replay-a', 'ten-qr-replay-a', 'QR Replay Class A', 5),
  ('cls-qr-replay-b', 'ten-qr-replay-b', 'QR Replay Class B', 5);

-- One student per scenario. All in Tenant A unless testing cross-tenant (F).
INSERT INTO "Student" (
  id, "tenantId", "studentSystemId", "firstNameEn", "lastNameEn",
  "dateOfBirth", gender, "admissionDate", "classId", "updatedAt"
)
VALUES
  ('stu-qr-case-a',  'ten-qr-replay-a', 'QR-CASE-A',  'CaseA',  'NoCredentials', '2015-01-01', 'MALE',   now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-b',  'ten-qr-replay-a', 'QR-CASE-B',  'CaseB',  'OneActive',     '2015-01-01', 'FEMALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-c',  'ten-qr-replay-a', 'QR-CASE-C',  'CaseC',  'HistoryOnly',   '2015-01-01', 'MALE',   now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-d',  'ten-qr-replay-a', 'QR-CASE-D',  'CaseD',  'ActivePlusHistory', '2015-01-01', 'FEMALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-g',  'ten-qr-replay-a', 'QR-CASE-G',  'CaseG',  'SecondActiveSameTenant', '2015-01-01', 'MALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-h',  'ten-qr-replay-a', 'QR-CASE-H',  'CaseH',  'RevokedDuplicates', '2015-01-01', 'FEMALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-i',  'ten-qr-replay-a', 'QR-CASE-I',  'CaseI',  'RotatedExpiredDuplicates', '2015-01-01', 'MALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-f-a', 'ten-qr-replay-a', 'QR-CASE-F-CROSS', 'CaseF', 'CrossTenantA', '2015-01-01', 'FEMALE', now(), 'cls-qr-replay-a', now()),
  ('stu-qr-case-f-b', 'ten-qr-replay-b', 'QR-CASE-F-CROSS', 'CaseF', 'CrossTenantB', '2015-01-01', 'FEMALE', now(), 'cls-qr-replay-b', now());

-- Case A: no credentials at all for stu-qr-case-a (no rows inserted).

-- Case B: one ACTIVE + one REVOKED (history).
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "revokedAt", "revokeReason")
VALUES
  ('cred-qr-case-b-revoked', 'ten-qr-replay-a', 'stu-qr-case-b', 'hash-case-b-revoked', 'REVOKED', now() - interval '30 days', now() - interval '20 days', 'Superseded during onboarding cleanup'),
  ('cred-qr-case-b-active',  'ten-qr-replay-a', 'stu-qr-case-b', 'hash-case-b-active',  'ACTIVE',  now() - interval '10 days', NULL, NULL);

-- Case C: historical only - 0 ACTIVE, 2 REVOKED, 2 ROTATED-with-past-expiresAt ("expired").
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "revokedAt", "revokeReason")
VALUES
  ('cred-qr-case-c-revoked-1', 'ten-qr-replay-a', 'stu-qr-case-c', 'hash-case-c-revoked-1', 'REVOKED', now() - interval '90 days', now() - interval '80 days', 'Lost card'),
  ('cred-qr-case-c-revoked-2', 'ten-qr-replay-a', 'stu-qr-case-c', 'hash-case-c-revoked-2', 'REVOKED', now() - interval '70 days', now() - interval '60 days', 'Reissued incorrectly');
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "rotatedAt", "rotateReason", "expiresAt")
VALUES
  ('cred-qr-case-c-rotated-1', 'ten-qr-replay-a', 'stu-qr-case-c', 'hash-case-c-rotated-1', 'ROTATED', now() - interval '50 days', now() - interval '40 days', 'Annual rotation', now() - interval '35 days'),
  ('cred-qr-case-c-rotated-2', 'ten-qr-replay-a', 'stu-qr-case-c', 'hash-case-c-rotated-2', 'ROTATED', now() - interval '30 days', now() - interval '20 days', 'Annual rotation', now() - interval '15 days');

-- Case D: 1 ACTIVE + 2 REVOKED + 2 ROTATED-with-past-expiresAt ("expired") history.
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "revokedAt", "revokeReason")
VALUES
  ('cred-qr-case-d-revoked-1', 'ten-qr-replay-a', 'stu-qr-case-d', 'hash-case-d-revoked-1', 'REVOKED', now() - interval '90 days', now() - interval '85 days', 'Lost card'),
  ('cred-qr-case-d-revoked-2', 'ten-qr-replay-a', 'stu-qr-case-d', 'hash-case-d-revoked-2', 'REVOKED', now() - interval '70 days', now() - interval '65 days', 'Damaged card');
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "rotatedAt", "rotateReason", "expiresAt")
VALUES
  ('cred-qr-case-d-rotated-1', 'ten-qr-replay-a', 'stu-qr-case-d', 'hash-case-d-rotated-1', 'ROTATED', now() - interval '50 days', now() - interval '45 days', 'Annual rotation', now() - interval '40 days'),
  ('cred-qr-case-d-rotated-2', 'ten-qr-replay-a', 'stu-qr-case-d', 'hash-case-d-rotated-2', 'ROTATED', now() - interval '30 days', now() - interval '25 days', 'Annual rotation', now() - interval '20 days');
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt")
VALUES
  ('cred-qr-case-d-active', 'ten-qr-replay-a', 'stu-qr-case-d', 'hash-case-d-active', 'ACTIVE', now() - interval '5 days');

-- Case G: a second student in the SAME tenant (A) also holding an ACTIVE
-- credential, proving uniqueness is scoped per (tenant, student), not
-- tenant-wide. (stu-qr-case-b above is the first ACTIVE credential in tenant A.)
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt")
VALUES
  ('cred-qr-case-g-active', 'ten-qr-replay-a', 'stu-qr-case-g', 'hash-case-g-active', 'ACTIVE', now() - interval '2 days');

-- Case H: multiple REVOKED credentials, no ACTIVE.
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "revokedAt", "revokeReason")
VALUES
  ('cred-qr-case-h-revoked-1', 'ten-qr-replay-a', 'stu-qr-case-h', 'hash-case-h-revoked-1', 'REVOKED', now() - interval '60 days', now() - interval '55 days', 'Lost card'),
  ('cred-qr-case-h-revoked-2', 'ten-qr-replay-a', 'stu-qr-case-h', 'hash-case-h-revoked-2', 'REVOKED', now() - interval '40 days', now() - interval '35 days', 'Lost card again'),
  ('cred-qr-case-h-revoked-3', 'ten-qr-replay-a', 'stu-qr-case-h', 'hash-case-h-revoked-3', 'REVOKED', now() - interval '20 days', now() - interval '15 days', 'Damaged card');

-- Case I: multiple ROTATED-with-past-expiresAt ("expired") credentials, no ACTIVE.
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt", "rotatedAt", "rotateReason", "expiresAt")
VALUES
  ('cred-qr-case-i-rotated-1', 'ten-qr-replay-a', 'stu-qr-case-i', 'hash-case-i-rotated-1', 'ROTATED', now() - interval '90 days', now() - interval '80 days', 'Annual rotation', now() - interval '75 days'),
  ('cred-qr-case-i-rotated-2', 'ten-qr-replay-a', 'stu-qr-case-i', 'hash-case-i-rotated-2', 'ROTATED', now() - interval '70 days', now() - interval '60 days', 'Annual rotation', now() - interval '55 days'),
  ('cred-qr-case-i-rotated-3', 'ten-qr-replay-a', 'stu-qr-case-i', 'hash-case-i-rotated-3', 'ROTATED', now() - interval '50 days', now() - interval '40 days', 'Annual rotation', now() - interval '35 days');

-- Case F: same look-alike student identifier ("QR-CASE-F-CROSS"), but
-- distinct database ids and distinct tenants, each with one ACTIVE
-- credential. Must NOT collide.
INSERT INTO "StudentQrCredential" (id, "tenantId", "studentId", "tokenHash", status, "createdAt")
VALUES
  ('cred-qr-case-f-a-active', 'ten-qr-replay-a', 'stu-qr-case-f-a', 'hash-case-f-a-active', 'ACTIVE', now() - interval '3 days'),
  ('cred-qr-case-f-b-active', 'ten-qr-replay-b', 'stu-qr-case-f-b', 'hash-case-f-b-active', 'ACTIVE', now() - interval '3 days');

COMMIT;

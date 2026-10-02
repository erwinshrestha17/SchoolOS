-- Phase 7.2 — restricted staff document categories.
--
-- Additive only: existing StaffDocument rows keep their kind. Reading or
-- managing a MEDICAL, DISCIPLINARY or SAFEGUARDING document additionally
-- requires hr:medical:*, hr:disciplinary:* or hr:safeguarding:* respectively
-- (enforced in the API for list, detail, timeline and signed file access).
-- Rollback: enum values cannot be dropped; leaving them unused is harmless.
ALTER TYPE "StaffDocumentKind" ADD VALUE IF NOT EXISTS 'MEDICAL';
ALTER TYPE "StaffDocumentKind" ADD VALUE IF NOT EXISTS 'DISCIPLINARY';
ALTER TYPE "StaffDocumentKind" ADD VALUE IF NOT EXISTS 'SAFEGUARDING';

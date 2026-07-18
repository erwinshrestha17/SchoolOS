-- Persist M1 duplicate-review dispositions so known false-positive pairs stay
-- out of the pending queue until a reviewer deliberately reopens them.

CREATE TYPE "StudentDuplicateReviewStatus" AS ENUM (
  'NOT_DUPLICATE',
  'REOPENED'
);

CREATE TABLE "StudentDuplicateReview" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "firstStudentId" TEXT NOT NULL,
  "secondStudentId" TEXT NOT NULL,
  "status" "StudentDuplicateReviewStatus" NOT NULL DEFAULT 'NOT_DUPLICATE',
  "reason" TEXT NOT NULL,
  "identityFingerprint" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reopenedById" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentDuplicateReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentDuplicateReview_canonical_pair_check"
    CHECK ("firstStudentId" < "secondStudentId"),
  CONSTRAINT "StudentDuplicateReview_reason_check"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "StudentDuplicateReview_identity_fingerprint_check"
    CHECK (length(btrim("identityFingerprint")) > 0),
  CONSTRAINT "StudentDuplicateReview_reopened_metadata_check"
    CHECK (
      "status" <> 'REOPENED'::"StudentDuplicateReviewStatus"
      OR (
        "reopenedAt" IS NOT NULL
        AND "reopenReason" IS NOT NULL
        AND length(btrim("reopenReason")) > 0
      )
    )
);

CREATE UNIQUE INDEX "StudentDuplicateReview_tenantId_firstStudentId_secondStudentId_key"
  ON "StudentDuplicateReview"("tenantId", "firstStudentId", "secondStudentId");
CREATE INDEX "StudentDuplicateReview_tenantId_status_reviewedAt_idx"
  ON "StudentDuplicateReview"("tenantId", "status", "reviewedAt");
CREATE INDEX "StudentDuplicateReview_tenantId_firstStudentId_idx"
  ON "StudentDuplicateReview"("tenantId", "firstStudentId");
CREATE INDEX "StudentDuplicateReview_tenantId_secondStudentId_idx"
  ON "StudentDuplicateReview"("tenantId", "secondStudentId");

CREATE INDEX "Student_tenantId_lifecycleStatus_dateOfBirth_idx"
  ON "Student"("tenantId", "lifecycleStatus", "dateOfBirth");
CREATE INDEX "Student_tenantId_lifecycleStatus_firstNameEn_lastNameEn_idx"
  ON "Student"("tenantId", "lifecycleStatus", "firstNameEn", "lastNameEn");
CREATE INDEX "StudentGuardian_tenantId_guardianId_studentId_idx"
  ON "StudentGuardian"("tenantId", "guardianId", "studentId");

ALTER TABLE "StudentDuplicateReview"
  ADD CONSTRAINT "StudentDuplicateReview_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentDuplicateReview"
  ADD CONSTRAINT "StudentDuplicateReview_firstStudentId_fkey"
  FOREIGN KEY ("firstStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentDuplicateReview"
  ADD CONSTRAINT "StudentDuplicateReview_secondStudentId_fkey"
  FOREIGN KEY ("secondStudentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentDuplicateReview"
  ADD CONSTRAINT "StudentDuplicateReview_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentDuplicateReview"
  ADD CONSTRAINT "StudentDuplicateReview_reopenedById_fkey"
  FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

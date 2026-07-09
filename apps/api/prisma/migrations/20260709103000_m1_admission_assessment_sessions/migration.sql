-- M1 Admissions assessment/interview scheduling.
-- One active assessment/interview session is tracked per admission case; audit logs
-- preserve reschedule and result history.

CREATE TABLE "AdmissionAssessmentSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "admissionCaseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "mode" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "location" TEXT,
    "notes" TEXT,
    "interviewerUserId" TEXT,
    "result" TEXT,
    "resultNotes" TEXT,
    "resultScore" INTEGER,
    "resultRecordedAt" TIMESTAMP(3),
    "resultRecordedById" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionAssessmentSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdmissionAssessmentSession_tenantId_admissionCaseId_key"
    ON "AdmissionAssessmentSession"("tenantId", "admissionCaseId");

CREATE INDEX "AdmissionAssessmentSession_tenantId_status_scheduledAt_idx"
    ON "AdmissionAssessmentSession"("tenantId", "status", "scheduledAt");

CREATE INDEX "AdmissionAssessmentSession_tenantId_interviewerUserId_scheduledAt_idx"
    ON "AdmissionAssessmentSession"("tenantId", "interviewerUserId", "scheduledAt");

CREATE INDEX "AdmissionAssessmentSession_tenantId_admissionCaseId_idx"
    ON "AdmissionAssessmentSession"("tenantId", "admissionCaseId");

ALTER TABLE "AdmissionAssessmentSession"
    ADD CONSTRAINT "AdmissionAssessmentSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdmissionAssessmentSession"
    ADD CONSTRAINT "AdmissionAssessmentSession_admissionCaseId_fkey"
    FOREIGN KEY ("admissionCaseId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

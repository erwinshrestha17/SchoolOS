-- P0-02: Link TeacherDelegation to TimetableSubstitution; long-term replacement + handover.

-- CreateEnum
CREATE TYPE "TeacherReplacementStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeacherReplacementPendingWorkKind" AS ENUM ('HOMEWORK_DRAFT', 'MARK_SUBMISSION', 'CORRECTION_REQUEST');

-- CreateEnum
CREATE TYPE "TeacherReplacementPendingWorkDisposition" AS ENUM ('TRANSFER', 'RETURN', 'CANCEL');

-- CreateEnum
CREATE TYPE "TeacherHandoverNoteKind" AS ENUM ('SUBSTITUTION_COVERAGE', 'REPLACEMENT_HANDOVER');

-- AlterTable
ALTER TABLE "TeacherDelegation" ADD COLUMN "timetableSubstitutionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDelegation_timetableSubstitutionId_key" ON "TeacherDelegation"("timetableSubstitutionId");

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_timetableSubstitutionId_fkey" FOREIGN KEY ("timetableSubstitutionId") REFERENCES "TimetableSubstitution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "TeacherReplacement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "sourceAssignmentId" TEXT NOT NULL,
    "formerStaffId" TEXT NOT NULL,
    "replacementStaffId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "assignmentType" "TeacherAssignmentType" NOT NULL,
    "componentScope" "TeacherAssignmentComponentScope",
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TeacherReplacementStatus" NOT NULL DEFAULT 'SCHEDULED',
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdById" TEXT,
    "activatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "replacementAssignmentId" TEXT,

    CONSTRAINT "TeacherReplacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherReplacementPendingWork" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "replacementId" TEXT NOT NULL,
    "kind" "TeacherReplacementPendingWorkKind" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceLabel" TEXT,
    "disposition" "TeacherReplacementPendingWorkDisposition",
    "dispositionNote" TEXT,
    "disposedAt" TIMESTAMP(3),
    "disposedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherReplacementPendingWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHandoverNote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "TeacherHandoverNoteKind" NOT NULL,
    "substitutionId" TEXT,
    "replacementId" TEXT,
    "authorStaffId" TEXT,
    "body" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherHandoverNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherReplacement_replacementAssignmentId_key" ON "TeacherReplacement"("replacementAssignmentId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_tenantId_status_effectiveFrom_idx" ON "TeacherReplacement"("tenantId", "status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TeacherReplacement_tenantId_formerStaffId_idx" ON "TeacherReplacement"("tenantId", "formerStaffId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_tenantId_replacementStaffId_idx" ON "TeacherReplacement"("tenantId", "replacementStaffId");

-- CreateIndex
CREATE INDEX "TeacherReplacement_tenantId_sourceAssignmentId_idx" ON "TeacherReplacement"("tenantId", "sourceAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherReplacementPendingWork_tenantId_replacementId_kind_resourceId_key" ON "TeacherReplacementPendingWork"("tenantId", "replacementId", "kind", "resourceId");

-- CreateIndex
CREATE INDEX "TeacherReplacementPendingWork_tenantId_replacementId_disposition_idx" ON "TeacherReplacementPendingWork"("tenantId", "replacementId", "disposition");

-- CreateIndex
CREATE INDEX "TeacherHandoverNote_tenantId_substitutionId_idx" ON "TeacherHandoverNote"("tenantId", "substitutionId");

-- CreateIndex
CREATE INDEX "TeacherHandoverNote_tenantId_replacementId_idx" ON "TeacherHandoverNote"("tenantId", "replacementId");

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_sourceAssignmentId_fkey" FOREIGN KEY ("sourceAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_replacementAssignmentId_fkey" FOREIGN KEY ("replacementAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_formerStaffId_fkey" FOREIGN KEY ("formerStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_replacementStaffId_fkey" FOREIGN KEY ("replacementStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacement" ADD CONSTRAINT "TeacherReplacement_activatedById_fkey" FOREIGN KEY ("activatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacementPendingWork" ADD CONSTRAINT "TeacherReplacementPendingWork_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacementPendingWork" ADD CONSTRAINT "TeacherReplacementPendingWork_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "TeacherReplacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReplacementPendingWork" ADD CONSTRAINT "TeacherReplacementPendingWork_disposedById_fkey" FOREIGN KEY ("disposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHandoverNote" ADD CONSTRAINT "TeacherHandoverNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHandoverNote" ADD CONSTRAINT "TeacherHandoverNote_substitutionId_fkey" FOREIGN KEY ("substitutionId") REFERENCES "TimetableSubstitution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHandoverNote" ADD CONSTRAINT "TeacherHandoverNote_replacementId_fkey" FOREIGN KEY ("replacementId") REFERENCES "TeacherReplacement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHandoverNote" ADD CONSTRAINT "TeacherHandoverNote_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHandoverNote" ADD CONSTRAINT "TeacherHandoverNote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

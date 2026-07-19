-- Canonical Teacher assignment + delegation model (Teacher Persona spec
-- sections 4 & 18). Section.classTeacherId and SubjectTeacherAssignment are
-- left untouched for backward compatibility; see
-- prisma/seed-teacher-assignment-backfill.ts for the one-time backfill into
-- this table, and TeacherScopeService for the canonical authorization reader.

-- CreateEnum
CREATE TYPE "TeacherAssignmentType" AS ENUM ('CLASS_TEACHER', 'SUBJECT_TEACHER', 'ASSISTANT_TEACHER', 'SUBSTITUTE_TEACHER', 'EXAM_INVIGILATOR', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "TeacherAssignmentComponentScope" AS ENUM ('THEORY', 'PRACTICAL', 'INTERNAL', 'PROJECT', 'ALL_COMPONENTS');

-- CreateEnum
CREATE TYPE "TeacherAssignmentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TeacherDelegationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "assignmentType" "TeacherAssignmentType" NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "componentScope" "TeacherAssignmentComponentScope",
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3),
    "status" "TeacherAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherDelegation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "grantorStaffId" TEXT NOT NULL,
    "recipientStaffId" TEXT NOT NULL,
    "sourceAssignmentId" TEXT,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "componentScope" "TeacherAssignmentComponentScope",
    "allowedCapabilities" TEXT[],
    "reason" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveUntil" TIMESTAMP(3) NOT NULL,
    "status" "TeacherDelegationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherDelegation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherAssignment_tenantId_staffId_academicYearId_status_idx" ON "TeacherAssignment"("tenantId", "staffId", "academicYearId", "status");

-- CreateIndex
CREATE INDEX "TeacherAssignment_tenantId_classId_sectionId_status_idx" ON "TeacherAssignment"("tenantId", "classId", "sectionId", "status");

-- CreateIndex
CREATE INDEX "TeacherAssignment_tenantId_subjectId_idx" ON "TeacherAssignment"("tenantId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_tenantId_academicYearId_status_effectiveU_idx" ON "TeacherAssignment"("tenantId", "academicYearId", "status", "effectiveUntil");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_tenantId_academicYearId_staffId_assignmen_key" ON "TeacherAssignment"("tenantId", "academicYearId", "staffId", "assignmentType", "classId", "sectionId", "subjectId", "componentScope");

-- CreateIndex
CREATE INDEX "TeacherDelegation_tenantId_recipientStaffId_status_effectiv_idx" ON "TeacherDelegation"("tenantId", "recipientStaffId", "status", "effectiveUntil");

-- CreateIndex
CREATE INDEX "TeacherDelegation_tenantId_grantorStaffId_idx" ON "TeacherDelegation"("tenantId", "grantorStaffId");

-- CreateIndex
CREATE INDEX "TeacherDelegation_tenantId_classId_sectionId_idx" ON "TeacherDelegation"("tenantId", "classId", "sectionId");

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_grantorStaffId_fkey" FOREIGN KEY ("grantorStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_recipientStaffId_fkey" FOREIGN KEY ("recipientStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_sourceAssignmentId_fkey" FOREIGN KEY ("sourceAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherDelegation" ADD CONSTRAINT "TeacherDelegation_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

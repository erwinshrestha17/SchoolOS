-- CreateTable
CREATE TABLE "AttendanceDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "sectionId" TEXT,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "serverVersion" INTEGER NOT NULL DEFAULT 1,
    "payloadHash" TEXT,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDraft_tenantId_userId_classId_sectionId_attendanceDate_key" ON "AttendanceDraft"("tenantId", "userId", "classId", "sectionId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceDraft_tenantId_userId_lastSavedAt_idx" ON "AttendanceDraft"("tenantId", "userId", "lastSavedAt");

-- CreateIndex
CREATE INDEX "AttendanceDraft_tenantId_academicYearId_classId_sectionId_attendanceDate_idx" ON "AttendanceDraft"("tenantId", "academicYearId", "classId", "sectionId", "attendanceDate");

-- CreateIndex
CREATE INDEX "AttendanceDraft_tenantId_expiresAt_idx" ON "AttendanceDraft"("tenantId", "expiresAt");

-- AddForeignKey
ALTER TABLE "AttendanceDraft" ADD CONSTRAINT "AttendanceDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDraft" ADD CONSTRAINT "AttendanceDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDraft" ADD CONSTRAINT "AttendanceDraft_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDraft" ADD CONSTRAINT "AttendanceDraft_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDraft" ADD CONSTRAINT "AttendanceDraft_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

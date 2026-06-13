-- M8A Library backend hardening: metadata, copy history, borrower policies, reservations, and holiday-aware fine settings.

ALTER TABLE "LibraryBook"
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "edition" TEXT,
  ADD COLUMN "language" TEXT,
  ADD COLUMN "deweyDecimal" TEXT,
  ADD COLUMN "materialType" TEXT,
  ADD COLUMN "keywords" JSONB,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "coverImageUrl" TEXT;

ALTER TABLE "LibraryCopy"
  ADD COLUMN "acquisitionSource" TEXT,
  ADD COLUMN "conditionNote" TEXT,
  ADD COLUMN "lastInventoryAt" TIMESTAMP(3);

ALTER TABLE "LibrarySetting"
  ADD COLUMN "maxBooksPerStudent" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "maxBooksPerStaff" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN "studentLoanDays" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "staffLoanDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "includeHolidaysInFine" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reservationHoldDays" INTEGER NOT NULL DEFAULT 3;

CREATE UNIQUE INDEX "LibraryCopy_tenantId_qrCode_key" ON "LibraryCopy"("tenantId", "qrCode");
CREATE INDEX "LibraryBook_tenantId_materialType_idx" ON "LibraryBook"("tenantId", "materialType");
CREATE INDEX "LibraryCopy_tenantId_qrCode_idx" ON "LibraryCopy"("tenantId", "qrCode");

CREATE TABLE "LibraryReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookId" TEXT NOT NULL,
  "copyId" TEXT,
  "borrowerStudentId" TEXT,
  "borrowerStaffId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "fulfilledIssueId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LibraryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LibraryCopyHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "copyId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "statusBefore" TEXT,
  "statusAfter" TEXT,
  "reason" TEXT,
  "actorUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryCopyHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LibraryReservation_tenantId_bookId_status_expiresAt_idx" ON "LibraryReservation"("tenantId", "bookId", "status", "expiresAt");
CREATE INDEX "LibraryReservation_tenantId_copyId_status_idx" ON "LibraryReservation"("tenantId", "copyId", "status");
CREATE INDEX "LibraryReservation_tenantId_borrowerStudentId_status_idx" ON "LibraryReservation"("tenantId", "borrowerStudentId", "status");
CREATE INDEX "LibraryReservation_tenantId_borrowerStaffId_status_idx" ON "LibraryReservation"("tenantId", "borrowerStaffId", "status");
CREATE INDEX "LibraryCopyHistory_tenantId_copyId_createdAt_idx" ON "LibraryCopyHistory"("tenantId", "copyId", "createdAt");
CREATE INDEX "LibraryCopyHistory_tenantId_eventType_createdAt_idx" ON "LibraryCopyHistory"("tenantId", "eventType", "createdAt");

ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LibraryReservation" ADD CONSTRAINT "LibraryReservation_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LibraryCopyHistory" ADD CONSTRAINT "LibraryCopyHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LibraryCopyHistory" ADD CONSTRAINT "LibraryCopyHistory_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "LibraryCopy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

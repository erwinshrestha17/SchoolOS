-- Link canteen meal-plan enrollments to the M3 invoice created through FinanceService.
ALTER TABLE "CanteenStudentEnrollment"
  ADD COLUMN "feeInvoiceId" TEXT,
  ADD COLUMN "feePostedAt" TIMESTAMP(3);

CREATE INDEX "CanteenStudentEnrollment_tenantId_feeInvoiceId_idx"
  ON "CanteenStudentEnrollment"("tenantId", "feeInvoiceId");

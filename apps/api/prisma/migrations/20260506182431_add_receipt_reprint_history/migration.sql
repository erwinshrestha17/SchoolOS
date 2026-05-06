-- CreateTable
CREATE TABLE "ReceiptReprintHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "reprintedById" TEXT,
    "reprintedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "ReceiptReprintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptReprintHistory_tenantId_receiptId_idx"
ON "ReceiptReprintHistory"("tenantId", "receiptId");

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory"
ADD CONSTRAINT "ReceiptReprintHistory_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory"
ADD CONSTRAINT "ReceiptReprintHistory_receiptId_fkey"
FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptReprintHistory"
ADD CONSTRAINT "ReceiptReprintHistory_reprintedById_fkey"
FOREIGN KEY ("reprintedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "FinanceRequestType" AS ENUM ('REFUND', 'REVERSAL');

-- CreateEnum
CREATE TYPE "FinanceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "FinanceApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "FinanceRequestType" NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "status" "FinanceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceApprovalRequest_tenantId_status_idx" ON "FinanceApprovalRequest"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceApprovalRequest" ADD CONSTRAINT "FinanceApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

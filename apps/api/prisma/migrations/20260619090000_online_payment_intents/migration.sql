CREATE TYPE "OnlinePaymentIntentStatus" AS ENUM (
  'CREATED',
  'READY',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "OnlinePaymentIntent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentId" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NPR',
  "status" "OnlinePaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
  "checkoutUrl" TEXT,
  "expiresAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlinePaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnlinePaymentIntent_tenantId_idempotencyKey_key"
  ON "OnlinePaymentIntent"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "OnlinePaymentIntent_provider_providerReference_key"
  ON "OnlinePaymentIntent"("provider", "providerReference");
CREATE INDEX "OnlinePaymentIntent_tenantId_studentId_createdAt_idx"
  ON "OnlinePaymentIntent"("tenantId", "studentId", "createdAt");
CREATE INDEX "OnlinePaymentIntent_tenantId_invoiceId_status_idx"
  ON "OnlinePaymentIntent"("tenantId", "invoiceId", "status");

ALTER TABLE "OnlinePaymentIntent"
  ADD CONSTRAINT "OnlinePaymentIntent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentIntent"
  ADD CONSTRAINT "OnlinePaymentIntent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentIntent"
  ADD CONSTRAINT "OnlinePaymentIntent_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- M0 Platform Core + Production Foundation

CREATE TYPE "PlatformPlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'GRACE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "UsagePeriod" AS ENUM ('DAILY', 'MONTHLY', 'ANNUAL', 'LIFETIME');
CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED');
CREATE TYPE "SaaSInvoiceLineType" AS ENUM ('SUBSCRIPTION', 'SETUP_FEE', 'TRAINING_FEE', 'SMS_BUNDLE', 'STORAGE_ADDON', 'CUSTOM_SUPPORT', 'OTHER');
CREATE TYPE "SaaSPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'ESEWA', 'KHALTI', 'CHEQUE', 'OTHER');
CREATE TYPE "ProviderType" AS ENUM ('SMS', 'EMAIL', 'FCM', 'OBJECT_STORAGE', 'PAYMENT_GATEWAY', 'AI_PROVIDER');
CREATE TYPE "ProviderEnvironment" AS ENUM ('TEST', 'PRODUCTION');
CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "PlatformPlan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "PlatformPlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "priceNpr" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "billingCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformPlanFeature" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformPlanFeature_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "renewsAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantFeatureOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageLimit" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "usageKey" TEXT NOT NULL,
  "limit" INTEGER NOT NULL,
  "period" "UsagePeriod" NOT NULL DEFAULT 'MONTHLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageLimit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UsageCounter" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "usageKey" TEXT NOT NULL,
  "period" "UsagePeriod" NOT NULL DEFAULT 'MONTHLY',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantBillingProfile" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "billingContactName" TEXT,
  "billingEmail" TEXT,
  "billingPhone" TEXT,
  "billingAddress" TEXT,
  "panVatNumber" TEXT,
  "preferredBillingCycle" TEXT NOT NULL DEFAULT 'ANNUAL',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaaSInvoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "planId" TEXT,
  "subscriptionId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NPR',
  "issueDate" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" "SaaSInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  "cancellationReason" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaaSInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaaSInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "lineType" "SaaSInvoiceLineType" NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitAmount" DECIMAL(12,2) NOT NULL,
  "totalAmount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "SaaSInvoiceLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaaSPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "method" "SaaSPaymentMethod" NOT NULL,
  "reference" TEXT,
  "notes" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaaSPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderConfig" (
  "id" TEXT NOT NULL,
  "type" "ProviderType" NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "environment" "ProviderEnvironment" NOT NULL DEFAULT 'TEST',
  "configEncrypted" JSONB NOT NULL,
  "secretKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastValidatedAt" TIMESTAMP(3),
  "validationStatus" TEXT,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportExport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "scope" TEXT NOT NULL DEFAULT 'tenant',
  "reportKey" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "filters" JSONB NOT NULL,
  "status" "ReportExportStatus" NOT NULL DEFAULT 'COMPLETED',
  "fileAssetId" TEXT,
  "requestedBy" TEXT,
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantOnboardingChecklistOverride" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantOnboardingChecklistOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformPlan_key_key" ON "PlatformPlan"("key");
CREATE UNIQUE INDEX "PlatformPlanFeature_planId_featureKey_key" ON "PlatformPlanFeature"("planId", "featureKey");
CREATE INDEX "PlatformPlanFeature_featureKey_idx" ON "PlatformPlanFeature"("featureKey");
CREATE INDEX "TenantSubscription_tenantId_status_idx" ON "TenantSubscription"("tenantId", "status");
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE UNIQUE INDEX "TenantFeatureOverride_tenantId_featureKey_key" ON "TenantFeatureOverride"("tenantId", "featureKey");
CREATE INDEX "TenantFeatureOverride_featureKey_idx" ON "TenantFeatureOverride"("featureKey");
CREATE UNIQUE INDEX "UsageLimit_planId_usageKey_period_key" ON "UsageLimit"("planId", "usageKey", "period");
CREATE UNIQUE INDEX "UsageCounter_tenantId_usageKey_period_periodStart_key" ON "UsageCounter"("tenantId", "usageKey", "period", "periodStart");
CREATE INDEX "UsageCounter_tenantId_usageKey_idx" ON "UsageCounter"("tenantId", "usageKey");
CREATE UNIQUE INDEX "TenantBillingProfile_tenantId_key" ON "TenantBillingProfile"("tenantId");
CREATE UNIQUE INDEX "SaaSInvoice_invoiceNumber_key" ON "SaaSInvoice"("invoiceNumber");
CREATE INDEX "SaaSInvoice_tenantId_status_idx" ON "SaaSInvoice"("tenantId", "status");
CREATE INDEX "SaaSInvoice_dueDate_idx" ON "SaaSInvoice"("dueDate");
CREATE INDEX "SaaSPayment_tenantId_paymentDate_idx" ON "SaaSPayment"("tenantId", "paymentDate");
CREATE INDEX "SaaSPayment_invoiceId_idx" ON "SaaSPayment"("invoiceId");
CREATE UNIQUE INDEX "ProviderConfig_type_name_environment_key" ON "ProviderConfig"("type", "name", "environment");
CREATE INDEX "ProviderConfig_type_enabled_idx" ON "ProviderConfig"("type", "enabled");
CREATE INDEX "ReportExport_tenantId_createdAt_idx" ON "ReportExport"("tenantId", "createdAt");
CREATE INDEX "ReportExport_scope_reportKey_idx" ON "ReportExport"("scope", "reportKey");
CREATE UNIQUE INDEX "TenantOnboardingChecklistOverride_tenantId_itemKey_key" ON "TenantOnboardingChecklistOverride"("tenantId", "itemKey");

ALTER TABLE "PlatformPlanFeature" ADD CONSTRAINT "PlatformPlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageLimit" ADD CONSTRAINT "UsageLimit_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageCounter" ADD CONSTRAINT "UsageCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantBillingProfile" ADD CONSTRAINT "TenantBillingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PlatformPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaaSInvoice" ADD CONSTRAINT "SaaSInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaaSInvoiceLine" ADD CONSTRAINT "SaaSInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SaaSInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaaSPayment" ADD CONSTRAINT "SaaSPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaaSPayment" ADD CONSTRAINT "SaaSPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SaaSInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantOnboardingChecklistOverride" ADD CONSTRAINT "TenantOnboardingChecklistOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

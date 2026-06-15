-- Advanced operations foundation: approvals, deterministic automation,
-- descriptive analytics, document templates, and export jobs.

-- CreateEnum
CREATE TYPE "ApprovalWorkflowType" AS ENUM ('FEE_REVERSAL_REFUND', 'SCHOLARSHIP_DISCOUNT', 'MARKS_CORRECTION', 'ATTENDANCE_CORRECTION', 'LEAVE_REQUEST', 'PAYROLL_POSTING_REVERSAL', 'STUDENT_TRANSFER_WITHDRAWAL', 'DOCUMENT_DELETION_ARCHIVE', 'EMERGENCY_HIGH_IMPACT_NOTICE', 'PLATFORM_SUPPORT_OVERRIDE');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPLIED', 'APPLY_FAILED');

-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ApprovalFinalActionStatus" AS ENUM ('NOT_READY', 'READY', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('STUDENT_MARKED_ABSENT', 'ATTENDANCE_NOT_MARKED_BY_CUTOFF', 'FEE_DUE_DATE_PASSED', 'NOTICE_UNREAD_AFTER_WINDOW', 'STAFF_CONTRACT_EXPIRING', 'DOCUMENT_EXPIRING', 'LOW_CANTEEN_BALANCE', 'TRANSPORT_GPS_STALE', 'STAFF_LEAVE_APPROVED', 'LIBRARY_BOOK_OVERDUE', 'BUS_TRIP_STARTED', 'EXAM_RESULT_PUBLISHED', 'TENANT_SUSPENDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AutomationConditionOperator" AS ENUM ('EXISTS', 'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'IN', 'NOT_IN');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('CREATE_NOTIFICATION_TASK', 'CREATE_APPROVAL_REQUEST', 'CREATE_SUBSTITUTION_TASK', 'CREATE_EXPORT_JOB', 'RECORD_AUDIT_EVENT', 'WEBHOOK_EVENT');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('SKIPPED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnalyticsSummaryDomain" AS ENUM ('ATTENDANCE', 'FEES', 'EXAMS', 'DASHBOARD', 'USAGE');

-- CreateEnum
CREATE TYPE "AnalyticsRefreshStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentTemplateKind" AS ENUM ('FEE_RECEIPT', 'REPORT_CARD', 'TRANSFER_CERTIFICATE', 'CHARACTER_CERTIFICATE', 'BONAFIDE_CERTIFICATE', 'ATTENDANCE_CERTIFICATE', 'STUDENT_ID_CARD', 'STAFF_ID_CARD', 'EXAM_ADMIT_CARD', 'PAYMENT_DUE_LETTER', 'NOTICE_PDF', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('QUEUED', 'GENERATED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DataExportJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workflowType" "ApprovalWorkflowType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minApprovals" INTEGER NOT NULL DEFAULT 1,
    "approverRoles" JSONB NOT NULL DEFAULT '[]',
    "approverPermissions" JSONB NOT NULL DEFAULT '[]',
    "finalActionKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyId" TEXT,
    "workflowType" "ApprovalWorkflowType" NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "targetModule" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "beforeContext" JSONB,
    "afterContext" JSONB,
    "safeContext" JSONB,
    "finalActionKey" TEXT,
    "finalActionPayload" JSONB,
    "finalActionStatus" "ApprovalFinalActionStatus" NOT NULL DEFAULT 'NOT_READY',
    "finalActionAppliedAt" TIMESTAMP(3),
    "finalActionError" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "approverRole" TEXT,
    "approverPermission" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepId" TEXT,
    "decision" "ApprovalDecisionType" NOT NULL,
    "reason" TEXT,
    "decidedById" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "label" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "featureKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTrigger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" "AutomationTriggerType" NOT NULL,
    "sourceModule" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTrigger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationCondition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "operator" "AutomationConditionOperator" NOT NULL,
    "value" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" "AutomationActionType" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationExecutionLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "status" "AutomationExecutionStatus" NOT NULL,
    "idempotencyKey" TEXT,
    "input" JSONB,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationFailure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executionLogId" TEXT NOT NULL,
    "actionType" "AutomationActionType",
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationFailure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" "AnalyticsSummaryDomain" NOT NULL,
    "summaryDate" TIMESTAMP(3) NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'tenant',
    "scopeId" TEXT,
    "metrics" JSONB NOT NULL,
    "sourceHash" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsRefreshJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "domain" "AnalyticsSummaryDomain" NOT NULL,
    "summaryDate" TIMESTAMP(3) NOT NULL,
    "status" "AnalyticsRefreshStatus" NOT NULL DEFAULT 'QUEUED',
    "errorSummary" TEXT,
    "requestedById" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AnalyticsRefreshJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "DocumentTemplateKind" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "mergeFields" JSONB NOT NULL DEFAULT '[]',
    "headerConfig" JSONB,
    "footerConfig" JSONB,
    "activatedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'QUEUED',
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "fileAssetId" TEXT,
    "mergeData" JSONB NOT NULL,
    "verificationCode" TEXT,
    "generatedById" TEXT,
    "errorSummary" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVerificationToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPrintHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "printedById" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentPrintHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAccessLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "accessedById" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exportKey" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "DataExportJobStatus" NOT NULL DEFAULT 'QUEUED',
    "fileAssetId" TEXT,
    "requestedById" TEXT,
    "retryOfId" TEXT,
    "idempotencyKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportFailure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExportFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalPolicy_tenantId_workflowType_isActive_idx" ON "ApprovalPolicy"("tenantId", "workflowType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalPolicy_tenantId_workflowType_name_key" ON "ApprovalPolicy"("tenantId", "workflowType", "name");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_status_createdAt_idx" ON "ApprovalRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_workflowType_status_idx" ON "ApprovalRequest"("tenantId", "workflowType", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tenantId_targetModule_targetType_targetId_idx" ON "ApprovalRequest"("tenantId", "targetModule", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_tenantId_idempotencyKey_key" ON "ApprovalRequest"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ApprovalStep_tenantId_status_idx" ON "ApprovalStep"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_requestId_sequence_key" ON "ApprovalStep"("requestId", "sequence");

-- CreateIndex
CREATE INDEX "ApprovalDecision_tenantId_requestId_createdAt_idx" ON "ApprovalDecision"("tenantId", "requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalDecision_tenantId_decidedById_createdAt_idx" ON "ApprovalDecision"("tenantId", "decidedById", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalComment_tenantId_requestId_createdAt_idx" ON "ApprovalComment"("tenantId", "requestId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalAttachment_tenantId_requestId_idx" ON "ApprovalAttachment"("tenantId", "requestId");

-- CreateIndex
CREATE INDEX "ApprovalAttachment_tenantId_fileAssetId_idx" ON "ApprovalAttachment"("tenantId", "fileAssetId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_isEnabled_priority_idx" ON "AutomationRule"("tenantId", "isEnabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRule_tenantId_name_key" ON "AutomationRule"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AutomationTrigger_tenantId_type_idx" ON "AutomationTrigger"("tenantId", "type");

-- CreateIndex
CREATE INDEX "AutomationCondition_tenantId_ruleId_idx" ON "AutomationCondition"("tenantId", "ruleId");

-- CreateIndex
CREATE INDEX "AutomationAction_tenantId_ruleId_sortOrder_idx" ON "AutomationAction"("tenantId", "ruleId", "sortOrder");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_tenantId_triggerType_createdAt_idx" ON "AutomationExecutionLog"("tenantId", "triggerType", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationExecutionLog_tenantId_ruleId_createdAt_idx" ON "AutomationExecutionLog"("tenantId", "ruleId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationExecutionLog_tenantId_idempotencyKey_key" ON "AutomationExecutionLog"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AutomationFailure_tenantId_createdAt_idx" ON "AutomationFailure"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsSummary_tenantId_domain_summaryDate_idx" ON "AnalyticsSummary"("tenantId", "domain", "summaryDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsSummary_tenantId_domain_summaryDate_scopeType_scop_key" ON "AnalyticsSummary"("tenantId", "domain", "summaryDate", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "AnalyticsRefreshJob_tenantId_domain_status_idx" ON "AnalyticsRefreshJob"("tenantId", "domain", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsRefreshJob_tenantId_idempotencyKey_key" ON "AnalyticsRefreshJob"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DocumentTemplate_tenantId_kind_status_idx" ON "DocumentTemplate"("tenantId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_tenantId_key_key" ON "DocumentTemplate"("tenantId", "key");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_tenantId_templateId_createdAt_idx" ON "DocumentTemplateVersion"("tenantId", "templateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_version_key" ON "DocumentTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "GeneratedDocument_tenantId_subjectType_subjectId_idx" ON "GeneratedDocument"("tenantId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "GeneratedDocument_tenantId_status_createdAt_idx" ON "GeneratedDocument"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDocument_tenantId_verificationCode_key" ON "GeneratedDocument"("tenantId", "verificationCode");

-- CreateIndex
CREATE INDEX "DocumentVerificationToken_tenantId_documentId_idx" ON "DocumentVerificationToken"("tenantId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVerificationToken_tenantId_tokenHash_key" ON "DocumentVerificationToken"("tenantId", "tokenHash");

-- CreateIndex
CREATE INDEX "DocumentPrintHistory_tenantId_documentId_createdAt_idx" ON "DocumentPrintHistory"("tenantId", "documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAccessLog_tenantId_documentId_createdAt_idx" ON "DocumentAccessLog"("tenantId", "documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportJob_tenantId_exportKey_createdAt_idx" ON "DataExportJob"("tenantId", "exportKey", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportJob_tenantId_status_createdAt_idx" ON "DataExportJob"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DataExportJob_tenantId_idempotencyKey_key" ON "DataExportJob"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "DataExportFailure_tenantId_exportJobId_createdAt_idx" ON "DataExportFailure"("tenantId", "exportJobId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalPolicy" ADD CONSTRAINT "ApprovalPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ApprovalStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalDecision" ADD CONSTRAINT "ApprovalDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalComment" ADD CONSTRAINT "ApprovalComment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalComment" ADD CONSTRAINT "ApprovalComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalComment" ADD CONSTRAINT "ApprovalComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalAttachment" ADD CONSTRAINT "ApprovalAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTrigger" ADD CONSTRAINT "AutomationTrigger_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationCondition" ADD CONSTRAINT "AutomationCondition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationCondition" ADD CONSTRAINT "AutomationCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationAction" ADD CONSTRAINT "AutomationAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationExecutionLog" ADD CONSTRAINT "AutomationExecutionLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationFailure" ADD CONSTRAINT "AutomationFailure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationFailure" ADD CONSTRAINT "AutomationFailure_executionLogId_fkey" FOREIGN KEY ("executionLogId") REFERENCES "AutomationExecutionLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsSummary" ADD CONSTRAINT "AnalyticsSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsRefreshJob" ADD CONSTRAINT "AnalyticsRefreshJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsRefreshJob" ADD CONSTRAINT "AnalyticsRefreshJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "DocumentTemplateVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDocument" ADD CONSTRAINT "GeneratedDocument_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerificationToken" ADD CONSTRAINT "DocumentVerificationToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVerificationToken" ADD CONSTRAINT "DocumentVerificationToken_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintHistory" ADD CONSTRAINT "DocumentPrintHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintHistory" ADD CONSTRAINT "DocumentPrintHistory_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentPrintHistory" ADD CONSTRAINT "DocumentPrintHistory_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAccessLog" ADD CONSTRAINT "DocumentAccessLog_accessedById_fkey" FOREIGN KEY ("accessedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportJob" ADD CONSTRAINT "DataExportJob_retryOfId_fkey" FOREIGN KEY ("retryOfId") REFERENCES "DataExportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportFailure" ADD CONSTRAINT "DataExportFailure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportFailure" ADD CONSTRAINT "DataExportFailure_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "DataExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

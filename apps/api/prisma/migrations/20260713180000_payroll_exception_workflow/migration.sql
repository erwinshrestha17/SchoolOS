CREATE TYPE "PayrollExceptionSeverity" AS ENUM ('BLOCKING', 'WARNING', 'INFO');
CREATE TYPE "PayrollExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'WAIVED');
CREATE TYPE "PayrollExceptionCode" AS ENUM (
  'MISSING_SALARY_STRUCTURE',
  'NO_EFFECTIVE_SALARY_STRUCTURE',
  'MISSING_ACTIVE_CONTRACT',
  'EXPIRED_CONTRACT',
  'INACTIVE_STAFF_INCLUDED',
  'MISSING_ATTENDANCE',
  'ATTENDANCE_ANOMALY',
  'LEAVE_OVERLAP',
  'MISSING_PAN',
  'MISSING_BANK_ACCOUNT',
  'MISSING_STATUTORY_CONFIGURATION',
  'INVALID_WORKING_DAYS',
  'NEGATIVE_NET_PAY',
  'MISSING_ACCOUNT_MAPPING',
  'FISCAL_PERIOD_LOCKED',
  'ACCOUNTING_POSTING_FAILED',
  'PAYSLIP_GENERATION_FAILED'
);

CREATE TABLE "PayrollException" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "payrollRunId" TEXT,
  "staffId" TEXT,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "identityKey" TEXT NOT NULL,
  "code" "PayrollExceptionCode" NOT NULL,
  "severity" "PayrollExceptionSeverity" NOT NULL,
  "status" "PayrollExceptionStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "safeMessage" TEXT NOT NULL,
  "resolutionRoute" TEXT,
  "blockedActions" TEXT[] NOT NULL,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedById" TEXT,
  "acknowledgementReason" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollException_tenantId_identityKey_key"
ON "PayrollException"("tenantId", "identityKey");
CREATE INDEX "PayrollException_period_status_severity_idx"
ON "PayrollException"("tenantId", "periodYear", "periodMonth", "status", "severity");
CREATE INDEX "PayrollException_run_status_idx"
ON "PayrollException"("tenantId", "payrollRunId", "status");
CREATE INDEX "PayrollException_staff_status_idx"
ON "PayrollException"("tenantId", "staffId", "status");
CREATE INDEX "PayrollException_code_status_idx"
ON "PayrollException"("tenantId", "code", "status");

ALTER TABLE "PayrollException"
ADD CONSTRAINT "PayrollException_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollException"
ADD CONSTRAINT "PayrollException_payrollRunId_fkey"
FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollException"
ADD CONSTRAINT "PayrollException_staffId_fkey"
FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

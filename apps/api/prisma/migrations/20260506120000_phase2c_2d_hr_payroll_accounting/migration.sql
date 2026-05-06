ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HALF_DAY';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'ON_LEAVE';
ALTER TYPE "AttendanceStatus" ADD VALUE IF NOT EXISTS 'HOLIDAY';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'PAYROLL_RUN';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'PAYROLL_DISBURSEMENT';
ALTER TYPE "JournalSourceType" ADD VALUE IF NOT EXISTS 'CORRECTION';
ALTER TYPE "ChartAccountType" ADD VALUE IF NOT EXISTS 'REVENUE';
ALTER TYPE "PayrollRunStatus" ADD VALUE IF NOT EXISTS 'GENERATED';
ALTER TYPE "PayrollRunStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "PayrollRunStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "PayrollRunStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "AccountingPeriodStatus" ADD VALUE IF NOT EXISTS 'LOCKED';

DO $$ BEGIN
  CREATE TYPE "JournalEntryStatus" AS ENUM ('POSTED', 'REVERSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "StaffEmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY', 'PART_TIME', 'CONTRACT', 'INTERN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveType" AS ENUM ('SICK', 'CASUAL', 'EARNED', 'MATERNITY', 'PATERNITY', 'UNPAID', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryStructureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollPaymentStatus" AS ENUM ('UNPAID', 'PAID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_employeeId_key";
ALTER TABLE "Staff"
  ADD COLUMN IF NOT EXISTS "staffCode" TEXT,
  ADD COLUMN IF NOT EXISTS "department" TEXT,
  ADD COLUMN IF NOT EXISTS "designation" TEXT,
  ADD COLUMN IF NOT EXISTS "employmentType" "StaffEmploymentType",
  ADD COLUMN IF NOT EXISTS "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "contractStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Staff_tenantId_employeeId_key" ON "Staff"("tenantId", "employeeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_tenantId_staffCode_key" ON "Staff"("tenantId", "staffCode");
CREATE INDEX IF NOT EXISTS "Staff_tenantId_status_idx" ON "Staff"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Staff_tenantId_department_idx" ON "Staff"("tenantId", "department");

CREATE TABLE IF NOT EXISTS "StaffQualification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "degree" TEXT NOT NULL,
  "institution" TEXT,
  "year" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffQualification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffExperienceRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "organization" TEXT NOT NULL,
  "role" TEXT,
  "startsOn" TIMESTAMP(3),
  "endsOn" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffExperienceRecord_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffQualification" ADD CONSTRAINT "StaffQualification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffExperienceRecord" ADD CONSTRAINT "StaffExperienceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffExperienceRecord" ADD CONSTRAINT "StaffExperienceRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "StaffQualification_tenantId_staffId_idx" ON "StaffQualification"("tenantId", "staffId");
CREATE INDEX IF NOT EXISTS "StaffExperienceRecord_tenantId_staffId_idx" ON "StaffExperienceRecord"("tenantId", "staffId");

ALTER TABLE "StaffLeaveBalance"
  ADD COLUMN IF NOT EXISTS "opening" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "accrued" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adjusted" DECIMAL(8,2) NOT NULL DEFAULT 0;

ALTER TABLE "StaffLeaveRequest"
  ADD COLUMN IF NOT EXISTS "isPaid" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "FiscalYear" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FiscalPeriod" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fiscalYearId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "periodNumber" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "lockedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "FiscalYear_tenantId_name_key" ON "FiscalYear"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "FiscalYear_tenantId_startDate_endDate_idx" ON "FiscalYear"("tenantId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "FiscalYear_tenantId_status_idx" ON "FiscalYear"("tenantId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "FiscalPeriod_tenantId_fiscalYearId_periodNumber_key" ON "FiscalPeriod"("tenantId", "fiscalYearId", "periodNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "FiscalPeriod_tenantId_fiscalYearId_label_key" ON "FiscalPeriod"("tenantId", "fiscalYearId", "label");
CREATE INDEX IF NOT EXISTS "FiscalPeriod_tenantId_startDate_endDate_idx" ON "FiscalPeriod"("tenantId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "FiscalPeriod_tenantId_status_idx" ON "FiscalPeriod"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "SalaryStructure" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "basicSalary" DECIMAL(12,2) NOT NULL,
  "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "pfEnabled" BOOLEAN NOT NULL DEFAULT false,
  "tdsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK',
  "bankAccount" TEXT,
  "bankName" TEXT,
  "status" "SalaryStructureStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "activatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalaryComponent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "salaryStructureId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "componentType" "SalaryComponentType" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "SalaryStructure_tenantId_staffId_status_idx" ON "SalaryStructure"("tenantId", "staffId", "status");
CREATE INDEX IF NOT EXISTS "SalaryStructure_tenantId_effectiveFrom_effectiveTo_idx" ON "SalaryStructure"("tenantId", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "SalaryComponent_tenantId_salaryStructureId_idx" ON "SalaryComponent"("tenantId", "salaryStructureId");

ALTER TABLE "ChartAccount"
  ADD COLUMN IF NOT EXISTS "fiscalYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ChartAccount_tenantId_fiscalYearId_idx" ON "ChartAccount"("tenantId", "fiscalYearId");

ALTER TABLE "JournalEntry"
  ADD COLUMN IF NOT EXISTS "fiscalYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "fiscalPeriodId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS "sourceModule" TEXT,
  ADD COLUMN IF NOT EXISTS "postingType" TEXT,
  ADD COLUMN IF NOT EXISTS "correctionOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_correctionOfId_fkey" FOREIGN KEY ("correctionOfId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_tenantId_sourceModule_sourceType_sourceId_postingType_key" ON "JournalEntry"("tenantId", "sourceModule", "sourceType", "sourceId", "postingType");
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_fiscalYearId_idx" ON "JournalEntry"("tenantId", "fiscalYearId");
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_fiscalPeriodId_idx" ON "JournalEntry"("tenantId", "fiscalPeriodId");

ALTER TABLE "JournalLine"
  ADD COLUMN IF NOT EXISTS "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lineNumber" INTEGER NOT NULL DEFAULT 1;
UPDATE "JournalLine" SET "debit" = "amount", "credit" = 0 WHERE "side" = 'DEBIT' AND "debit" = 0 AND "credit" = 0;
UPDATE "JournalLine" SET "credit" = "amount", "debit" = 0 WHERE "side" = 'CREDIT' AND "debit" = 0 AND "credit" = 0;
CREATE INDEX IF NOT EXISTS "JournalLine_tenantId_journalEntryId_idx" ON "JournalLine"("tenantId", "journalEntryId");
CREATE INDEX IF NOT EXISTS "JournalLine_tenantId_chartAccountId_idx" ON "JournalLine"("tenantId", "chartAccountId");

ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "fiscalYearId" TEXT,
  ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pfEmployeeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pfEmployerAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tdsAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "generatedById" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "postedById" TEXT,
  ADD COLUMN IF NOT EXISTS "paidById" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disbursementJournalEntryId" TEXT;
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollLine"
  ADD COLUMN IF NOT EXISTS "salaryStructureId" TEXT,
  ADD COLUMN IF NOT EXISTS "basicSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "leaveDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unpaidDays" DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PayrollPaymentStatus" NOT NULL DEFAULT 'UNPAID';
UPDATE "PayrollLine" SET "paidDays" = "attendanceDays" WHERE "paidDays" = 0;
UPDATE "PayrollLine" SET "basicSalary" = "grossSalary" - "allowances" WHERE "basicSalary" = 0;
UPDATE "PayrollLine" SET "earnings" = "grossSalary" WHERE "earnings" = 0;
ALTER TABLE "PayrollLine" ADD CONSTRAINT "PayrollLine_salaryStructureId_fkey" FOREIGN KEY ("salaryStructureId") REFERENCES "SalaryStructure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payslip"
  ADD COLUMN IF NOT EXISTS "pfEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pfEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tds" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentStatus" "PayrollPaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- M7 HR & Payroll hardening guardrails.
-- Enforces tenant ownership, payroll lifecycle integrity, Decimal-safe positive amounts,
-- accounting posting idempotency, and staff/payslip access indexes.

CREATE OR REPLACE FUNCTION "enforce_staff_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."employeeId"), '') = '' THEN
    RAISE EXCEPTION 'Staff employeeId is required';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED') THEN
    RAISE EXCEPTION 'Invalid staff status';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'TERMINATED' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Terminated staff cannot be reactivated silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "staff_guard" ON "Staff";
CREATE TRIGGER "staff_guard"
BEFORE INSERT OR UPDATE OF "employeeId", "status"
ON "Staff"
FOR EACH ROW
EXECUTE FUNCTION "enforce_staff_guard"();

CREATE OR REPLACE FUNCTION "enforce_staff_contract_guard"()
RETURNS trigger AS $$
DECLARE
  staff_tenant_id text;
  overlap_id text;
BEGIN
  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";

  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Staff contract staff is missing or outside tenant';
  END IF;

  IF NEW."endDate" IS NOT NULL AND NEW."endDate" < NEW."startDate" THEN
    RAISE EXCEPTION 'Staff contract endDate cannot be before startDate';
  END IF;

  IF NEW."baseSalary" < 0 OR NEW."allowances" < 0 OR NEW."deductions" < 0 THEN
    RAISE EXCEPTION 'Staff contract amounts cannot be negative';
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    SELECT "id" INTO overlap_id
    FROM "StaffContract"
    WHERE "tenantId" = NEW."tenantId"
      AND "staffId" = NEW."staffId"
      AND "status" = 'ACTIVE'
      AND "id" <> COALESCE(NEW."id", '')
      AND "startDate" <= COALESCE(NEW."endDate", NEW."startDate")
      AND ("endDate" IS NULL OR "endDate" >= NEW."startDate")
    LIMIT 1;

    IF overlap_id IS NOT NULL THEN
      RAISE EXCEPTION 'Overlapping active staff contract exists';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "staff_contract_guard" ON "StaffContract";
CREATE TRIGGER "staff_contract_guard"
BEFORE INSERT OR UPDATE
ON "StaffContract"
FOR EACH ROW
EXECUTE FUNCTION "enforce_staff_contract_guard"();

CREATE OR REPLACE FUNCTION "enforce_salary_structure_guard"()
RETURNS trigger AS $$
DECLARE
  staff_tenant_id text;
  overlap_id text;
BEGIN
  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";

  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Salary structure staff is missing or outside tenant';
  END IF;

  IF NEW."effectiveTo" IS NOT NULL AND NEW."effectiveTo" < NEW."effectiveFrom" THEN
    RAISE EXCEPTION 'Salary structure effectiveTo cannot be before effectiveFrom';
  END IF;

  IF NEW."basicSalary" < 0 OR NEW."allowances" < 0 OR NEW."deductions" < 0 THEN
    RAISE EXCEPTION 'Salary structure amounts cannot be negative';
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    SELECT "id" INTO overlap_id
    FROM "SalaryStructure"
    WHERE "tenantId" = NEW."tenantId"
      AND "staffId" = NEW."staffId"
      AND "status" = 'ACTIVE'
      AND "id" <> COALESCE(NEW."id", '')
      AND "effectiveFrom" <= COALESCE(NEW."effectiveTo", NEW."effectiveFrom")
      AND ("effectiveTo" IS NULL OR "effectiveTo" >= NEW."effectiveFrom")
    LIMIT 1;

    IF overlap_id IS NOT NULL THEN
      RAISE EXCEPTION 'Overlapping active salary structure exists';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "salary_structure_guard" ON "SalaryStructure";
CREATE TRIGGER "salary_structure_guard"
BEFORE INSERT OR UPDATE
ON "SalaryStructure"
FOR EACH ROW
EXECUTE FUNCTION "enforce_salary_structure_guard"();

CREATE OR REPLACE FUNCTION "enforce_salary_component_guard"()
RETURNS trigger AS $$
DECLARE
  structure_tenant_id text;
BEGIN
  SELECT "tenantId" INTO structure_tenant_id FROM "SalaryStructure" WHERE "id" = NEW."salaryStructureId";

  IF structure_tenant_id IS NULL OR structure_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Salary component structure is missing or outside tenant';
  END IF;

  IF NEW."amount" < 0 THEN
    RAISE EXCEPTION 'Salary component amount cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "salary_component_guard" ON "SalaryComponent";
CREATE TRIGGER "salary_component_guard"
BEFORE INSERT OR UPDATE
ON "SalaryComponent"
FOR EACH ROW
EXECUTE FUNCTION "enforce_salary_component_guard"();

CREATE OR REPLACE FUNCTION "enforce_payroll_run_guard"()
RETURNS trigger AS $$
BEGIN
  IF NEW."periodMonth" < 1 OR NEW."periodMonth" > 12 THEN
    RAISE EXCEPTION 'Payroll periodMonth must be between 1 and 12';
  END IF;

  IF NEW."periodYear" < 2000 THEN
    RAISE EXCEPTION 'Payroll periodYear is invalid';
  END IF;

  IF NEW."periodEnd" < NEW."periodStart" THEN
    RAISE EXCEPTION 'Payroll periodEnd cannot be before periodStart';
  END IF;

  IF NEW."grossAmount" < 0 OR NEW."deductionAmount" < 0 OR NEW."netAmount" < 0 THEN
    RAISE EXCEPTION 'Payroll run amounts cannot be negative';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'POSTED' AND NEW."status" NOT IN ('POSTED', 'PAID', 'VOID') THEN
      RAISE EXCEPTION 'Posted payroll can only move to PAID or VOID workflow';
    END IF;

    IF OLD."status" = 'PAID' AND NEW."status" <> 'PAID' THEN
      RAISE EXCEPTION 'Paid payroll cannot transition silently';
    END IF;

    IF OLD."status" IN ('POSTED', 'PAID') AND (
      NEW."grossAmount" IS DISTINCT FROM OLD."grossAmount" OR
      NEW."deductionAmount" IS DISTINCT FROM OLD."deductionAmount" OR
      NEW."netAmount" IS DISTINCT FROM OLD."netAmount"
    ) THEN
      RAISE EXCEPTION 'Posted/paid payroll amounts cannot be edited';
    END IF;
  END IF;

  IF NEW."status" = 'POSTED' AND NEW."journalEntryId" IS NULL THEN
    RAISE EXCEPTION 'Posted payroll requires journalEntryId';
  END IF;

  IF NEW."status" = 'PAID' AND NEW."disbursementJournalEntryId" IS NULL THEN
    RAISE EXCEPTION 'Paid payroll requires disbursementJournalEntryId';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payroll_run_guard" ON "PayrollRun";
CREATE TRIGGER "payroll_run_guard"
BEFORE INSERT OR UPDATE
ON "PayrollRun"
FOR EACH ROW
EXECUTE FUNCTION "enforce_payroll_run_guard"();

CREATE OR REPLACE FUNCTION "enforce_payroll_line_guard"()
RETURNS trigger AS $$
DECLARE
  run_tenant_id text;
  run_status text;
  staff_tenant_id text;
BEGIN
  SELECT "tenantId", "status"::text INTO run_tenant_id, run_status FROM "PayrollRun" WHERE "id" = NEW."payrollRunId";

  IF run_tenant_id IS NULL OR run_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payroll line run is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";
  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payroll line staff is missing or outside tenant';
  END IF;

  IF run_status IN ('POSTED', 'PAID') AND TG_OP = 'UPDATE' AND (
    NEW."netSalary" IS DISTINCT FROM OLD."netSalary" OR
    NEW."grossSalary" IS DISTINCT FROM OLD."grossSalary" OR
    NEW."deductions" IS DISTINCT FROM OLD."deductions"
  ) THEN
    RAISE EXCEPTION 'Payroll line amounts cannot be edited after posting';
  END IF;

  IF NEW."basicSalary" < 0 OR NEW."grossSalary" < 0 OR NEW."netSalary" < 0 OR NEW."deductions" < 0 THEN
    RAISE EXCEPTION 'Payroll line amounts cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payroll_line_guard" ON "PayrollLine";
CREATE TRIGGER "payroll_line_guard"
BEFORE INSERT OR UPDATE
ON "PayrollLine"
FOR EACH ROW
EXECUTE FUNCTION "enforce_payroll_line_guard"();

CREATE OR REPLACE FUNCTION "enforce_payslip_guard"()
RETURNS trigger AS $$
DECLARE
  run_tenant_id text;
  line_tenant_id text;
  line_staff_id text;
  staff_tenant_id text;
BEGIN
  SELECT "tenantId" INTO run_tenant_id FROM "PayrollRun" WHERE "id" = NEW."payrollRunId";
  IF run_tenant_id IS NULL OR run_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payslip payroll run is missing or outside tenant';
  END IF;

  SELECT "tenantId", "staffId" INTO line_tenant_id, line_staff_id FROM "PayrollLine" WHERE "id" = NEW."payrollLineId";
  IF line_tenant_id IS NULL OR line_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payslip payroll line is missing or outside tenant';
  END IF;

  IF line_staff_id <> NEW."staffId" THEN
    RAISE EXCEPTION 'Payslip staff does not match payroll line staff';
  END IF;

  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";
  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Payslip staff is missing or outside tenant';
  END IF;

  IF NEW."grossSalary" < 0 OR NEW."deductionAmount" < 0 OR NEW."netSalary" < 0 THEN
    RAISE EXCEPTION 'Payslip amounts cannot be negative';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "payslip_guard" ON "Payslip";
CREATE TRIGGER "payslip_guard"
BEFORE INSERT OR UPDATE
ON "Payslip"
FOR EACH ROW
EXECUTE FUNCTION "enforce_payslip_guard"();

CREATE INDEX IF NOT EXISTS "Staff_tenant_status_idx" ON "Staff" ("tenantId", "status", "joiningDate");
CREATE INDEX IF NOT EXISTS "StaffContract_tenant_staff_status_idx" ON "StaffContract" ("tenantId", "staffId", "status", "startDate");
CREATE INDEX IF NOT EXISTS "SalaryStructure_tenant_staff_status_idx" ON "SalaryStructure" ("tenantId", "staffId", "status", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "PayrollRun_tenant_status_period_idx" ON "PayrollRun" ("tenantId", "status", "periodYear", "periodMonth");
CREATE INDEX IF NOT EXISTS "PayrollLine_tenant_run_staff_idx" ON "PayrollLine" ("tenantId", "payrollRunId", "staffId");
CREATE INDEX IF NOT EXISTS "Payslip_tenant_staff_run_idx" ON "Payslip" ("tenantId", "staffId", "payrollRunId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_tenant_journal_uidx" ON "PayrollRun" ("tenantId", "journalEntryId") WHERE "journalEntryId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_tenant_disbursement_journal_uidx" ON "PayrollRun" ("tenantId", "disbursementJournalEntryId") WHERE "disbursementJournalEntryId" IS NOT NULL;

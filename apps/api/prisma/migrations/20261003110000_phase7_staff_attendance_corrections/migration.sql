-- Fail without repairing historical rows.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "StaffAttendance" a JOIN "Staff" s ON s.id=a."staffId" WHERE a."tenantId"<>s."tenantId") THEN
 RAISE EXCEPTION 'Phase 7.7 preflight: staff attendance tenant mismatch'; END IF;
 IF EXISTS (SELECT 1 FROM "PayrollRun" WHERE ("periodStart" IS NULL) <> ("periodEnd" IS NULL) OR "periodStart">"periodEnd" OR "periodMonth" NOT BETWEEN 1 AND 12) THEN
 RAISE EXCEPTION 'Phase 7.7 preflight: invalid payroll period'; END IF;
END $$;
-- CreateEnum
CREATE TYPE "StaffAttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'PENDING_PAYROLL_ADJUSTMENT');

-- AlterTable
ALTER TABLE "StaffAttendance" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StaffAttendanceCorrection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "attendanceDate" TIMESTAMP(3) NOT NULL,
    "originalStatus" "AttendanceStatus" NOT NULL,
    "requestedStatus" "AttendanceStatus" NOT NULL,
    "originalCheckInAt" TIMESTAMP(3),
    "requestedCheckInAt" TIMESTAMP(3),
    "originalCheckOutAt" TIMESTAMP(3),
    "requestedCheckOutAt" TIMESTAMP(3),
    "originalLeaveType" TEXT,
    "requestedLeaveType" TEXT,
    "originalNote" TEXT,
    "requestedNote" TEXT,
    "originalUpdatedAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "status" "StaffAttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAttendanceCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAttendanceCorrection_tenantId_status_createdAt_idx" ON "StaffAttendanceCorrection"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StaffAttendanceCorrection_tenantId_staffId_attendanceDate_idx" ON "StaffAttendanceCorrection"("tenantId", "staffId", "attendanceDate");

-- AddForeignKey
ALTER TABLE "StaffAttendanceCorrection" ADD CONSTRAINT "StaffAttendanceCorrection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceCorrection" ADD CONSTRAINT "StaffAttendanceCorrection_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceCorrection" ADD CONSTRAINT "StaffAttendanceCorrection_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "StaffAttendance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceCorrection" ADD CONSTRAINT "StaffAttendanceCorrection_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendanceCorrection" ADD CONSTRAINT "StaffAttendanceCorrection_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "StaffAttendanceCorrection"
 ADD CONSTRAINT "StaffAttendanceCorrection_independent_approver" CHECK ("approverId" IS NULL OR "approverId" <> "requesterId"),
 ADD CONSTRAINT "StaffAttendanceCorrection_decision" CHECK (
  (status IN ('APPROVED','REJECTED','PENDING_PAYROLL_ADJUSTMENT') AND "approverId" IS NOT NULL AND "decidedAt" IS NOT NULL)
  OR (status IN ('PENDING','CANCELLED') AND "approverId" IS NULL AND "decidedAt" IS NULL)),
 ADD CONSTRAINT "StaffAttendanceCorrection_reason" CHECK (length(btrim(reason)) BETWEEN 1 AND 1000);
CREATE UNIQUE INDEX "StaffAttendanceCorrection_one_open" ON "StaffAttendanceCorrection" ("tenantId","staffId","attendanceDate") WHERE status IN ('PENDING','PENDING_PAYROLL_ADJUSTMENT');

-- Serialize payroll status transitions with attendance writes and decisions.
CREATE FUNCTION staff_attendance_tenant_lock(text) RETURNS void LANGUAGE sql AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('staff-attendance:' || $1, 0));
$$;
CREATE FUNCTION staff_attendance_payroll_locked(text,timestamp) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."tenantId"=$1
 AND (r."finalizedAt" IS NOT NULL OR r.status IN ('APPROVED','FINALIZED','POSTED','PAID'))
 AND $2 >= COALESCE(r."periodStart", make_date(r."periodYear",r."periodMonth",1)::timestamp)
 AND $2 < COALESCE(r."periodEnd" + interval '1 day', make_date(r."periodYear",r."periodMonth",1)::timestamp + interval '1 month'));
$$;
CREATE FUNCTION guard_staff_attendance_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "StaffAttendance"; c "StaffAttendanceCorrection";
BEGIN
 IF TG_OP='INSERT' THEN a:=NEW; ELSE a:=OLD; END IF;
 PERFORM staff_attendance_tenant_lock(a."tenantId");
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF staff_attendance_payroll_locked(a."tenantId",a."attendanceDate") THEN
  RAISE EXCEPTION 'STAFF_ATTENDANCE_PAYROLL_LOCKED' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW."tenantId",NEW."staffId",NEW."attendanceDate") IS DISTINCT FROM (OLD.id,OLD."tenantId",OLD."staffId",OLD."attendanceDate") THEN
  RAISE EXCEPTION 'STAFF_ATTENDANCE_IDENTITY_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 IF TG_OP<>'INSERT' AND EXISTS (SELECT 1 FROM "StaffAttendanceCorrection" WHERE "attendanceId"=a.id AND status IN ('APPROVED','PENDING_PAYROLL_ADJUSTMENT')) THEN
  SELECT * INTO c FROM "StaffAttendanceCorrection" WHERE id=current_setting('schoolos.staff_attendance_correction',true) AND "attendanceId"=a.id AND status='APPROVED';
  IF TG_OP='DELETE' OR c.id IS NULL OR (NEW.status,NEW."checkInAt",NEW."checkOutAt",NEW."leaveType",NEW.note) IS DISTINCT FROM (c."requestedStatus",c."requestedCheckInAt",c."requestedCheckOutAt",c."requestedLeaveType",c."requestedNote") THEN
   RAISE EXCEPTION 'STAFF_ATTENDANCE_CORRECTED_USE_WORKFLOW' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN NEW."updatedAt":=clock_timestamp(); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StaffAttendance_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "StaffAttendance" FOR EACH ROW EXECUTE FUNCTION guard_staff_attendance_history();
CREATE FUNCTION lock_payroll_attendance_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM staff_attendance_tenant_lock(NEW."tenantId"); RETURN NEW;
END $$;
CREATE TRIGGER "PayrollRun_attendance_lock" BEFORE INSERT OR UPDATE ON "PayrollRun" FOR EACH ROW EXECUTE FUNCTION lock_payroll_attendance_history();

CREATE FUNCTION guard_staff_attendance_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'STAFF_ATTENDANCE_CORRECTION_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (OLD.status<>'PENDING' OR
  (to_jsonb(NEW) - ARRAY['status','approverId','decidedAt','decisionReason','updatedAt']) IS DISTINCT FROM
  (to_jsonb(OLD) - ARRAY['status','approverId','decidedAt','decisionReason','updatedAt'])) THEN
  RAISE EXCEPTION 'STAFF_ATTENDANCE_CORRECTION_HISTORY_IMMUTABLE' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM "StaffAttendance" a WHERE a.id=NEW."attendanceId" AND a."tenantId"=NEW."tenantId" AND a."staffId"=NEW."staffId" AND a."attendanceDate"=NEW."attendanceDate")
 OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id=NEW."requesterId" AND u."tenantId"=NEW."tenantId")
 OR (NEW."approverId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id=NEW."approverId" AND u."tenantId"=NEW."tenantId")) THEN
  RAISE EXCEPTION 'STAFF_ATTENDANCE_CORRECTION_TENANT_MISMATCH' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER "StaffAttendanceCorrection_history_guard" BEFORE INSERT OR UPDATE OR DELETE ON "StaffAttendanceCorrection" FOR EACH ROW EXECUTE FUNCTION guard_staff_attendance_correction();

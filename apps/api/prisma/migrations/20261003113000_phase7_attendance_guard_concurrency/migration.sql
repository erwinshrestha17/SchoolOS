-- Refresh the payroll snapshot after the tenant advisory lock is acquired.
-- VOLATILE is deliberate: a writer waiting inside its trigger must see a
-- payroll finalization that committed while it waited. Normalize inclusive
-- periodEnd to a calendar boundary; timestamp period ends must not lock the
-- first day of the following month. Correction opt-in is bound to its exact
-- original snapshot, preventing replay of an older approved correction.
CREATE OR REPLACE FUNCTION staff_attendance_payroll_locked(text,timestamp) RETURNS boolean LANGUAGE sql VOLATILE AS $$
 SELECT EXISTS (SELECT 1 FROM "PayrollRun" r WHERE r."tenantId"=$1
 AND (r."finalizedAt" IS NOT NULL OR r.status IN ('APPROVED','FINALIZED','POSTED','PAID'))
 AND $2 >= COALESCE(r."periodStart", make_date(r."periodYear",r."periodMonth",1)::timestamp)
 AND $2 < COALESCE(date_trunc('day', r."periodEnd") + interval '1 day', make_date(r."periodYear",r."periodMonth",1)::timestamp + interval '1 month'));
$$;
CREATE OR REPLACE FUNCTION guard_staff_attendance_history() RETURNS trigger LANGUAGE plpgsql AS $$
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
  IF TG_OP='DELETE' OR c.id IS NULL OR c."originalUpdatedAt" IS DISTINCT FROM OLD."updatedAt" OR (OLD.status,OLD."checkInAt",OLD."checkOutAt",OLD."leaveType",OLD.note) IS DISTINCT FROM (c."originalStatus",c."originalCheckInAt",c."originalCheckOutAt",c."originalLeaveType",c."originalNote") OR (NEW.status,NEW."checkInAt",NEW."checkOutAt",NEW."leaveType",NEW.note) IS DISTINCT FROM (c."requestedStatus",c."requestedCheckInAt",c."requestedCheckOutAt",c."requestedLeaveType",c."requestedNote") THEN
   RAISE EXCEPTION 'STAFF_ATTENDANCE_CORRECTED_USE_WORKFLOW' USING ERRCODE='23514';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN NEW."updatedAt":=clock_timestamp(); END IF;
 RETURN NEW;
END $$;

-- M8B Transport Management hardening guardrails.
-- Enforces tenant ownership, route/stop/vehicle/driver assignment integrity,
-- trip lifecycle safety, boarding/drop transition safety, and sampled GPS storage indexes.

CREATE OR REPLACE FUNCTION "enforce_transport_route_guard"()
RETURNS trigger AS $$
DECLARE
  vehicle_tenant_id text;
BEGIN
  IF COALESCE(TRIM(NEW."name"), '') = '' THEN
    RAISE EXCEPTION 'Transport route name is required';
  END IF;

  IF COALESCE(TRIM(NEW."code"), '') = '' THEN
    RAISE EXCEPTION 'Transport route code is required';
  END IF;

  IF NEW."vehicleId" IS NOT NULL THEN
    SELECT "tenantId" INTO vehicle_tenant_id FROM "TransportVehicle" WHERE "id" = NEW."vehicleId";
    IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Transport route vehicle is missing or outside tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_route_guard" ON "TransportRoute";
CREATE TRIGGER "transport_route_guard"
BEFORE INSERT OR UPDATE
ON "TransportRoute"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_route_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_stop_guard"()
RETURNS trigger AS $$
DECLARE
  route_tenant_id text;
  duplicate_stop_id text;
BEGIN
  SELECT "tenantId" INTO route_tenant_id FROM "TransportRoute" WHERE "id" = NEW."routeId";

  IF route_tenant_id IS NULL OR route_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport stop route is missing or outside tenant';
  END IF;

  IF COALESCE(TRIM(NEW."name"), '') = '' THEN
    RAISE EXCEPTION 'Transport stop name is required';
  END IF;

  IF NEW."sequence" <= 0 THEN
    RAISE EXCEPTION 'Transport stop sequence must be positive';
  END IF;

  SELECT "id" INTO duplicate_stop_id
  FROM "TransportStop"
  WHERE "tenantId" = NEW."tenantId"
    AND "routeId" = NEW."routeId"
    AND "sequence" = NEW."sequence"
    AND "id" <> COALESCE(NEW."id", '')
  LIMIT 1;

  IF duplicate_stop_id IS NOT NULL THEN
    RAISE EXCEPTION 'Transport stop sequence already exists for this route';
  END IF;

  IF NEW."latitude" IS NOT NULL AND (NEW."latitude" < -90 OR NEW."latitude" > 90) THEN
    RAISE EXCEPTION 'Transport stop latitude is invalid';
  END IF;

  IF NEW."longitude" IS NOT NULL AND (NEW."longitude" < -180 OR NEW."longitude" > 180) THEN
    RAISE EXCEPTION 'Transport stop longitude is invalid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_stop_guard" ON "TransportStop";
CREATE TRIGGER "transport_stop_guard"
BEFORE INSERT OR UPDATE
ON "TransportStop"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_stop_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_vehicle_guard"()
RETURNS trigger AS $$
BEGIN
  IF COALESCE(TRIM(NEW."registrationNumber"), '') = '' THEN
    RAISE EXCEPTION 'Transport vehicle registration number is required';
  END IF;

  IF NEW."capacity" <= 0 THEN
    RAISE EXCEPTION 'Transport vehicle capacity must be positive';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE') THEN
    RAISE EXCEPTION 'Invalid transport vehicle status';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_vehicle_guard" ON "TransportVehicle";
CREATE TRIGGER "transport_vehicle_guard"
BEFORE INSERT OR UPDATE
ON "TransportVehicle"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_vehicle_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_driver_assignment_guard"()
RETURNS trigger AS $$
DECLARE
  vehicle_tenant_id text;
  staff_tenant_id text;
  route_tenant_id text;
  overlap_id text;
BEGIN
  SELECT "tenantId" INTO vehicle_tenant_id FROM "TransportVehicle" WHERE "id" = NEW."vehicleId";
  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport driver assignment vehicle is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO staff_tenant_id FROM "Staff" WHERE "id" = NEW."staffId";
  IF staff_tenant_id IS NULL OR staff_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport driver assignment staff is missing or outside tenant';
  END IF;

  IF NEW."routeId" IS NOT NULL THEN
    SELECT "tenantId" INTO route_tenant_id FROM "TransportRoute" WHERE "id" = NEW."routeId";
    IF route_tenant_id IS NULL OR route_tenant_id <> NEW."tenantId" THEN
      RAISE EXCEPTION 'Transport driver assignment route is missing or outside tenant';
    END IF;
  END IF;

  IF NEW."endsAt" IS NOT NULL AND NEW."endsAt" < NEW."startsAt" THEN
    RAISE EXCEPTION 'Transport driver assignment end cannot be before start';
  END IF;

  SELECT "id" INTO overlap_id
  FROM "TransportDriverAssignment"
  WHERE "tenantId" = NEW."tenantId"
    AND "id" <> COALESCE(NEW."id", '')
    AND "vehicleId" = NEW."vehicleId"
    AND "startsAt" <= COALESCE(NEW."endsAt", NEW."startsAt")
    AND ("endsAt" IS NULL OR "endsAt" >= NEW."startsAt")
  LIMIT 1;

  IF overlap_id IS NOT NULL THEN
    RAISE EXCEPTION 'Overlapping transport driver assignment exists for this vehicle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_driver_assignment_guard" ON "TransportDriverAssignment";
CREATE TRIGGER "transport_driver_assignment_guard"
BEFORE INSERT OR UPDATE
ON "TransportDriverAssignment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_driver_assignment_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_student_assignment_guard"()
RETURNS trigger AS $$
DECLARE
  student_tenant_id text;
  route_tenant_id text;
  stop_tenant_id text;
  stop_route_id text;
BEGIN
  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport student assignment student is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO route_tenant_id FROM "TransportRoute" WHERE "id" = NEW."routeId";
  IF route_tenant_id IS NULL OR route_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport student assignment route is missing or outside tenant';
  END IF;

  SELECT "tenantId", "routeId" INTO stop_tenant_id, stop_route_id FROM "TransportStop" WHERE "id" = NEW."stopId";
  IF stop_tenant_id IS NULL OR stop_tenant_id <> NEW."tenantId" OR stop_route_id <> NEW."routeId" THEN
    RAISE EXCEPTION 'Transport student assignment stop is missing, outside tenant, or outside route';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'PAUSED', 'ENDED') THEN
    RAISE EXCEPTION 'Invalid transport student assignment status';
  END IF;

  IF NEW."endedAt" IS NOT NULL AND NEW."endedAt" < NEW."startedAt" THEN
    RAISE EXCEPTION 'Transport student assignment endedAt cannot be before startedAt';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_student_assignment_guard" ON "TransportStudentAssignment";
CREATE TRIGGER "transport_student_assignment_guard"
BEFORE INSERT OR UPDATE
ON "TransportStudentAssignment"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_student_assignment_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_trip_guard"()
RETURNS trigger AS $$
DECLARE
  route_tenant_id text;
  vehicle_tenant_id text;
  assignment_tenant_id text;
  assignment_route_id text;
  assignment_vehicle_id text;
  active_trip_id text;
BEGIN
  SELECT "tenantId" INTO route_tenant_id FROM "TransportRoute" WHERE "id" = NEW."routeId";
  IF route_tenant_id IS NULL OR route_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip route is missing or outside tenant';
  END IF;

  SELECT "tenantId" INTO vehicle_tenant_id FROM "TransportVehicle" WHERE "id" = NEW."vehicleId";
  IF vehicle_tenant_id IS NULL OR vehicle_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip vehicle is missing or outside tenant';
  END IF;

  SELECT "tenantId", "routeId", "vehicleId" INTO assignment_tenant_id, assignment_route_id, assignment_vehicle_id
  FROM "TransportDriverAssignment" WHERE "id" = NEW."driverAssignmentId";

  IF assignment_tenant_id IS NULL OR assignment_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip driver assignment is missing or outside tenant';
  END IF;

  IF assignment_vehicle_id <> NEW."vehicleId" THEN
    RAISE EXCEPTION 'Transport trip driver assignment does not match vehicle';
  END IF;

  IF assignment_route_id IS NOT NULL AND assignment_route_id <> NEW."routeId" THEN
    RAISE EXCEPTION 'Transport trip driver assignment does not match route';
  END IF;

  IF NEW."status" NOT IN ('ACTIVE', 'COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION 'Invalid transport trip status';
  END IF;

  IF NEW."completedAt" IS NOT NULL AND NEW."completedAt" < NEW."startedAt" THEN
    RAISE EXCEPTION 'Transport trip completedAt cannot be before startedAt';
  END IF;

  IF NEW."status" = 'ACTIVE' THEN
    SELECT "id" INTO active_trip_id
    FROM "TransportTrip"
    WHERE "tenantId" = NEW."tenantId"
      AND "id" <> COALESCE(NEW."id", '')
      AND "status" = 'ACTIVE'
      AND ("vehicleId" = NEW."vehicleId" OR ("routeId" = NEW."routeId" AND "direction" = NEW."direction"))
    LIMIT 1;

    IF active_trip_id IS NOT NULL THEN
      RAISE EXCEPTION 'Active transport trip already exists for this vehicle or route direction';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" IN ('COMPLETED', 'CANCELLED') AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Closed transport trip cannot transition silently';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_trip_guard" ON "TransportTrip";
CREATE TRIGGER "transport_trip_guard"
BEFORE INSERT OR UPDATE
ON "TransportTrip"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_trip_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_trip_student_status_guard"()
RETURNS trigger AS $$
DECLARE
  trip_tenant_id text;
  trip_status text;
  trip_route_id text;
  assignment_tenant_id text;
  assignment_route_id text;
  assignment_student_id text;
  assignment_stop_id text;
  student_tenant_id text;
BEGIN
  SELECT "tenantId", "status"::text, "routeId" INTO trip_tenant_id, trip_status, trip_route_id
  FROM "TransportTrip" WHERE "id" = NEW."tripId";

  IF trip_tenant_id IS NULL OR trip_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip student status trip is missing or outside tenant';
  END IF;

  SELECT "tenantId", "routeId", "studentId", "stopId" INTO assignment_tenant_id, assignment_route_id, assignment_student_id, assignment_stop_id
  FROM "TransportStudentAssignment" WHERE "id" = NEW."studentAssignmentId";

  IF assignment_tenant_id IS NULL OR assignment_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip student assignment is missing or outside tenant';
  END IF;

  IF assignment_route_id <> trip_route_id OR assignment_student_id <> NEW."studentId" OR assignment_stop_id <> NEW."stopId" THEN
    RAISE EXCEPTION 'Transport trip student status does not match active assignment';
  END IF;

  SELECT "tenantId" INTO student_tenant_id FROM "Student" WHERE "id" = NEW."studentId";
  IF student_tenant_id IS NULL OR student_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport trip student is missing or outside tenant';
  END IF;

  IF NEW."status" NOT IN ('PENDING', 'BOARDED', 'DROPPED', 'ABSENT') THEN
    RAISE EXCEPTION 'Invalid transport trip student status';
  END IF;

  IF trip_status <> 'ACTIVE' AND TG_OP = 'UPDATE' AND NEW."status" IS DISTINCT FROM OLD."status" THEN
    RAISE EXCEPTION 'Cannot change student boarding status after trip is closed';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'PENDING' AND NEW."status" = 'DROPPED' THEN
    RAISE EXCEPTION 'Cannot drop student before boarded';
  END IF;

  IF NEW."droppedAt" IS NOT NULL AND NEW."boardedAt" IS NULL AND NEW."status" = 'DROPPED' THEN
    RAISE EXCEPTION 'Dropped student must have boardedAt';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_trip_student_status_guard" ON "TransportTripStudentStatus";
CREATE TRIGGER "transport_trip_student_status_guard"
BEFORE INSERT OR UPDATE
ON "TransportTripStudentStatus"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_trip_student_status_guard"();

CREATE OR REPLACE FUNCTION "enforce_transport_location_ping_guard"()
RETURNS trigger AS $$
DECLARE
  trip_tenant_id text;
  trip_status text;
  trip_vehicle_id text;
  trip_driver_assignment_id text;
BEGIN
  SELECT "tenantId", "status"::text, "vehicleId", "driverAssignmentId"
    INTO trip_tenant_id, trip_status, trip_vehicle_id, trip_driver_assignment_id
  FROM "TransportTrip" WHERE "id" = NEW."tripId";

  IF trip_tenant_id IS NULL OR trip_tenant_id <> NEW."tenantId" THEN
    RAISE EXCEPTION 'Transport location trip is missing or outside tenant';
  END IF;

  IF trip_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Transport location pings require active trip';
  END IF;

  IF NEW."vehicleId" <> trip_vehicle_id THEN
    RAISE EXCEPTION 'Transport location vehicle does not match trip vehicle';
  END IF;

  IF NEW."driverAssignmentId" IS NOT NULL AND NEW."driverAssignmentId" <> trip_driver_assignment_id THEN
    RAISE EXCEPTION 'Transport location driver assignment does not match trip';
  END IF;

  IF NEW."latitude" < -90 OR NEW."latitude" > 90 OR NEW."longitude" < -180 OR NEW."longitude" > 180 THEN
    RAISE EXCEPTION 'Transport location coordinates are invalid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transport_location_ping_guard" ON "TransportLocationPing";
CREATE TRIGGER "transport_location_ping_guard"
BEFORE INSERT OR UPDATE
ON "TransportLocationPing"
FOR EACH ROW
EXECUTE FUNCTION "enforce_transport_location_ping_guard"();

CREATE UNIQUE INDEX IF NOT EXISTS "TransportStop_tenant_route_sequence_uidx" ON "TransportStop"("tenantId", "routeId", "sequence");
CREATE INDEX IF NOT EXISTS "TransportDriverAssignment_tenant_vehicle_window_idx" ON "TransportDriverAssignment"("tenantId", "vehicleId", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "TransportDriverAssignment_tenant_staff_window_idx" ON "TransportDriverAssignment"("tenantId", "staffId", "startsAt", "endsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "TransportTrip_tenant_route_direction_active_uidx" ON "TransportTrip"("tenantId", "routeId", "direction") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "TransportTrip_tenant_driver_started_idx" ON "TransportTrip"("tenantId", "driverAssignmentId", "startedAt");
CREATE INDEX IF NOT EXISTS "TransportTripStudentStatus_tenant_trip_status_idx" ON "TransportTripStudentStatus"("tenantId", "tripId", "status");
CREATE INDEX IF NOT EXISTS "TransportLocationPing_tenant_trip_recent_idx" ON "TransportLocationPing"("tenantId", "tripId", "recordedAt" DESC);

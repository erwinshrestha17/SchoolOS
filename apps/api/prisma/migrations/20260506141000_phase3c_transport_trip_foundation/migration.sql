-- Phase 3C: M8B Transport Management trip and live-location foundation

CREATE TYPE "TransportTripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TransportTripDirection" AS ENUM ('PICKUP', 'DROP');
CREATE TYPE "TransportStudentTripStatus" AS ENUM ('PENDING', 'BOARDED', 'DROPPED', 'ABSENT');

ALTER TABLE "TransportDriverAssignment"
  ADD COLUMN IF NOT EXISTS "routeId" TEXT;

ALTER TABLE "TransportStop"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10, 7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10, 7);

ALTER TABLE "TransportVehicle"
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "documentExpiry" TIMESTAMP(3);

CREATE TABLE "TransportStudentAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "stopId" TEXT NOT NULL,
  "pickupDirection" "TransportTripDirection" NOT NULL DEFAULT 'PICKUP',
  "status" "TransportEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransportStudentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportTrip" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverAssignmentId" TEXT NOT NULL,
  "direction" "TransportTripDirection" NOT NULL,
  "status" "TransportTripStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "completedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransportTrip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportTripStudentStatus" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "studentAssignmentId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "stopId" TEXT NOT NULL,
  "status" "TransportStudentTripStatus" NOT NULL DEFAULT 'PENDING',
  "boardedAt" TIMESTAMP(3),
  "droppedAt" TIMESTAMP(3),
  "markedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransportTripStudentStatus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransportLocationPing" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "driverAssignmentId" TEXT,
  "latitude" DECIMAL(10, 7) NOT NULL,
  "longitude" DECIMAL(10, 7) NOT NULL,
  "speedKph" DECIMAL(8, 2),
  "heading" DECIMAL(8, 2),
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TransportLocationPing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransportRoute_tenantId_code_key" ON "TransportRoute"("tenantId", "code");
CREATE UNIQUE INDEX "TransportRoute_tenantId_name_key" ON "TransportRoute"("tenantId", "name");
CREATE UNIQUE INDEX "TransportVehicle_tenantId_registrationNumber_key" ON "TransportVehicle"("tenantId", "registrationNumber");

CREATE INDEX "TransportRoute_tenantId_code_idx" ON "TransportRoute"("tenantId", "code");
CREATE INDEX "TransportRoute_tenantId_name_idx" ON "TransportRoute"("tenantId", "name");
CREATE INDEX "TransportStop_tenantId_routeId_idx" ON "TransportStop"("tenantId", "routeId");
CREATE INDEX "TransportVehicle_tenantId_registrationNumber_idx" ON "TransportVehicle"("tenantId", "registrationNumber");
CREATE INDEX "TransportDriverAssignment_tenantId_staffId_idx" ON "TransportDriverAssignment"("tenantId", "staffId");
CREATE INDEX "TransportDriverAssignment_tenantId_vehicleId_idx" ON "TransportDriverAssignment"("tenantId", "vehicleId");
CREATE INDEX "TransportDriverAssignment_tenantId_routeId_idx" ON "TransportDriverAssignment"("tenantId", "routeId");

CREATE INDEX "TransportStudentAssignment_tenantId_studentId_idx" ON "TransportStudentAssignment"("tenantId", "studentId");
CREATE INDEX "TransportStudentAssignment_tenantId_routeId_idx" ON "TransportStudentAssignment"("tenantId", "routeId");
CREATE INDEX "TransportStudentAssignment_tenantId_stopId_idx" ON "TransportStudentAssignment"("tenantId", "stopId");
CREATE UNIQUE INDEX "TransportStudentAssignment_tenantId_studentId_active_key"
  ON "TransportStudentAssignment"("tenantId", "studentId")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "TransportTrip_tenantId_status_idx" ON "TransportTrip"("tenantId", "status");
CREATE INDEX "TransportTrip_tenantId_routeId_idx" ON "TransportTrip"("tenantId", "routeId");
CREATE INDEX "TransportTrip_tenantId_vehicleId_idx" ON "TransportTrip"("tenantId", "vehicleId");
CREATE INDEX "TransportTrip_tenantId_startedAt_idx" ON "TransportTrip"("tenantId", "startedAt");
CREATE UNIQUE INDEX "TransportTrip_tenantId_vehicleId_active_key"
  ON "TransportTrip"("tenantId", "vehicleId")
  WHERE "status" = 'ACTIVE';

CREATE INDEX "TransportTripStudentStatus_tenantId_tripId_idx" ON "TransportTripStudentStatus"("tenantId", "tripId");
CREATE INDEX "TransportTripStudentStatus_tenantId_studentId_idx" ON "TransportTripStudentStatus"("tenantId", "studentId");
CREATE UNIQUE INDEX "TransportTripStudentStatus_tripId_studentId_key" ON "TransportTripStudentStatus"("tripId", "studentId");

CREATE INDEX "TransportLocationPing_tenantId_tripId_recordedAt_idx" ON "TransportLocationPing"("tenantId", "tripId", "recordedAt");
CREATE INDEX "TransportLocationPing_tenantId_vehicleId_recordedAt_idx" ON "TransportLocationPing"("tenantId", "vehicleId", "recordedAt");

ALTER TABLE "TransportDriverAssignment"
  ADD CONSTRAINT "TransportDriverAssignment_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransportStudentAssignment"
  ADD CONSTRAINT "TransportStudentAssignment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportStudentAssignment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportStudentAssignment_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportStudentAssignment_stopId_fkey"
  FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TransportTrip"
  ADD CONSTRAINT "TransportTrip_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTrip_routeId_fkey"
  FOREIGN KEY ("routeId") REFERENCES "TransportRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTrip_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTrip_driverAssignmentId_fkey"
  FOREIGN KEY ("driverAssignmentId") REFERENCES "TransportDriverAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTrip_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTrip_completedById_fkey"
  FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransportTripStudentStatus"
  ADD CONSTRAINT "TransportTripStudentStatus_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTripStudentStatus_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTripStudentStatus_studentAssignmentId_fkey"
  FOREIGN KEY ("studentAssignmentId") REFERENCES "TransportStudentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTripStudentStatus_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTripStudentStatus_stopId_fkey"
  FOREIGN KEY ("stopId") REFERENCES "TransportStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportTripStudentStatus_markedById_fkey"
  FOREIGN KEY ("markedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TransportLocationPing"
  ADD CONSTRAINT "TransportLocationPing_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportLocationPing_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "TransportTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportLocationPing_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TransportLocationPing_driverAssignmentId_fkey"
  FOREIGN KEY ("driverAssignmentId") REFERENCES "TransportDriverAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "resource", "action", "description")
VALUES
  (gen_random_uuid(), 'transport:routes', 'create', 'Create transport routes'),
  (gen_random_uuid(), 'transport:routes', 'read', 'Read transport routes'),
  (gen_random_uuid(), 'transport:routes', 'update', 'Update transport routes'),
  (gen_random_uuid(), 'transport:vehicles', 'create', 'Create transport vehicles'),
  (gen_random_uuid(), 'transport:vehicles', 'read', 'Read transport vehicles'),
  (gen_random_uuid(), 'transport:vehicles', 'update', 'Update transport vehicles'),
  (gen_random_uuid(), 'transport:assignments', 'create', 'Create transport assignments'),
  (gen_random_uuid(), 'transport:assignments', 'read', 'Read transport assignments'),
  (gen_random_uuid(), 'transport:assignments', 'update', 'Update transport assignments'),
  (gen_random_uuid(), 'transport:trips', 'create', 'Start transport trips'),
  (gen_random_uuid(), 'transport:trips', 'read', 'Read transport trips'),
  (gen_random_uuid(), 'transport:trips', 'update', 'Update transport trips'),
  (gen_random_uuid(), 'transport:location', 'read', 'Read transport latest location'),
  (gen_random_uuid(), 'transport:location', 'update', 'Update transport latest location'),
  (gen_random_uuid(), 'transport:reports', 'read', 'Read transport reports')
ON CONFLICT ("resource", "action") DO NOTHING;

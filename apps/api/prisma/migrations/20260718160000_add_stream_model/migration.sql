-- Tenant-configurable Higher Secondary (+2) stream/faculty label. No
-- taxonomy is hard-coded: each school defines its own stream names.
CREATE TABLE "Stream" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stream_tenantId_name_key" ON "Stream"("tenantId", "name");
CREATE UNIQUE INDEX "Stream_tenantId_code_key" ON "Stream"("tenantId", "code");

ALTER TABLE "Stream" ADD CONSTRAINT "Stream_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Class" ADD COLUMN "streamId" TEXT;

ALTER TABLE "Class" ADD CONSTRAINT "Class_streamId_fkey"
  FOREIGN KEY ("streamId") REFERENCES "Stream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

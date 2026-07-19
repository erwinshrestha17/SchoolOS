-- Nepal administrative geography reference data (provinces, districts, local
-- level types, local levels) plus a generic reference-dataset version table
-- and a reusable, polymorphic-owner Address model.
--
-- These four Nepal* tables are global platform reference data: no tenantId,
-- shared read-only by every tenant. Row data is seeded idempotently by
-- `pnpm --filter @schoolos/api db:seed:geography` from
-- apps/api/prisma/data/nepal-geography.data.ts (generated from
-- /nepal_administrative_data/*.csv), not by this migration.
--
-- Numeric ids are the dataset's own stable identifiers (chosen so reseeding
-- never changes an id already referenced by business data) — they are not
-- asserted to be official government administrative codes. `officialCode`
-- is reserved for those if a verified government code source is added later.

CREATE TABLE "NepalProvince" (
    "id" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameNe" TEXT NOT NULL,
    "headquartersEn" TEXT,
    "headquartersNe" TEXT,
    "officialCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NepalProvince_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NepalProvince_nameEn_key" ON "NepalProvince"("nameEn");
CREATE INDEX "NepalProvince_nameEn_idx" ON "NepalProvince"("nameEn");
CREATE INDEX "NepalProvince_nameNe_idx" ON "NepalProvince"("nameNe");

CREATE TABLE "NepalLocalLevelType" (
    "id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameNe" TEXT NOT NULL,

    CONSTRAINT "NepalLocalLevelType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NepalLocalLevelType_code_key" ON "NepalLocalLevelType"("code");
CREATE UNIQUE INDEX "NepalLocalLevelType_slug_key" ON "NepalLocalLevelType"("slug");

CREATE TABLE "NepalDistrict" (
    "id" INTEGER NOT NULL,
    "provinceId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameNe" TEXT NOT NULL,
    "headquartersEn" TEXT,
    "headquartersNe" TEXT,
    "officialCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NepalDistrict_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NepalDistrict_provinceId_nameEn_key" ON "NepalDistrict"("provinceId", "nameEn");
CREATE INDEX "NepalDistrict_provinceId_idx" ON "NepalDistrict"("provinceId");
CREATE INDEX "NepalDistrict_nameEn_idx" ON "NepalDistrict"("nameEn");
CREATE INDEX "NepalDistrict_nameNe_idx" ON "NepalDistrict"("nameNe");

ALTER TABLE "NepalDistrict"
  ADD CONSTRAINT "NepalDistrict_provinceId_fkey"
  FOREIGN KEY ("provinceId") REFERENCES "NepalProvince"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NepalLocalLevel" (
    "id" INTEGER NOT NULL,
    "districtId" INTEGER NOT NULL,
    "typeId" INTEGER NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameNe" TEXT NOT NULL,
    "officialCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NepalLocalLevel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NepalLocalLevel_districtId_nameEn_key" ON "NepalLocalLevel"("districtId", "nameEn");
CREATE INDEX "NepalLocalLevel_districtId_idx" ON "NepalLocalLevel"("districtId");
CREATE INDEX "NepalLocalLevel_typeId_idx" ON "NepalLocalLevel"("typeId");
CREATE INDEX "NepalLocalLevel_nameEn_idx" ON "NepalLocalLevel"("nameEn");
CREATE INDEX "NepalLocalLevel_nameNe_idx" ON "NepalLocalLevel"("nameNe");

ALTER TABLE "NepalLocalLevel"
  ADD CONSTRAINT "NepalLocalLevel_districtId_fkey"
  FOREIGN KEY ("districtId") REFERENCES "NepalDistrict"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NepalLocalLevel"
  ADD CONSTRAINT "NepalLocalLevel_typeId_fkey"
  FOREIGN KEY ("typeId") REFERENCES "NepalLocalLevelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ReferenceDatasetVersion" (
    "id" TEXT NOT NULL,
    "datasetKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "generatedOn" TIMESTAMP(3) NOT NULL,
    "checksum" TEXT NOT NULL,
    "recordCounts" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "ReferenceDatasetVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferenceDatasetVersion_datasetKey_key" ON "ReferenceDatasetVersion"("datasetKey");

CREATE TYPE "AddressOwnerType" AS ENUM (
  'TENANT',
  'SCHOOL_CAMPUS',
  'STAFF',
  'STUDENT',
  'GUARDIAN',
  'EMERGENCY_CONTACT',
  'TRANSPORT_STOP',
  'VENDOR',
  'ASSET'
);

CREATE TYPE "AddressType" AS ENUM (
  'PERMANENT',
  'CURRENT',
  'MAILING',
  'EMERGENCY',
  'REGISTERED_OFFICE',
  'CAMPUS',
  'OTHER'
);

CREATE TYPE "AddressMappingStatus" AS ENUM (
  'AUTO_MATCHED',
  'MANUAL_REVIEW_REQUIRED',
  'CONFIRMED',
  'UNMATCHED'
);

CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerType" "AddressOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'NP',
    "localLevelId" INTEGER,
    "wardNumber" TEXT,
    "tole" TEXT,
    "streetAddress" TEXT,
    "landmark" TEXT,
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "addressType" "AddressType" NOT NULL DEFAULT 'OTHER',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isHistorical" BOOLEAN NOT NULL DEFAULT false,
    "mappingStatus" "AddressMappingStatus" NOT NULL DEFAULT 'UNMATCHED',
    "legacyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Address_tenantId_idx" ON "Address"("tenantId");
CREATE INDEX "Address_localLevelId_idx" ON "Address"("localLevelId");
CREATE INDEX "Address_tenantId_ownerType_ownerId_idx" ON "Address"("tenantId", "ownerType", "ownerId");
CREATE INDEX "Address_tenantId_addressType_idx" ON "Address"("tenantId", "addressType");

ALTER TABLE "Address"
  ADD CONSTRAINT "Address_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address"
  ADD CONSTRAINT "Address_localLevelId_fkey"
  FOREIGN KEY ("localLevelId") REFERENCES "NepalLocalLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Platform and school identities are separate security domains. Existing
-- installations conventionally use the dedicated `platform` tenant created by
-- `db:seed:platform`; only that exact platform bootstrap row is promoted.
-- If it does not exist, every tenant remains SCHOOL and platform access fails
-- closed until the explicit bootstrap is run.
CREATE TYPE "SecurityDomain" AS ENUM ('SCHOOL', 'PLATFORM');

ALTER TABLE "Tenant"
  ADD COLUMN "securityDomain" "SecurityDomain" NOT NULL DEFAULT 'SCHOOL';

UPDATE "Tenant"
SET "securityDomain" = 'PLATFORM'
WHERE "slug" = 'platform'
  AND "plan" = 'platform';

-- Preserve assignment history, but revoke every active Platform-role grant
-- outside the Platform domain, every cross-tenant grant, and every non-global
-- Platform-domain grant.
UPDATE "UserRole" AS assignment
SET "revokedAt" = NOW(),
    "revokeReason" = COALESCE(
      assignment."revokeReason",
      'Revoked by P0-01 platform security-domain migration'
    )
FROM "Role" AS role, "Tenant" AS tenant, "User" AS principal
WHERE assignment."roleId" = role."id"
  AND assignment."userId" = principal."id"
  AND role."tenantId" = tenant."id"
  AND LEFT(LOWER(BTRIM(role."name")), 9) = 'platform_'
  AND assignment."revokedAt" IS NULL
  AND (
    tenant."securityDomain" <> 'PLATFORM'
    OR assignment."tenantId" IS DISTINCT FROM tenant."id"
    OR principal."tenantId" IS DISTINCT FROM tenant."id"
    OR assignment."scopeId" IS DISTINCT FROM 'global'
  );

-- Existing support overrides were issued without a capability scope. Preserve
-- their audit history but revoke any still-active session before enforcing the
-- new fail-closed boundary.
UPDATE "SupportOverride"
SET "isActive" = false
WHERE "isActive" = true;

ALTER TABLE "SupportOverride"
  ADD COLUMN "permissionScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SupportOverride"
  ADD CONSTRAINT "support_override_read_only_check"
    CHECK ("readOnly" = true),
  ADD CONSTRAINT "support_override_active_scope_check"
    CHECK (NOT "isActive" OR cardinality("permissionScopes") > 0),
  ADD CONSTRAINT "support_override_approved_scope_check"
    CHECK (
      "permissionScopes" <@ ARRAY[
        'SCHOOL_PROFILE',
        'STUDENT_RECORDS',
        'ATTENDANCE',
        'ACADEMICS',
        'HOMEWORK_TIMETABLE',
        'NOTICES_DELIVERY'
      ]::TEXT[]
    ),
  -- Legacy sessions are retained as inactive audit history. The bounded
  -- expiry invariant is enforced whenever a session is active.
  ADD CONSTRAINT "support_override_expiry_check"
    CHECK (
      NOT "isActive"
      OR (
        "expiresAt" > "startsAt"
        AND "expiresAt" <= "startsAt" + INTERVAL '60 minutes'
      )
    );

CREATE INDEX "SupportOverride_platformUserId_tenantId_isActive_expiresAt_idx"
  ON "SupportOverride"("platformUserId", "tenantId", "isActive", "expiresAt");

CREATE UNIQUE INDEX "SupportOverride_one_active_per_platform_user_idx"
  ON "SupportOverride"("platformUserId")
  WHERE "isActive" = true;

-- Leave legacy school Role rows in place so historical UserRole audit links
-- remain intact, but remove every permission grant. Runtime and management
-- services also hide and reject these reserved rows.
DELETE FROM "RolePermission" AS rp
USING "Role" AS role, "Tenant" AS tenant
WHERE rp."roleId" = role."id"
  AND role."tenantId" = tenant."id"
  AND tenant."securityDomain" = 'SCHOOL'
  AND LEFT(LOWER(BTRIM(role."name")), 9) = 'platform_';

-- CreateEnum
CREATE TYPE "RoleScopeType" AS ENUM ('TENANT', 'BRANCH', 'ACADEMIC_YEAR', 'CLASS', 'SECTION', 'SUBJECT', 'DEPARTMENT', 'STUDENT', 'STAFF', 'FINANCE_ACCOUNT');

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT "UserRole_roleId_fkey";

-- CreateTable
CREATE TABLE "RoleScopeGrant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userRoleAssignmentId" TEXT NOT NULL,
    "scopeType" "RoleScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "RoleScopeGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleScopeGrant_tenantId_userRoleAssignmentId_revokedAt_expi_idx" ON "RoleScopeGrant"("tenantId", "userRoleAssignmentId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "RoleScopeGrant_tenantId_scopeType_scopeId_idx" ON "RoleScopeGrant"("tenantId", "scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_tenantId_key" ON "User"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_id_tenantId_key" ON "Role"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_id_tenantId_key" ON "UserRole"("id", "tenantId");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_tenantId_fkey" FOREIGN KEY ("roleId", "tenantId") REFERENCES "Role"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleScopeGrant" ADD CONSTRAINT "RoleScopeGrant_userRoleAssignmentId_tenantId_fkey" FOREIGN KEY ("userRoleAssignmentId", "tenantId") REFERENCES "UserRole"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;


-- Empty or inverted grant intervals never authorize. Null expiry means no end.
ALTER TABLE "RoleScopeGrant" ADD CONSTRAINT "RoleScopeGrant_interval_check"
CHECK ("expiresAt" IS NULL OR "expiresAt" > "effectiveFrom");
CREATE UNIQUE INDEX "RoleScopeGrant_active_target_key"
ON "RoleScopeGrant" ("userRoleAssignmentId", "scopeType", "scopeId") WHERE "revokedAt" IS NULL;

-- Deterministic legacy migration. An id matching several types is NOT guessed.
WITH candidates AS (
  SELECT u."id" AS assignment, u."tenantId", 'TENANT'::"RoleScopeType" AS type, u."tenantId" AS target
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId"
  WHERE t."securityDomain"='SCHOOL' AND (u."scopeId" IS NULL OR u."scopeId"=u."tenantId")
  UNION ALL SELECT u."id", u."tenantId", 'ACADEMIC_YEAR'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "AcademicYear" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'CLASS'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "Class" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'SECTION'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "Section" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'SUBJECT'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "Subject" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'STUDENT'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "Student" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'STAFF'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "Staff" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
  UNION ALL SELECT u."id", u."tenantId", 'FINANCE_ACCOUNT'::"RoleScopeType", x."id"
  FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
  JOIN "ChartAccount" x ON x."id"=u."scopeId" AND x."tenantId"=u."tenantId"
), unambiguous AS (
  SELECT *, count(*) OVER (PARTITION BY assignment) AS matches FROM candidates
)
INSERT INTO "RoleScopeGrant" ("id", "tenantId", "userRoleAssignmentId", "scopeType", "scopeId", "effectiveFrom", "expiresAt", "createdById", "revokedAt", "revokedById")
SELECT gen_random_uuid()::text, c."tenantId", c.assignment, c.type, c.target, u."assignedAt", NULL, u."assignedById", u."revokedAt", u."revokedById"
FROM unambiguous c JOIN "UserRole" u ON u."id"=c.assignment
WHERE c.matches=1 AND (u."expiresAt" IS NULL OR u."expiresAt">u."assignedAt");

-- Unmapped grants remain in UserRole as history, confer NO authority and require review.
INSERT INTO "AuditLog" ("id", "tenantId", "action", "resource", "resourceId", "after", "createdAt")
SELECT gen_random_uuid()::text, u."tenantId", 'scope_migration_review_required', 'user_role', u."id",
jsonb_build_object('reasonCode', 'LEGACY_SCOPE_UNRESOLVED'), CURRENT_TIMESTAMP
FROM "UserRole" u JOIN "Tenant" t ON t."id"=u."tenantId" AND t."securityDomain"='SCHOOL'
WHERE NOT EXISTS (SELECT 1 FROM "RoleScopeGrant" g WHERE g."userRoleAssignmentId"=u."id");

-- Ordinary provisioning remains compatible. Every new unrestricted school assignment
-- receives an explicit typed TENANT grant in the same database transaction.
CREATE FUNCTION schoolos_initialize_role_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE domain "SecurityDomain";
BEGIN
  SELECT "securityDomain" INTO domain FROM "Tenant" WHERE "id"=NEW."tenantId";
  IF domain='SCHOOL' THEN
    IF NEW."scopeId" IS NOT NULL THEN
      RAISE EXCEPTION 'Legacy school scope writes require an explicit typed grant' USING ERRCODE='23514';
    END IF;
    INSERT INTO "RoleScopeGrant" ("id", "tenantId", "userRoleAssignmentId", "scopeType", "scopeId", "effectiveFrom", "expiresAt", "createdById")
    VALUES (gen_random_uuid()::text, NEW."tenantId", NEW."id", 'TENANT', NEW."tenantId", NEW."assignedAt", NULL, NEW."assignedById");
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "UserRole_initialize_typed_scope" AFTER INSERT ON "UserRole"
FOR EACH ROW EXECUTE FUNCTION schoolos_initialize_role_scope();

CREATE FUNCTION schoolos_validate_role_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_table text; target_tenant text; assignment_id text; assignment_tenant text;
BEGIN
  assignment_id := NEW."userRoleAssignmentId";
  assignment_tenant := NEW."tenantId";
  -- Check final transactional state, so reason-bound replacements can revoke before inserting.
  IF EXISTS (
    SELECT 1 FROM "RoleScopeGrant" g WHERE g."userRoleAssignmentId"=assignment_id
      AND g."revokedAt" IS NULL AND g."scopeType"='TENANT'
  ) AND (SELECT count(*) FROM "RoleScopeGrant" g WHERE g."userRoleAssignmentId"=assignment_id AND g."revokedAt" IS NULL)>1 THEN
    RAISE EXCEPTION 'Conflicting role scope dimensions' USING ERRCODE='23514';
  END IF;
  IF NEW."revokedAt" IS NOT NULL THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM "Tenant" t WHERE t."id"=assignment_tenant AND t."securityDomain"='SCHOOL') THEN
    RAISE EXCEPTION 'School scope requires a school tenant' USING ERRCODE='23514';
  END IF;
  IF NEW."scopeType"='TENANT' THEN
    IF NEW."scopeId"<>assignment_tenant THEN RAISE EXCEPTION 'Invalid scope target' USING ERRCODE='23514'; END IF;
    RETURN NEW;
  END IF;
  target_table := CASE NEW."scopeType"
    WHEN 'ACADEMIC_YEAR' THEN 'AcademicYear' WHEN 'CLASS' THEN 'Class'
    WHEN 'SECTION' THEN 'Section' WHEN 'SUBJECT' THEN 'Subject'
    WHEN 'STUDENT' THEN 'Student' WHEN 'STAFF' THEN 'Staff'
    WHEN 'FINANCE_ACCOUNT' THEN 'ChartAccount' ELSE NULL END;
  IF target_table IS NULL THEN RAISE EXCEPTION 'Unsupported scope target' USING ERRCODE='23514'; END IF;
  EXECUTE format('SELECT "tenantId" FROM %I WHERE "id"=$1 FOR KEY SHARE', target_table) INTO target_tenant USING NEW."scopeId";
  IF target_tenant IS DISTINCT FROM assignment_tenant THEN RAISE EXCEPTION 'Invalid scope target' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "RoleScopeGrant_validate_target" AFTER INSERT OR UPDATE ON "RoleScopeGrant"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION schoolos_validate_role_scope();

CREATE FUNCTION schoolos_reject_legacy_scope_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."scopeId" IS DISTINCT FROM OLD."scopeId" THEN
    RAISE EXCEPTION 'Legacy scopeId is immutable; use typed scopes' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "UserRole_legacy_scope_immutable" BEFORE UPDATE OF "scopeId" ON "UserRole"
FOR EACH ROW EXECUTE FUNCTION schoolos_reject_legacy_scope_update();

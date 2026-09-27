-- Supersession records a deliberate replacement; revocation must not erase a restrictive dimension.
ALTER TABLE "RoleScopeGrant" ADD COLUMN "supersededAt" TIMESTAMP(3);
CREATE INDEX "RoleScopeGrant_current_assignment_idx" ON "RoleScopeGrant" ("tenantId", "userRoleAssignmentId") WHERE "supersededAt" IS NULL;

CREATE OR REPLACE FUNCTION schoolos_validate_role_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_table text; target_tenant text; assignment_id text; assignment_tenant text;
BEGIN
  assignment_id := NEW."userRoleAssignmentId";
  assignment_tenant := NEW."tenantId";
  -- Check final transactional state, so reason-bound replacements can revoke before inserting.
  IF EXISTS (
    SELECT 1 FROM "RoleScopeGrant" g WHERE g."userRoleAssignmentId"=assignment_id
      AND g."supersededAt" IS NULL AND g."scopeType"='TENANT'
  ) AND (SELECT count(*) FROM "RoleScopeGrant" g WHERE g."userRoleAssignmentId"=assignment_id AND g."supersededAt" IS NULL)>1 THEN
    RAISE EXCEPTION 'Conflicting role scope dimensions' USING ERRCODE='23514';
  END IF;
  IF NEW."supersededAt" IS NOT NULL OR NEW."revokedAt" IS NOT NULL THEN RETURN NEW; END IF;
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

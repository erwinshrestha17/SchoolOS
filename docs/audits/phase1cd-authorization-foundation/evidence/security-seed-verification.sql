DO $$
DECLARE fixture_users integer; invalid_users integer;
BEGIN
  SELECT count(*) INTO fixture_users FROM "User" u JOIN "Tenant" t ON t.id=u."tenantId"
  WHERE t.slug='default-school' AND u.email IN ('security-e2e-admin@schoolos.test','password-e2e-user@schoolos.test');
  SELECT count(*) INTO invalid_users FROM "User" u JOIN "Tenant" t ON t.id=u."tenantId"
  WHERE t.slug='default-school' AND u.email IN ('security-e2e-admin@schoolos.test','password-e2e-user@schoolos.test')
  AND ((SELECT count(*) FROM "UserRole" r WHERE r."userId"=u.id) <> 1
  OR NOT EXISTS (SELECT 1 FROM "UserRole" r JOIN "RoleScopeGrant" s ON s."userRoleAssignmentId"=r.id
    WHERE r."userId"=u.id AND r."tenantId"=u."tenantId" AND r."scopeId" IS NULL
    AND s."tenantId"=u."tenantId" AND s."scopeType"='TENANT' AND s."scopeId"=u."tenantId"
    AND s."supersededAt" IS NULL AND s."revokedAt" IS NULL));
  IF fixture_users<>2 OR invalid_users<>0 THEN RAISE EXCEPTION 'Invalid account-security seed scopes or duplicate roles'; END IF;
  RAISE NOTICE 'PASS: two repeated fixtures retain one explicit same-tenant scope each';
END $$;

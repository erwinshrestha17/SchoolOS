"use client";

import { AuditLogWorkspace } from "../../../components/settings/audit-log-workspace";
import { PermissionDenied } from "../../../components/ui/permission-denied";
import { usePermissionAccess } from "../../../lib/permissions-ui";
import { useSchoolWebPersona } from "../../../lib/school-web-persona";

export default function PrincipalLeadershipAuditPage() {
  const persona = useSchoolWebPersona();
  const access = usePermissionAccess();

  if (access.resolution === "loading") return null;
  if (persona !== "principal" || !access.hasPermission("settings:audit:read")) {
    return (
      <PermissionDenied
        title="Leadership Audit unavailable"
        description="This read-only school audit view is available only to Principals with audit access."
      />
    );
  }

  return <AuditLogWorkspace />;
}

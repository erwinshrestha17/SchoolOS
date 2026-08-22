import type { PermissionKey } from "./permissions.js";
import type { SupportOverrideScope } from "./types/auth.js";

/**
 * Purpose-limited, read-only scopes available to a Platform operator while an
 * audited support override is active. Financial, payroll, protected-file, and
 * security administration access are intentionally absent until SchoolOS has
 * an approved step-up/approval workflow for those sensitive surfaces.
 */
export const SUPPORT_OVERRIDE_SCOPE_DEFINITIONS = [
  {
    key: "SCHOOL_PROFILE",
    label: "School profile",
    description: "School identity and academic structure configuration.",
    entryPath: "/dashboard/settings/school/identity",
    permissions: [
      "tenants:read",
      "settings:read_public",
      "academic_years:read",
      "classes:read",
      "sections:read",
      "streams:read",
    ],
  },
  {
    key: "STUDENT_RECORDS",
    label: "Student records",
    description: "Student, enrollment, and guardian records.",
    entryPath: "/dashboard/students",
    permissions: [
      "settings:read_public",
      "students:read",
      "enrollments:read",
      "guardians:read",
      "academic_years:read",
      "classes:read",
      "sections:read",
    ],
  },
  {
    key: "ATTENDANCE",
    label: "Attendance",
    description: "Submitted attendance, registers, and conflict evidence.",
    entryPath: "/dashboard/attendance",
    permissions: [
      "settings:read_public",
      "attendance:read",
      "academic_years:read",
      "classes:read",
      "sections:read",
    ],
  },
  {
    key: "ACADEMICS",
    label: "Academics and results",
    description: "Academic setup, marks, results, and report-card evidence.",
    entryPath: "/dashboard/academics",
    permissions: [
      "settings:read_public",
      "academics:read",
      "results:read",
      "marks:read",
      "exam-terms:read",
      "assessment-components:read",
      "cas-records:read",
      "academic_years:read",
      "classes:read",
      "sections:read",
    ],
  },
  {
    key: "HOMEWORK_TIMETABLE",
    label: "Homework and timetable",
    description: "Published homework and timetable information.",
    entryPath: "/dashboard/homework",
    permissions: [
      "settings:read_public",
      "homework:read_published",
      "timetable:read_published",
      "academic_years:read",
      "classes:read",
      "sections:read",
    ],
  },
  {
    key: "NOTICES_DELIVERY",
    label: "Notices and delivery",
    description: "Published notices and delivery diagnostics.",
    entryPath: "/dashboard/notices",
    permissions: [
      "settings:read_public",
      "notices:read",
      "notifications:view_delivery_diagnostics",
    ],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  entryPath: string;
  permissions: readonly PermissionKey[];
}>;

export const SUPPORT_OVERRIDE_SCOPES: readonly SupportOverrideScope[] =
  SUPPORT_OVERRIDE_SCOPE_DEFINITIONS.map(({ key }) => key);

const SUPPORT_OVERRIDE_SCOPE_KEYS = new Set<string>(SUPPORT_OVERRIDE_SCOPES);

export function isSupportOverrideScope(
  value: string,
): value is SupportOverrideScope {
  return SUPPORT_OVERRIDE_SCOPE_KEYS.has(value);
}

export function resolveSupportOverridePermissions(
  scopes: readonly string[],
): PermissionKey[] {
  const permissions = new Set<PermissionKey>();

  for (const definition of SUPPORT_OVERRIDE_SCOPE_DEFINITIONS) {
    if (!scopes.includes(definition.key)) continue;
    for (const permission of definition.permissions) {
      permissions.add(permission);
    }
  }

  return [...permissions];
}

export type EnterSupportOverridePayload = {
  tenantId: string;
  reason: string;
  scopes: SupportOverrideScope[];
  durationMinutes?: number;
};

export type EnterSupportOverrideResult = {
  success: true;
  overrideId: string;
  expiresAt: string;
  scopes: SupportOverrideScope[];
  readOnly: true;
};

export type SupportOverrideBrowserContext = {
  version: 1;
  overrideId: string;
  tenantId: string;
  reason: string;
  scopes: SupportOverrideScope[];
  readOnly: true;
  expiresAt: string;
};

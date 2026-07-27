/**
 * Canonical Teacher Web capability matrix (Teacher Persona spec sections 2, 3
 * and 14).
 *
 * A Teacher's effective authority is:
 *
 *   Base Teacher Access
 *   + Active Class/Subject Teacher Assignments   (resolved per-record on the
 *                                                 backend by TeacherScopeService)
 *   + Approved Delegations                       (resolved here, from the
 *                                                 permissions the delegated
 *                                                 role actually grants)
 *
 * This module owns only the *second* half of that: which Teacher Web
 * surfaces (routes, nav entries, tabs, filters, page actions) a signed-in
 * user may see, given the permission set the backend issued for them.
 * Per-record assignment scope (which class/section/subject/student) is not
 * decided here — it is decided by the backend for every request.
 *
 * Two hard rules:
 *
 *  1. Capabilities are derived from *permissions*, never from role names.
 *     That is what makes delegated authority work: a teacher who is also the
 *     exam coordinator simply holds `exam-terms:manage`, so
 *     `TeacherCapability.EXAM_TERM_ADMIN` resolves true for them and for
 *     nobody else. Adding a role name to a component check would break that.
 *
 *  2. This is UX only. The backend `@Permissions(...)` guards remain the
 *     authorization authority for every route and every request. Nothing here
 *     may be used to *grant* access — only to avoid rendering a surface the
 *     backend would reject.
 */

import type { PermissionKey } from "./permissions.js";

/**
 * Administrative surfaces inside the Teacher Web shell. Each one is a thing an
 * ordinary teacher must not see, but that a delegated teacher (coordinator,
 * moderator, department head, teacher-librarian) legitimately may.
 */
export enum TeacherCapability {
  /** Timetable builder, versions, requirements, conflicts, publishing. */
  TIMETABLE_ADMIN = "TIMETABLE_ADMIN",
  /** School-wide substitution administration (not "my substitutions"). */
  SUBSTITUTION_ADMIN = "SUBSTITUTION_ADMIN",
  /** Exam-term creation, publication, locking, school-wide weighting. */
  EXAM_TERM_ADMIN = "EXAM_TERM_ADMIN",
  /** Academic structure administration: components, promotion, retakes. */
  ACADEMIC_STRUCTURE_ADMIN = "ACADEMIC_STRUCTURE_ADMIN",
  /** Report-card publishing and mark-lock administration. */
  REPORT_CARD_ADMIN = "REPORT_CARD_ADMIN",
  /** Activity moderation queue for other people's posts. */
  ACTIVITY_MODERATE = "ACTIVITY_MODERATE",
  /** Notice authoring/approval/scheduling for a school-wide audience. */
  NOTICE_ADMIN = "NOTICE_ADMIN",
  /** Global delivery diagnostics, failure/retry queues, provider metrics. */
  NOTICE_DELIVERY_OPS = "NOTICE_DELIVERY_OPS",
  /** Library catalog/copy/borrower/fine administration. */
  LIBRARY_ADMIN = "LIBRARY_ADMIN",
  /** School configuration: roles, integrations, modules, global policies. */
  SCHOOL_SETTINGS_ADMIN = "SCHOOL_SETTINGS_ADMIN",
  /** School-wide student directory beyond the teacher's own roster. */
  STUDENT_DIRECTORY_ADMIN = "STUDENT_DIRECTORY_ADMIN",
  /** Cross-staff HR/payroll administration (not staff self-service). */
  STAFF_ADMIN = "STAFF_ADMIN",
  /** Marks entry for assigned assessments. Ordinary teachers hold this. */
  MARKS_ENTRY = "MARKS_ENTRY",
  /** Attendance marking for assigned classes. Ordinary teachers hold this. */
  ATTENDANCE_MARK = "ATTENDANCE_MARK",
  /** Homework authoring for assigned subjects. Ordinary teachers hold this. */
  HOMEWORK_AUTHOR = "HOMEWORK_AUTHOR",
  /** Activity authoring for assigned classes. Ordinary teachers hold this. */
  ACTIVITY_AUTHOR = "ACTIVITY_AUTHOR",
}

/**
 * Permission(s) that confer each capability. ANY match grants the capability,
 * mirroring the `permissionMode: 'any'` default used by the route gates and
 * the backend's own permission aliases.
 */
const CAPABILITY_PERMISSIONS: Record<TeacherCapability, PermissionKey[]> = {
  [TeacherCapability.TIMETABLE_ADMIN]: [
    "timetable:manage",
    "timetable:create",
    "timetable:update",
    "timetable:delete",
    "timetable:publish",
  ],
  [TeacherCapability.SUBSTITUTION_ADMIN]: [
    "timetable:substitute",
    "timetable:manage",
  ],
  [TeacherCapability.EXAM_TERM_ADMIN]: ["exam-terms:manage", "academics:manage"],
  [TeacherCapability.ACADEMIC_STRUCTURE_ADMIN]: [
    "assessment-components:manage",
    "academics:manage",
  ],
  [TeacherCapability.REPORT_CARD_ADMIN]: [
    "academics:manage_report_cards",
    "academics:manage",
  ],
  [TeacherCapability.ACTIVITY_MODERATE]: ["activity_feed:moderate"],
  [TeacherCapability.NOTICE_ADMIN]: [
    "notices:create",
    "notices:edit",
    "notices:publish",
    "notices:approve",
    "notices:schedule",
  ],
  [TeacherCapability.NOTICE_DELIVERY_OPS]: [
    "notifications:view_delivery_diagnostics",
    "notifications:retry_deliveries",
    "communications:read_deliveries",
    "communications:retry_deliveries",
    "notices:read_reports",
  ],
  [TeacherCapability.LIBRARY_ADMIN]: [
    "library:manage",
    "library:books:create",
    "library:copies:create",
    "library:issues:create",
    "library:fines:post",
    "library:reports:read",
  ],
  [TeacherCapability.SCHOOL_SETTINGS_ADMIN]: [
    "settings:manage",
    "settings:delegate",
    "settings:academic:manage",
    "settings:identity:manage",
    "settings:communication:manage",
    "settings:security:manage",
    "roles:manage_permissions",
  ],
  [TeacherCapability.STUDENT_DIRECTORY_ADMIN]: [
    "students:create",
    "students:update",
    "students:manage_lifecycle",
  ],
  [TeacherCapability.STAFF_ADMIN]: [
    "hr:manage",
    "hr:staff:update",
    "payroll:manage",
  ],
  [TeacherCapability.MARKS_ENTRY]: ["academics:enter_marks", "marks:manage"],
  [TeacherCapability.ATTENDANCE_MARK]: ["attendance:mark"],
  [TeacherCapability.HOMEWORK_AUTHOR]: ["homework:create"],
  [TeacherCapability.ACTIVITY_AUTHOR]: ["activity_feed:create"],
};

/**
 * Roles whose holders get the administrative navigation tree. A user with any
 * of these is not "an ordinary teacher" even if they also teach.
 */
const ADMINISTRATIVE_ROLES = [
  "admin",
  "principal",
  "school_config_owner",
  "accountant",
  "hr_manager",
  "librarian",
  "platform_super_admin",
  "platform_support",
  "platform_billing_admin",
] as const;

const TEACHING_ROLES = ["teacher", "subject_teacher"] as const;

export interface TeacherPersonaInput {
  roles: readonly string[];
  permissions: readonly string[];
}

export interface TeacherPersonaResolution {
  /** True when this session should get the teacher-scoped shell. */
  isTeacherPersona: boolean;
  /** Every administrative capability this session actually holds. */
  capabilities: ReadonlySet<TeacherCapability>;
}

export function hasTeacherCapability(
  permissions: readonly string[],
  capability: TeacherCapability,
): boolean {
  const granted = CAPABILITY_PERMISSIONS[capability];
  return granted.some((permission) => permissions.includes(permission));
}

export function resolveTeacherCapabilities(
  permissions: readonly string[],
): ReadonlySet<TeacherCapability> {
  const resolved = new Set<TeacherCapability>();
  for (const capability of Object.values(TeacherCapability)) {
    if (hasTeacherCapability(permissions, capability)) {
      resolved.add(capability);
    }
  }
  return resolved;
}

/**
 * A session is the "teacher persona" when it holds a teaching role and holds
 * no administrative role. Delegated capabilities do *not* flip a teacher back
 * to the administrative shell — an exam-coordinator teacher keeps the teacher
 * workspace and additionally gains the exam-term surfaces.
 */
export function resolveTeacherPersona(
  input: TeacherPersonaInput,
): TeacherPersonaResolution {
  const isTeacherPersona =
    input.roles.some((role) =>
      (TEACHING_ROLES as readonly string[]).includes(role),
    ) &&
    !input.roles.some((role) =>
      (ADMINISTRATIVE_ROLES as readonly string[]).includes(role),
    );

  return {
    isTeacherPersona,
    capabilities: resolveTeacherCapabilities(input.permissions),
  };
}

/**
 * Teacher Web routes that must be unreachable without the matching
 * capability. Ordered most-specific-first; the first matching prefix wins,
 * exactly like the dashboard route-gate table it feeds.
 *
 * `redirectTo` is the nearest valid teacher page: a teacher who types a
 * restricted URL lands somewhere useful instead of on an administrator screen
 * carrying a large permission error.
 */
export interface TeacherRestrictedRoute {
  prefix: string;
  capability: TeacherCapability;
  label: string;
  redirectTo: string;
}

export const TEACHER_RESTRICTED_ROUTES: TeacherRestrictedRoute[] = [
  // --- M6 Timetable -------------------------------------------------------
  {
    prefix: "/dashboard/timetable/builder",
    capability: TeacherCapability.TIMETABLE_ADMIN,
    label: "Timetable builder",
    redirectTo: "/dashboard/timetable",
  },
  {
    prefix: "/dashboard/timetable/versions",
    capability: TeacherCapability.TIMETABLE_ADMIN,
    label: "Timetable versions",
    redirectTo: "/dashboard/timetable",
  },
  {
    prefix: "/dashboard/timetable/conflicts",
    capability: TeacherCapability.TIMETABLE_ADMIN,
    label: "Timetable conflict review",
    redirectTo: "/dashboard/timetable",
  },
  {
    prefix: "/dashboard/timetable/workload",
    capability: TeacherCapability.TIMETABLE_ADMIN,
    label: "Teacher workload administration",
    redirectTo: "/dashboard/timetable",
  },
  {
    prefix: "/dashboard/timetable/substitutions",
    capability: TeacherCapability.SUBSTITUTION_ADMIN,
    label: "Substitution administration",
    redirectTo: "/dashboard/timetable",
  },
  // --- M4 Academics -------------------------------------------------------
  {
    prefix: "/dashboard/academics/exam-terms",
    capability: TeacherCapability.EXAM_TERM_ADMIN,
    label: "Exam term administration",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/assessment-components",
    capability: TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
    label: "Assessment component administration",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/promotion",
    capability: TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
    label: "Student promotion",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/retakes",
    capability: TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
    label: "Retake administration",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/publishing",
    capability: TeacherCapability.REPORT_CARD_ADMIN,
    label: "Report-card publishing",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/locks",
    capability: TeacherCapability.REPORT_CARD_ADMIN,
    label: "Mark lock administration",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/exams",
    capability: TeacherCapability.EXAM_TERM_ADMIN,
    label: "Exam administration",
    redirectTo: "/dashboard/academics/marks",
  },
  {
    prefix: "/dashboard/academics/learning-improvement",
    capability: TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
    label: "Learning improvement administration",
    redirectTo: "/dashboard/academics/marks",
  },
  // --- M5 Activities ------------------------------------------------------
  {
    prefix: "/dashboard/activity/moderation",
    capability: TeacherCapability.ACTIVITY_MODERATE,
    label: "Activity moderation",
    redirectTo: "/dashboard/activity",
  },
  {
    prefix: "/dashboard/activity/reports",
    capability: TeacherCapability.ACTIVITY_MODERATE,
    label: "Activity reports",
    redirectTo: "/dashboard/activity",
  },
  {
    prefix: "/dashboard/activity/deliveries",
    capability: TeacherCapability.NOTICE_DELIVERY_OPS,
    label: "Activity delivery diagnostics",
    redirectTo: "/dashboard/activity",
  },
  {
    prefix: "/dashboard/activity/observations",
    capability: TeacherCapability.ACTIVITY_MODERATE,
    label: "Activity observations",
    redirectTo: "/dashboard/activity",
  },
  {
    prefix: "/dashboard/activity/parent",
    capability: TeacherCapability.ACTIVITY_MODERATE,
    label: "Parent activity view",
    redirectTo: "/dashboard/activity",
  },
  // --- M15 Notices / M12 Delivery ----------------------------------------
  {
    prefix: "/dashboard/notices/deliveries",
    capability: TeacherCapability.NOTICE_DELIVERY_OPS,
    label: "Delivery logs",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/notices/failures",
    capability: TeacherCapability.NOTICE_DELIVERY_OPS,
    label: "Failure and retry centre",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/notices/approvals",
    capability: TeacherCapability.NOTICE_ADMIN,
    label: "Notice approvals",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/notices/scheduled",
    capability: TeacherCapability.NOTICE_ADMIN,
    label: "Scheduled sends",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/communications/provider-diagnostics",
    capability: TeacherCapability.NOTICE_DELIVERY_OPS,
    label: "Provider diagnostics",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/communications/recipients",
    capability: TeacherCapability.NOTICE_ADMIN,
    label: "Audience lifecycle",
    redirectTo: "/dashboard/notices",
  },
  {
    prefix: "/dashboard/communications/templates",
    capability: TeacherCapability.NOTICE_ADMIN,
    label: "Communication templates",
    redirectTo: "/dashboard/notices",
  },
  // --- M8 Library ---------------------------------------------------------
  {
    prefix: "/dashboard/library/catalog",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Catalog administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/books",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Book administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/copies",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Copy and barcode administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/issue-return",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Issue and return desk",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/issues",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Circulation administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/borrowers",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Borrower administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/overdue",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Overdue operations",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/fines",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Fine posting",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/reservations",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Reservation administration",
    redirectTo: "/dashboard/library",
  },
  {
    prefix: "/dashboard/library/reports",
    capability: TeacherCapability.LIBRARY_ADMIN,
    label: "Library reports",
    redirectTo: "/dashboard/library",
  },
  // --- M1 Students --------------------------------------------------------
  {
    prefix: "/dashboard/students",
    capability: TeacherCapability.STUDENT_DIRECTORY_ADMIN,
    label: "Student directory",
    redirectTo: "/dashboard/my-students",
  },
  {
    prefix: "/dashboard/admissions",
    capability: TeacherCapability.STUDENT_DIRECTORY_ADMIN,
    label: "Admissions",
    redirectTo: "/dashboard/my-students",
  },
  // --- M7 HR --------------------------------------------------------------
  {
    prefix: "/dashboard/hr",
    capability: TeacherCapability.STAFF_ADMIN,
    label: "HR administration",
    redirectTo: "/dashboard/my-workspace",
  },
  {
    prefix: "/dashboard/payroll",
    capability: TeacherCapability.STAFF_ADMIN,
    label: "Payroll administration",
    redirectTo: "/dashboard/my-workspace",
  },
  {
    prefix: "/dashboard/staff",
    capability: TeacherCapability.STAFF_ADMIN,
    label: "Staff directory",
    redirectTo: "/dashboard/my-workspace",
  },
  // --- Reports ------------------------------------------------------------
  {
    prefix: "/dashboard/reports",
    capability: TeacherCapability.ACADEMIC_STRUCTURE_ADMIN,
    label: "School reports and exports",
    redirectTo: "/dashboard",
  },
];

/**
 * Personal settings a teacher always keeps. Everything else under
 * `/dashboard/settings` is school administration and needs
 * `SCHOOL_SETTINGS_ADMIN`.
 */
export const TEACHER_PERSONAL_SETTINGS_PREFIXES = [
  "/dashboard/settings/personal",
  "/dashboard/settings/profile",
  "/dashboard/settings/my-profile",
] as const;

export function isTeacherPersonalSettingsPath(pathname: string): boolean {
  return TEACHER_PERSONAL_SETTINGS_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Resolves the restriction (if any) that applies to `pathname` for a teacher
 * holding `capabilities`. Returns `null` when the teacher may open the route.
 */
export function resolveTeacherRouteRestriction(
  pathname: string,
  capabilities: ReadonlySet<TeacherCapability>,
): TeacherRestrictedRoute | null {
  if (
    pathMatchesPrefix(pathname, "/dashboard/settings") &&
    !isTeacherPersonalSettingsPath(pathname)
  ) {
    if (capabilities.has(TeacherCapability.SCHOOL_SETTINGS_ADMIN)) {
      return null;
    }
    return {
      prefix: "/dashboard/settings",
      capability: TeacherCapability.SCHOOL_SETTINGS_ADMIN,
      label: "School settings",
      redirectTo: "/dashboard/settings/personal/profile",
    };
  }

  const restriction = TEACHER_RESTRICTED_ROUTES.find((route) =>
    pathMatchesPrefix(pathname, route.prefix),
  );

  if (!restriction || capabilities.has(restriction.capability)) {
    return null;
  }

  return restriction;
}

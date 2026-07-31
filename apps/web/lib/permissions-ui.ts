"use client";

import type { PermissionKey } from "@schoolos/core";
import { useSession } from "@/components/session-provider";
import type { BrowserSession } from "@/lib/session";
import { useTeacherAccess } from "@/lib/teacher-access";
import {
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
} from "@/lib/session";

export type PermissionResolution = "loading" | "denied" | "granted";

/** Fail-closed session permission list — never treat missing data as granted. */
export function resolveSessionPermissions(
  session: BrowserSession | null,
): PermissionKey[] {
  const permissions = session?.user?.permissions;
  if (!Array.isArray(permissions)) {
    return [];
  }
  return permissions.filter(
    (permission): permission is PermissionKey =>
      typeof permission === "string" && permission.length > 0,
  );
}

export function resolvePermissionAccess(
  session: BrowserSession | null,
  sessionStatus: string,
): PermissionResolution {
  if (sessionStatus === "loading") {
    return "loading";
  }
  if (sessionStatus !== "authenticated" || !session) {
    return "denied";
  }
  return "granted";
}

/**
 * Canonical UI permission access. Denies while session is unresolved; never
 * defaults to visible/enabled during loading.
 */
export function usePermissionAccess() {
  const { session, status } = useSession();
  const resolution = resolvePermissionAccess(session, status);
  const granted = resolution === "granted";

  return {
    resolution,
    session,
    hasPermission: (permission: PermissionKey) =>
      granted && hasPermission(session, permission),
    hasAnyPermission: (permissions: PermissionKey[]) =>
      granted && hasAnyPermission(session, permissions),
    hasAllPermissions: (permissions: PermissionKey[]) =>
      granted && hasAllPermissions(session, permissions),
  };
}

/** Alias-aware single-permission check for UI visibility. */
export function useHasPermission(permission: PermissionKey): boolean {
  return usePermissionAccess().hasPermission(permission);
}

/** Alias-aware any-of permission check for UI visibility. */
export function useHasAnyPermission(permissions: PermissionKey[]): boolean {
  return usePermissionAccess().hasAnyPermission(permissions);
}

/** Alias-aware all-of permission check for UI visibility. */
export function useHasAllPermissions(permissions: PermissionKey[]): boolean {
  return usePermissionAccess().hasAllPermissions(permissions);
}

export type NoticeAudienceScope =
  | "ALL"
  | "CLASS"
  | "SECTION"
  | "ROLE"
  | "STAFF"
  | "STUDENT"
  | "GUARDIANS"
  | "RECIPIENTS";

export type NoticeCapabilities = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canSchedule: boolean;
  canApprove: boolean;
  canCancel: boolean;
  canArchive: boolean;
  canReadReports: boolean;
  canSendEmergency: boolean;
  canTargetWholeSchool: boolean;
  allowedAudienceTypes: NoticeAudienceScope[];
};

const TEACHER_NOTICE_AUDIENCE: NoticeAudienceScope[] = [
  "CLASS",
  "SECTION",
  "GUARDIANS",
  "RECIPIENTS",
];

const FULL_NOTICE_AUDIENCE: NoticeAudienceScope[] = [
  "ALL",
  "CLASS",
  "SECTION",
  "ROLE",
  "STAFF",
  "STUDENT",
  "GUARDIANS",
  "RECIPIENTS",
];

export function getNoticeCapabilities(
  session: BrowserSession | null,
  options: { isTeacherPersona?: boolean } = {},
): NoticeCapabilities {
  const canView = hasPermission(session, "notices:read");
  const canCreate = hasPermission(session, "notices:create");
  const canEdit = hasPermission(session, "notices:edit");
  const canPublish = hasPermission(session, "notices:publish");
  const canSchedule = hasPermission(session, "notices:schedule");
  const canApprove =
    hasPermission(session, "notices:approve") ||
    hasPermission(session, "advanced:approvals:decide");
  const canCancel = hasPermission(session, "notices:cancel");
  const canArchive = hasPermission(session, "notices:archive");
  const canReadReports = hasPermission(session, "notices:read_reports");
  const canSendEmergency = hasPermission(session, "notices:send_emergency");
  const canTargetWholeSchool =
    !options.isTeacherPersona ||
    canApprove ||
    canSendEmergency ||
    hasPermission(session, "notices:publish");

  return {
    canView,
    canCreate,
    canEdit,
    canPublish,
    canSchedule,
    canApprove,
    canCancel,
    canArchive,
    canReadReports,
    canSendEmergency,
    canTargetWholeSchool,
    allowedAudienceTypes: canTargetWholeSchool
      ? FULL_NOTICE_AUDIENCE
      : TEACHER_NOTICE_AUDIENCE,
  };
}

export function useNoticeCapabilities(options?: {
  isTeacherPersona?: boolean;
}): NoticeCapabilities & { resolution: PermissionResolution } {
  const access = usePermissionAccess();
  const capabilities = getNoticeCapabilities(access.session, options);
  if (access.resolution !== "granted") {
    return {
      ...capabilities,
      canView: false,
      canCreate: false,
      canEdit: false,
      canPublish: false,
      canSchedule: false,
      canApprove: false,
      canCancel: false,
      canArchive: false,
      canReadReports: false,
      canSendEmergency: false,
      canTargetWholeSchool: false,
      allowedAudienceTypes: [],
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

export type AttendanceCapabilities = {
  canView: boolean;
  canMark: boolean;
  canManageAll: boolean;
  canReviewConflicts: boolean;
  canOverrideLock: boolean;
  canExport: boolean;
};

export function getAttendanceCapabilities(
  session: BrowserSession | null,
): AttendanceCapabilities {
  const canView = hasAnyPermission(session, ["attendance:read"]);
  const canMark = hasPermission(session, "attendance:mark");
  const canManageAll = hasPermission(session, "attendance:manage_all");
  const canReviewConflicts = hasPermission(
    session,
    "attendance:review_conflicts",
  );
  const canOverrideLock = hasPermission(session, "attendance:override_lock");
  const canExport = canView;

  return {
    canView,
    canMark,
    canManageAll,
    canReviewConflicts,
    canOverrideLock,
    canExport,
  };
}

export function useAttendanceCapabilities(): AttendanceCapabilities & {
  resolution: PermissionResolution;
} {
  const access = usePermissionAccess();
  const capabilities = getAttendanceCapabilities(access.session);
  if (access.resolution !== "granted") {
    return {
      canView: false,
      canMark: false,
      canManageAll: false,
      canReviewConflicts: false,
      canOverrideLock: false,
      canExport: false,
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

const INSTITUTIONAL_SETTINGS_PREFIXES = [
  "settings:",
  "users:",
  "roles:",
  "admission_policy:",
] as const;

const INSTITUTIONAL_SETTINGS_KEYS = [
  "settings:read",
  "settings:manage",
  "classes:read",
  "academic_years:read",
  "attendance:read",
] as const satisfies PermissionKey[];

function hasInstitutionalSettingsPermission(
  session: BrowserSession | null,
): boolean {
  const permissions = resolveSessionPermissions(session);
  if (
    permissions.some((permission) =>
      INSTITUTIONAL_SETTINGS_PREFIXES.some((prefix) =>
        permission.startsWith(prefix),
      ),
    )
  ) {
    return true;
  }
  return hasAnyPermission(session, [...INSTITUTIONAL_SETTINGS_KEYS]);
}

export type SettingsCapabilities = {
  canView: boolean;
  canAccessInstitutionalSettings: boolean;
  canAccessPersonalSettings: boolean;
  institutionalNavEnabled: boolean;
  canManage: boolean;
  canManageIdentity: boolean;
  canManageAcademic: boolean;
  canCreateUsers: boolean;
  canReadRoles: boolean;
  canUpdateUserStatus: boolean;
  canResetPassword: boolean;
  canCreateClass: boolean;
  canCreateSection: boolean;
  canCreateStream: boolean;
  canReadStreams: boolean;
  canAssignClassTeacher: boolean;
  canReadSettings: boolean;
  canReadAudit: boolean;
  canViewStaffSelf: boolean;
  canOpenActivity: boolean;
  canOpenHistory: boolean;
};

export function getSettingsCapabilities(
  session: BrowserSession | null,
): SettingsCapabilities {
  const canReadSettings = hasPermission(session, "settings:read");
  const canManage = hasPermission(session, "settings:manage");
  const canManageIdentity = hasPermission(session, "settings:identity:manage");
  const canManageAcademic = hasPermission(session, "settings:academic:manage");
  const canCreateUsers = hasPermission(session, "users:create");
  const canReadRoles = hasPermission(session, "roles:read");
  const canUpdateUserStatus = hasPermission(session, "users:update_status");
  const canResetPassword = hasPermission(session, "users:reset_password");
  const canCreateClass = hasPermission(session, "classes:create");
  const canCreateSection = hasPermission(session, "sections:create");
  const canCreateStream = hasPermission(session, "streams:create");
  const canReadStreams =
    canCreateStream || hasPermission(session, "streams:read");
  const canAssignClassTeacher = hasPermission(session, "academics:update");
  const canReadAudit = hasPermission(session, "settings:audit:read");
  const canViewStaffSelf = hasPermission(session, "staff:read");
  const canAccessInstitutionalSettings =
    hasInstitutionalSettingsPermission(session);
  const canAccessPersonalSettings = Boolean(session?.user);
  const canOpenActivity = hasAnyPermission(session, [
    "activity_feed:read",
    "activity_feed:create",
  ]);
  const canOpenHistory = canReadAudit || canManage;

  return {
    canView: canReadSettings || canAccessInstitutionalSettings,
    canAccessInstitutionalSettings,
    canAccessPersonalSettings,
    institutionalNavEnabled: canAccessInstitutionalSettings,
    canManage,
    canManageIdentity,
    canManageAcademic,
    canCreateUsers,
    canReadRoles,
    canUpdateUserStatus,
    canResetPassword,
    canCreateClass,
    canCreateSection,
    canCreateStream,
    canReadStreams,
    canAssignClassTeacher,
    canReadSettings,
    canReadAudit,
    canViewStaffSelf,
    canOpenActivity,
    canOpenHistory,
  };
}

export function useSettingsCapabilities(): SettingsCapabilities & {
  resolution: PermissionResolution;
} {
  const access = usePermissionAccess();
  const capabilities = getSettingsCapabilities(access.session);
  if (access.resolution !== "granted") {
    return {
      ...capabilities,
      canView: false,
      canAccessInstitutionalSettings: false,
      canAccessPersonalSettings: false,
      institutionalNavEnabled: false,
      canManage: false,
      canManageIdentity: false,
      canManageAcademic: false,
      canCreateUsers: false,
      canReadRoles: false,
      canUpdateUserStatus: false,
      canResetPassword: false,
      canCreateClass: false,
      canCreateSection: false,
      canCreateStream: false,
      canReadStreams: false,
      canAssignClassTeacher: false,
      canReadSettings: false,
      canReadAudit: false,
      canViewStaffSelf: false,
      canOpenActivity: false,
      canOpenHistory: false,
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

export type HomeworkCapabilities = {
  canView: boolean;
  canCreate: boolean;
  canReview: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canNotify: boolean;
};

export function getHomeworkCapabilities(
  session: BrowserSession | null,
  options: {
    isTeacherPersona?: boolean;
    hasAssignmentScope?: boolean;
  } = {},
): HomeworkCapabilities {
  const teacherScoped =
    options.isTeacherPersona && options.hasAssignmentScope === false;
  const canView = hasPermission(session, "homework:read");
  const canCreate =
    hasPermission(session, "homework:create") && !teacherScoped;
  const canReview =
    hasPermission(session, "homework:review") && !teacherScoped;
  const canUpdate = hasPermission(session, "homework:update") && !teacherScoped;
  const canDelete = hasPermission(session, "homework:delete") && !teacherScoped;
  const canNotify = hasPermission(session, "homework:notify") && !teacherScoped;

  return {
    canView,
    canCreate,
    canReview,
    canUpdate,
    canDelete,
    canNotify,
  };
}

export function useHomeworkCapabilities(options?: {
  hasAssignmentScope?: boolean;
}): HomeworkCapabilities & { resolution: PermissionResolution } {
  const access = usePermissionAccess();
  const { isTeacherPersona } = useTeacherAccess();
  const capabilities = getHomeworkCapabilities(access.session, {
    isTeacherPersona,
    hasAssignmentScope: options?.hasAssignmentScope,
  });
  if (access.resolution !== "granted") {
    return {
      canView: false,
      canCreate: false,
      canReview: false,
      canUpdate: false,
      canDelete: false,
      canNotify: false,
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

export type PayrollCapabilities = {
  canView: boolean;
  canPrepare: boolean;
  canReview: boolean;
  canApprove: boolean;
  canFinalize: boolean;
  canViewSalary: boolean;
  canExport: boolean;
  canGeneratePayslip: boolean;
};

export function getPayrollCapabilities(
  session: BrowserSession | null,
): PayrollCapabilities {
  const canView = hasPermission(session, "payroll:read");
  const canPrepare = hasPermission(session, "payroll:run:create");
  const canReview = hasPermission(session, "payroll:run:review");
  const canApprove = hasPermission(session, "payroll:run:approve");
  const canFinalize = hasPermission(session, "payroll:run:post");
  const canViewSalary = hasPermission(session, "payroll:salary:read");
  const canExport = hasPermission(session, "payroll:exports:create");
  const canGeneratePayslip = hasPermission(session, "payroll:payslip:generate");

  return {
    canView,
    canPrepare,
    canReview,
    canApprove,
    canFinalize,
    canViewSalary,
    canExport,
    canGeneratePayslip,
  };
}

export function usePayrollCapabilities(): PayrollCapabilities & {
  resolution: PermissionResolution;
} {
  const access = usePermissionAccess();
  const capabilities = getPayrollCapabilities(access.session);
  if (access.resolution !== "granted") {
    return {
      canView: false,
      canPrepare: false,
      canReview: false,
      canApprove: false,
      canFinalize: false,
      canViewSalary: false,
      canExport: false,
      canGeneratePayslip: false,
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

export type CommunicationsCapabilities = {
  canViewDeliveries: boolean;
  canViewDiagnostics: boolean;
  canRetry: boolean;
  canManageTemplates: boolean;
};

export function getCommunicationsCapabilities(
  session: BrowserSession | null,
): CommunicationsCapabilities {
  const canViewDeliveries = hasPermission(
    session,
    "communications:read_deliveries",
  );
  const canViewDiagnostics =
    hasPermission(session, "notifications:view_delivery_diagnostics") ||
    canViewDeliveries;
  const canRetry =
    hasPermission(session, "communications:retry_deliveries") ||
    hasPermission(session, "notifications:retry_deliveries");
  const canManageTemplates =
    hasPermission(session, "communications:manage_templates") ||
    hasPermission(session, "notifications:manage_templates");

  return {
    canViewDeliveries,
    canViewDiagnostics,
    canRetry,
    canManageTemplates,
  };
}

export function useCommunicationsCapabilities(): CommunicationsCapabilities & {
  resolution: PermissionResolution;
} {
  const access = usePermissionAccess();
  const capabilities = getCommunicationsCapabilities(access.session);
  if (access.resolution !== "granted") {
    return {
      canViewDeliveries: false,
      canViewDiagnostics: false,
      canRetry: false,
      canManageTemplates: false,
      resolution: access.resolution,
    };
  }
  return { ...capabilities, resolution: access.resolution };
}

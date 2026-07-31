"use client";

import type { PermissionKey } from "@schoolos/core";
import { useSession } from "@/components/session-provider";
import type { BrowserSession } from "@/lib/session";
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

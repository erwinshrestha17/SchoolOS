/**
 * Per-item school settings access level, computed by the backend from the
 * authenticated user's tenant permissions. `none` is never emitted — items
 * the user cannot at least view are omitted entirely.
 *
 * - `view`: read-only policy visibility (`settings:read`).
 * - `edit`: may change this domain's policy values (`settings:<domain>:manage`).
 * - `approve`: reserved for high-risk approval flows (no backend approval
 *   queue contract exists yet; not emitted today).
 * - `manage`: full school settings authority (`settings:manage`).
 * - `delegate`: Configuration Owner authority including delegation
 *   (`settings:delegate`).
 */
export type SchoolSettingsAccess =
  | 'view'
  | 'edit'
  | 'approve'
  | 'manage'
  | 'delegate';

export type SchoolSettingsNavigationGroupId =
  | 'school-setup'
  | 'academic-student-policy'
  | 'finance-administration'
  | 'communication-documents'
  | 'people-governance'
  | 'module-settings';

export type SchoolSettingsNavigationItem = {
  id: string;
  groupId: SchoolSettingsNavigationGroupId;
  label: string;
  description: string;
  href: string;
  access: SchoolSettingsAccess;
  /** Present when the item belongs to an entitlement-gated school module. */
  module?: string;
};

export type SchoolSettingsNavigationGroup = {
  id: SchoolSettingsNavigationGroupId;
  label: string;
  items: SchoolSettingsNavigationItem[];
};

export type SchoolSettingsNavigation = {
  generatedAt: string;
  groups: SchoolSettingsNavigationGroup[];
};

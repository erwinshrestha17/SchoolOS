export type SchoolSettingsAccess = 'view' | 'manage';

export type SchoolSettingsNavigationGroupId =
  | 'school-foundation'
  | 'people-access'
  | 'student-academic-operations'
  | 'finance-workforce'
  | 'school-operations'
  | 'communication-learning'
  | 'data-governance';

export type SchoolSettingsNavigationItem = {
  id: string;
  groupId: SchoolSettingsNavigationGroupId;
  label: string;
  description: string;
  href: string;
  access: SchoolSettingsAccess;
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

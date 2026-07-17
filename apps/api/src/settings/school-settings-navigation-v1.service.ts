import { Injectable } from '@nestjs/common';
import type {
  SchoolSettingsAccess,
  SchoolSettingsDomain,
  SchoolSettingsNavigation,
  SchoolSettingsNavigationGroup,
  SchoolSettingsNavigationGroupId,
  SchoolSettingsNavigationItem,
} from '@schoolos/core';
import { SCHOOL_SETTINGS_DOMAIN_MANAGE_PERMISSIONS } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementsService } from '../plans/entitlements.service';

const GROUP_LABELS: Record<SchoolSettingsNavigationGroupId, string> = {
  'school-setup': 'School Setup',
  'academic-student-policy': 'Academic & Student Policy',
  'finance-administration': 'Finance & Administration',
  'communication-documents': 'Communication & Documents',
  'people-governance': 'People & Governance',
  'module-settings': 'Enabled Module Settings',
};

const GROUP_ORDER: SchoolSettingsNavigationGroupId[] = [
  'school-setup',
  'academic-student-policy',
  'finance-administration',
  'communication-documents',
  'people-governance',
  'module-settings',
];

type DomainItemDefinition = {
  id: string;
  groupId: SchoolSettingsNavigationGroupId;
  label: string;
  description: string;
  href: string;
  domain: SchoolSettingsDomain;
};

const DOMAIN_ITEMS: DomainItemDefinition[] = [
  {
    id: 'school-profile',
    groupId: 'school-setup',
    label: 'Identity',
    description: 'Official school identity, contacts, and registration.',
    href: '/dashboard/settings/school-profile',
    domain: 'identity',
  },
  {
    id: 'branding-documents',
    groupId: 'school-setup',
    label: 'Branding',
    description: 'Protected school logo, colors, and paper defaults.',
    href: '/dashboard/settings/branding-documents',
    domain: 'identity',
  },
  {
    id: 'academic-calendar',
    groupId: 'school-setup',
    label: 'Academic year & calendar',
    description: 'Bikram Sambat years, Nepal school days, and holidays.',
    href: '/dashboard/settings/academic-calendar',
    domain: 'academic',
  },
  {
    id: 'academic-structure',
    groupId: 'school-setup',
    label: 'Classes, sections & subjects',
    description: 'Foundational academic structure for this school.',
    href: '/dashboard/settings/academic-structure',
    domain: 'academic',
  },
  {
    id: 'attendance',
    groupId: 'academic-student-policy',
    label: 'Attendance',
    description: 'Lock windows, thresholds, correction, and visibility policy.',
    href: '/dashboard/settings/attendance',
    domain: 'attendance',
  },
  {
    id: 'exams-report-cards',
    groupId: 'academic-student-policy',
    label: 'Exams & report cards',
    description: 'Grading, publishing, and report-card policy boundaries.',
    href: '/dashboard/settings/exams-report-cards',
    domain: 'academic',
  },
  {
    id: 'homework-timetable',
    groupId: 'academic-student-policy',
    label: 'Homework & timetable',
    description: 'School-wide homework and timetable policy boundaries.',
    href: '/dashboard/settings/homework-timetable-learning',
    domain: 'academic',
  },
  {
    id: 'activity-consent',
    groupId: 'academic-student-policy',
    label: 'Activity, media & consent',
    description: 'Media consent policy for student activity publishing.',
    href: '/dashboard/settings/activity-consent',
    domain: 'communication',
  },
  {
    id: 'fees',
    groupId: 'finance-administration',
    label: 'Fees & receipts',
    description: 'Receipt numbering, approvals, cashier close, and methods.',
    href: '/dashboard/settings/fees',
    domain: 'finance',
  },
  {
    id: 'accounting',
    groupId: 'finance-administration',
    label: 'Accounting & fiscal policy',
    description: 'Fiscal defaults, account labels, and numbering prefixes.',
    href: '/dashboard/settings/accounting',
    domain: 'accounting',
  },
  {
    id: 'hr-payroll',
    groupId: 'finance-administration',
    label: 'HR & payroll',
    description: 'Leave approval and payroll policy defaults.',
    href: '/dashboard/settings/hr-payroll',
    domain: 'hr',
  },
  {
    id: 'communication',
    groupId: 'communication-documents',
    label: 'Communication policy',
    description: 'Notice channels, quiet hours, and parent communication.',
    href: '/dashboard/settings/communication',
    domain: 'communication',
  },
  {
    id: 'documents-templates',
    groupId: 'communication-documents',
    label: 'Documents & templates',
    description: 'Official document text, branding, and template defaults.',
    href: '/dashboard/settings/documents-templates',
    domain: 'identity',
  },
  {
    id: 'security',
    groupId: 'people-governance',
    label: 'Security & access',
    description: 'Session, masking, reveal-reason, and export policy.',
    href: '/dashboard/settings/security',
    domain: 'security',
  },
];

type ModuleItemDefinition = {
  id: string;
  module: string;
  label: string;
  description: string;
  href: string;
  readPermissions: string[];
  managePermissions: string[];
};

const MODULE_ITEMS: ModuleItemDefinition[] = [
  {
    id: 'library-settings',
    module: 'library',
    label: 'Library',
    description: 'Module-owned library configuration in the Library workspace.',
    href: '/dashboard/library',
    readPermissions: ['library:read'],
    managePermissions: ['library:manage'],
  },
  {
    id: 'transport-settings',
    module: 'transport',
    label: 'Transport',
    description:
      'Module-owned transport configuration in the Transport workspace.',
    href: '/dashboard/transport',
    readPermissions: ['transport:read'],
    managePermissions: ['transport:manage'],
  },
  {
    id: 'canteen-settings',
    module: 'canteen',
    label: 'Canteen',
    description: 'Module-owned canteen configuration in the Canteen workspace.',
    href: '/dashboard/canteen',
    readPermissions: ['canteen:controls:read'],
    managePermissions: ['canteen:controls:update'],
  },
  {
    id: 'learning-settings',
    module: 'learning',
    label: 'Learning',
    description:
      'Module-owned school-controlled learning configuration (frozen scope).',
    href: '/dashboard/learning',
    readPermissions: ['learning:read'],
    managePermissions: ['learning:manage'],
  },
];

@Injectable()
export class SchoolSettingsNavigationV1Service {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  async getNavigation(auth: AuthContext): Promise<SchoolSettingsNavigation> {
    const has = (permission: string) => auth.permissions.includes(permission);
    const canRead = has('settings:read') || has('settings:manage');
    const canManageAll = has('settings:manage');
    const canDelegate = has('settings:delegate');

    const items: SchoolSettingsNavigationItem[] = [];

    if (canRead) {
      items.push({
        id: 'overview',
        groupId: 'school-setup',
        label: 'Overview',
        description: 'Configuration readiness and recent safe changes.',
        href: '/dashboard/settings',
        access: this.elevate('view', canManageAll, canDelegate),
      });
    }

    for (const definition of DOMAIN_ITEMS) {
      const access = this.domainAccess(auth, definition.domain);
      if (!access) continue;
      items.push({
        id: definition.id,
        groupId: definition.groupId,
        label: definition.label,
        description: definition.description,
        href: definition.href,
        access,
      });
    }

    if (canRead) {
      items.push({
        id: 'modules',
        groupId: 'school-setup',
        label: 'School modules',
        description:
          'Enabled modules for this school. Entitlements are managed by SchoolOS Platform.',
        href: '/dashboard/settings/modules',
        access: 'view',
      });
      items.push({
        id: 'integrations',
        groupId: 'communication-documents',
        label: 'Safe integration status',
        description:
          'Connection status only. Credentials stay with SchoolOS Platform.',
        href: '/dashboard/settings/integrations',
        access: 'view',
      });
    }

    const admissionAccess = this.explicitAccess(
      auth,
      ['admission_policy:read'],
      ['admission_policy:manage'],
    );
    if (admissionAccess) {
      items.push({
        id: 'admissions',
        groupId: 'academic-student-policy',
        label: 'Admissions',
        description:
          'Admission requirements, documents, and approval policies.',
        href: '/dashboard/settings/admissions',
        access: admissionAccess,
      });
    }

    const usersAccess = this.explicitAccess(
      auth,
      ['users:read'],
      ['users:create', 'users:update_status'],
    );
    if (usersAccess) {
      items.push({
        id: 'users-access',
        groupId: 'people-governance',
        label: 'Users',
        description: 'School user accounts, activation, and security actions.',
        href: '/dashboard/settings/users-access',
        access: usersAccess,
      });
    }

    const rolesAccess = this.explicitAccess(
      auth,
      ['roles:read'],
      ['roles:assign', 'roles:manage_permissions'],
    );
    if (rolesAccess) {
      items.push({
        id: 'roles-permissions',
        groupId: 'people-governance',
        label: 'Roles & permissions',
        description: 'Role coverage and permission boundaries for this school.',
        href: '/dashboard/settings/roles-permissions',
        access:
          rolesAccess !== 'view' && canDelegate ? 'delegate' : rolesAccess,
      });
    }

    if (has('settings:audit:read') || canManageAll) {
      items.push({
        id: 'audit-export',
        groupId: 'people-governance',
        label: 'Audit & exports',
        description:
          'Tenant-scoped configuration history and protected exports.',
        href: '/dashboard/settings/audit-export',
        access: 'view',
      });
    }

    const entitlements = await this.entitlementsService.getEntitlements(
      auth.tenantId,
    );
    for (const definition of MODULE_ITEMS) {
      if (!entitlements.modules.includes(definition.module)) continue;
      const access = this.explicitAccess(
        auth,
        definition.readPermissions,
        definition.managePermissions,
      );
      if (!access) continue;
      items.push({
        id: definition.id,
        groupId: 'module-settings',
        label: definition.label,
        description: definition.description,
        href: definition.href,
        access,
        module: definition.module,
      });
    }

    const groups: SchoolSettingsNavigationGroup[] = GROUP_ORDER.map(
      (groupId) => ({
        id: groupId,
        label: GROUP_LABELS[groupId],
        items: items.filter((item) => item.groupId === groupId),
      }),
    ).filter((group) => group.items.length > 0);

    return {
      generatedAt: new Date().toISOString(),
      groups,
    };
  }

  private domainAccess(
    auth: AuthContext,
    domain: SchoolSettingsDomain,
  ): SchoolSettingsAccess | null {
    const has = (permission: string) => auth.permissions.includes(permission);
    if (has('settings:manage')) {
      return has('settings:delegate') ? 'delegate' : 'manage';
    }
    if (has(SCHOOL_SETTINGS_DOMAIN_MANAGE_PERMISSIONS[domain])) {
      return 'edit';
    }
    if (has('settings:read')) {
      return 'view';
    }
    return null;
  }

  private explicitAccess(
    auth: AuthContext,
    readPermissions: string[],
    managePermissions: string[],
  ): SchoolSettingsAccess | null {
    const has = (permission: string) => auth.permissions.includes(permission);
    const canManage = managePermissions.every((permission) => has(permission));
    if (canManage) {
      return has('settings:manage') ? 'manage' : 'edit';
    }
    if (readPermissions.some((permission) => has(permission))) {
      return 'view';
    }
    return null;
  }

  private elevate(
    base: SchoolSettingsAccess,
    canManageAll: boolean,
    canDelegate: boolean,
  ): SchoolSettingsAccess {
    if (canManageAll && canDelegate) return 'delegate';
    if (canManageAll) return 'manage';
    return base;
  }
}

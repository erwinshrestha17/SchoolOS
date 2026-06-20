import { Injectable } from '@nestjs/common';
import type { SchoolSettingsNavigation } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';

@Injectable()
export class SchoolSettingsNavigationV1Service {
  getNavigation(auth: AuthContext): SchoolSettingsNavigation {
    const canRead = auth.permissions.includes('settings:read') || auth.permissions.includes('settings:manage');
    const canManage = auth.permissions.includes('settings:manage');
    const items: SchoolSettingsNavigation['groups'][number]['items'] = [];

    if (canRead) {
      items.push({
        id: 'overview',
        groupId: 'school-foundation',
        label: 'Overview',
        description: 'School settings readiness.',
        href: '/dashboard/settings/overview',
        access: canManage ? 'manage' : 'view',
      });
    }

    if (canManage) {
      items.push({
        id: 'school-profile',
        groupId: 'school-foundation',
        label: 'School Profile',
        description: 'Official identity and contact configuration.',
        href: '/dashboard/settings/school-profile',
        access: 'manage',
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      groups: items.length ? [{ id: 'school-foundation', label: 'School Foundation', items }] : [],
    };
  }
}

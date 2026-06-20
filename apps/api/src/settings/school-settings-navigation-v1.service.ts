import { Injectable } from '@nestjs/common';
import type { SchoolSettingsNavigation } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';

@Injectable()
export class SchoolSettingsNavigationV1Service {
  getNavigation(auth: AuthContext): SchoolSettingsNavigation {
    const canManage = auth.permissions.includes('settings:manage');
    return {
      generatedAt: new Date().toISOString(),
      groups: canManage
        ? [
            {
              id: 'school-foundation',
              label: 'School Foundation',
              items: [
                {
                  id: 'school-profile',
                  groupId: 'school-foundation',
                  label: 'School Profile',
                  description: 'Official identity and contact configuration.',
                  href: '/dashboard/settings/school-profile',
                  access: 'manage',
                },
              ],
            },
          ]
        : [],
    };
  }
}

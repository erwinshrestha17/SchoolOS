import type {
  SchoolProfileSettings,
  SchoolSettingsNavigation,
  SchoolSettingsOverview,
  UpdateSchoolProfilePayload,
} from '@schoolos/core';
import { request } from './client';

const basePath = '/settings/workspaces';

export const schoolSettingsApi = {
  getSchoolSettingsNavigation: () =>
    request<SchoolSettingsNavigation>(`${basePath}/navigation`),
  getSchoolSettingsOverview: () =>
    request<SchoolSettingsOverview>(`${basePath}/overview`),
  getSchoolProfile: () =>
    request<SchoolProfileSettings>(`${basePath}/school-profile`),
  updateSchoolProfile: (body: UpdateSchoolProfilePayload) =>
    request<SchoolProfileSettings>(`${basePath}/school-profile`, {
      method: 'PATCH',
      json: body,
    }),
};

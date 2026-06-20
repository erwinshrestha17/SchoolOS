import type {
  SchoolProfileSettings,
  SchoolSettingsNavigation,
  SchoolSettingsOverview,
  UpdateSchoolProfilePayload,
} from '@schoolos/core';
import { request } from './client';

export const schoolSettingsApi = {
  getSchoolSettingsNavigation: () =>
    request<SchoolSettingsNavigation>('/settings/navigation'),
  getSchoolSettingsOverview: () =>
    request<SchoolSettingsOverview>('/settings/overview'),
  getSchoolProfile: () =>
    request<SchoolProfileSettings>('/settings/school-profile'),
  updateSchoolProfile: (body: UpdateSchoolProfilePayload) =>
    request<SchoolProfileSettings>('/settings/school-profile', {
      method: 'PATCH',
      json: body,
    }),
};

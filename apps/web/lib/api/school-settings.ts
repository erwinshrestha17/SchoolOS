import type {
  BrandingDocumentsSettings,
  SchoolProfileSettings,
  SchoolSettingsNavigation,
  SchoolSettingsOverview,
  UpdateBrandingDocumentsPayload,
  UpdateSchoolProfilePayload,
} from '@schoolos/core';
import {
  readFileAsBase64,
  request,
  type TenantLogoUploadResult,
} from './client';

const basePath = '/settings/workspaces';

export const schoolSettingsApi = {
  getSchoolSettingsNavigation: () => request<SchoolSettingsNavigation>(`${basePath}/navigation`),
  getSchoolSettingsOverview: () => request<SchoolSettingsOverview>(`${basePath}/overview`),
  getSchoolProfile: () => request<SchoolProfileSettings>(`${basePath}/school-profile`),
  updateSchoolProfile: (body: UpdateSchoolProfilePayload) => request<SchoolProfileSettings>(`${basePath}/school-profile`, { method: 'PATCH', json: body }),
  getBrandingDocuments: () => request<BrandingDocumentsSettings>(`${basePath}/branding-documents`),
  updateBrandingDocuments: (body: UpdateBrandingDocumentsPayload) => request<BrandingDocumentsSettings>(`${basePath}/branding-documents`, { method: 'PATCH', json: body }),
  uploadSchoolLogo: async (file: File, note?: string) => request<TenantLogoUploadResult>('/settings/branding/logo', {
    method: 'POST',
    json: { fileName: file.name, mimeType: file.type, base64Content: await readFileAsBase64(file), ...(note ? { note } : {}) },
  }),
  removeSchoolLogo: () => request<{ success: true; removed: boolean }>('/settings/branding/logo', { method: 'DELETE' }),
};

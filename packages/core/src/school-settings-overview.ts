import type { SchoolSettingsNavigation } from './school-settings-navigation.js';

export type SchoolProfileSettings = {
  schoolName: string | null;
  schoolAddress: string | null;
  schoolPhone: string | null;
  schoolEmail: string | null;
  schoolPanNumber: string | null;
  principalName: string | null;
  municipality: string | null;
  wardNumber: number | null;
  district: string | null;
  province: string | null;
  schoolType: 'PRIVATE' | 'COMMUNITY' | 'TRUST' | null;
  iemisSchoolCode: string | null;
  updatedAt: string | null;
};

export type UpdateSchoolProfilePayload = Partial<
  Omit<SchoolProfileSettings, 'updatedAt'>
>;

export type BrandingDocumentsSettings = {
  logoFileAssetId: string | null;
  primaryColor: string | null;
  receiptHeaderText: string | null;
  receiptFooterText: string | null;
  idCardFooterText: string | null;
  payslipFooterText: string | null;
  certificateFooterText: string | null;
  reportCardFooterText: string | null;
  defaultPaperSize: 'A4' | 'LEGAL' | '80MM' | null;
  updatedAt: string | null;
};

export type UpdateBrandingDocumentsPayload = Partial<
  Omit<BrandingDocumentsSettings, 'logoFileAssetId' | 'updatedAt'>
>;

export type SchoolSettingsReadinessItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  status: 'ready' | 'needs_attention';
};

/**
 * Safe summary of one recent school configuration change. Never carries
 * raw before/after payloads, IP addresses, user agents, or secrets.
 */
export type SchoolSettingsRecentChange = {
  id: string;
  action: string;
  settingKey: string | null;
  actorLabel: string;
  changedAt: string;
};

export type SchoolSettingsPrimaryAction = {
  label: string;
  href: string;
};

export type SchoolSettingsOverview = {
  generatedAt: string;
  schoolName: string | null;
  navigation: SchoolSettingsNavigation;
  readiness: SchoolSettingsReadinessItem[];
  /** Up to five backend-confirmed setup items that still need attention. */
  attention: SchoolSettingsReadinessItem[];
  /** Up to five recent safe configuration changes for this school only. */
  recentChanges: SchoolSettingsRecentChange[];
  primaryAction: SchoolSettingsPrimaryAction;
};

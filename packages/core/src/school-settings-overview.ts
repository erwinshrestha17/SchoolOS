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

export type SchoolSettingsOverview = {
  generatedAt: string;
  navigation: SchoolSettingsNavigation;
  readiness: SchoolSettingsReadinessItem[];
};

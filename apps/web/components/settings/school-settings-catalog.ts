import type { LucideIcon } from 'lucide-react';
import {
  BookMarked,
  BookOpenCheck,
  Building2,
  Bus,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  FileClock,
  FileStack,
  GraduationCap,
  ImagePlay,
  LayoutGrid,
  Link2,
  MessageSquareText,
  Palette,
  ReceiptText,
  School,
  Settings2,
  ShieldCheck,
  UserCog,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  WalletCards,
} from 'lucide-react';
import type { SchoolSettingsAccess } from '@schoolos/core';

/**
 * Icons for backend-provided settings navigation items, keyed by item id.
 * Labels, grouping, ordering, and access levels come from the backend
 * navigation contract; the browser only decorates them.
 */
export const SCHOOL_SETTINGS_ITEM_ICONS: Record<string, LucideIcon> = {
  overview: Settings2,
  'school-profile': Building2,
  'branding-documents': Palette,
  'academic-calendar': CalendarDays,
  'academic-structure': School,
  modules: LayoutGrid,
  admissions: UserCog,
  attendance: CalendarCheck2,
  'exams-report-cards': ClipboardList,
  'homework-timetable': BookOpenCheck,
  'activity-consent': ImagePlay,
  fees: ReceiptText,
  accounting: WalletCards,
  'hr-payroll': Wallet,
  communication: MessageSquareText,
  'documents-templates': FileStack,
  integrations: Link2,
  'users-access': UsersRound,
  'roles-permissions': ShieldCheck,
  security: ShieldCheck,
  'audit-export': FileClock,
  'library-settings': BookMarked,
  'transport-settings': Bus,
  'canteen-settings': UtensilsCrossed,
  'learning-settings': GraduationCap,
};

export const SCHOOL_SETTINGS_FALLBACK_ICON: LucideIcon = Settings2;

export const SCHOOL_SETTINGS_ACCESS_LABELS: Record<
  SchoolSettingsAccess,
  string
> = {
  view: 'View only',
  edit: 'Edit',
  approve: 'Approve',
  manage: 'Manage',
  delegate: 'Delegate',
};

export function canEditSchoolSettings(
  access: SchoolSettingsAccess | undefined,
): boolean {
  return access === 'edit' || access === 'manage' || access === 'delegate';
}

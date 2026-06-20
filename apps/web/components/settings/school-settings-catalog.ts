import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  ClipboardList,
  FileStack,
  GraduationCap,
  LayoutGrid,
  Link2,
  MessageSquareText,
  ReceiptText,
  ShieldCheck,
  UserCog,
  UsersRound,
  WalletCards,
} from 'lucide-react';

export type SchoolSettingsCategory = {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  readinessId?: string;
};

export const SCHOOL_SETTINGS_CATEGORIES: SchoolSettingsCategory[] = [
  { id: 'profile', href: '/dashboard/settings/profile', label: 'School Profile & Branding', shortLabel: 'Profile & branding', description: 'Official school identity, contacts, location, logo, and document branding.', icon: Building2, readinessId: 'school-profile' },
  { id: 'academic', href: '/dashboard/settings/academic', label: 'Academic Setup', shortLabel: 'Academic setup', description: 'Academic years, calendar, classes, sections, subjects, grading, and school structure.', icon: GraduationCap, readinessId: 'academic-calendar' },
  { id: 'users-roles', href: '/dashboard/settings/users-roles', label: 'Users, Roles & Permissions', shortLabel: 'Users & roles', description: 'School staff accounts, role assignment, scope, and permission visibility.', icon: UsersRound },
  { id: 'modules', href: '/dashboard/settings/modules', label: 'School Modules', shortLabel: 'School modules', description: 'View enabled modules and open each module-owned configuration workspace.', icon: LayoutGrid },
  { id: 'admissions', href: '/dashboard/settings/admissions', label: 'Admission & Student Rules', shortLabel: 'Admission rules', description: 'Admission numbering, required documents, student identity, and lifecycle rules.', icon: UserCog },
  { id: 'attendance', href: '/dashboard/settings/attendance', label: 'Attendance Rules', shortLabel: 'Attendance rules', description: 'Working-day, cutoff, lock, correction, approval, and parent notification policy.', icon: CalendarCheck2 },
  { id: 'fees', href: '/dashboard/settings/fees', label: 'Fees & Receipts', shortLabel: 'Fees & receipts', description: 'Receipt numbering, late-fee, approval, cashier-close, and payment-method policy.', icon: ReceiptText },
  { id: 'exams-report-cards', href: '/dashboard/settings/exams-report-cards', label: 'Exam & Report Card', shortLabel: 'Exam & report card', description: 'Assessment, marks locking, publishing, grading, remarks, and report-card templates.', icon: ClipboardList },
  { id: 'homework-timetable-learning', href: '/dashboard/settings/homework-timetable-learning', label: 'Homework, Timetable & Learning', shortLabel: 'Homework & learning', description: 'School-wide timetable, homework, controlled learning-session, and lab rules.', icon: BookOpenCheck },
  { id: 'communication', href: '/dashboard/settings/communication', label: 'Communication Settings', shortLabel: 'Communication', description: 'Notice, channel, quiet-hour, consent, and parent-teacher communication policy.', icon: MessageSquareText },
  { id: 'documents-templates', href: '/dashboard/settings/documents-templates', label: 'Documents & Templates', shortLabel: 'Documents & templates', description: 'Protected school logo, document copy, paper defaults, and generated template boundaries.', icon: FileStack, readinessId: 'branding-documents' },
  { id: 'security', href: '/dashboard/settings/security', label: 'Security & Access', shortLabel: 'Security & access', description: 'Session, masking, sensitive-action, audit access, and export permission policy.', icon: ShieldCheck },
  { id: 'integrations', href: '/dashboard/settings/integrations', label: 'Integrations', shortLabel: 'Integrations', description: 'Safe school-visible connection status without credentials or platform controls.', icon: Link2 },
  { id: 'audit-export', href: '/dashboard/settings/audit-export', label: 'Audit Log & Data Export', shortLabel: 'Audit & export', description: 'Tenant-scoped configuration history and protected module-owned export workflows.', icon: WalletCards },
];

export function getSchoolSettingsCategory(pathname: string) {
  return SCHOOL_SETTINGS_CATEGORIES.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

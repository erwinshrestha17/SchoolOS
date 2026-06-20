import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function AcademicSettingsPage() { return <SettingsDirectoryWorkspace title="Academic Setup" description="Configure the school calendar, academic structure, and verified grading defaults through their owning contracts." areas={[
  { title: 'Academic year, calendar & holidays', description: 'Current Bikram Sambat year, start and end dates, working days, holidays, and exceptions.', href: '/dashboard/settings/academic-calendar', status: 'available' },
  { title: 'Classes, sections, shifts & subjects', description: 'Manage classes, sections, subject mapping, and foundational academic structure.', href: '/dashboard/settings/academic-structure', status: 'available' },
  { title: 'Grading, pass marks & promotion defaults', description: 'Use the tenant settings contract for verified school-wide academic and grading defaults.', href: '/dashboard/settings/policies/academic', status: 'available' },
  { title: 'Grade 11–12 streams & subject combinations', description: 'A purpose-limited school settings contract is required before these rules can be edited here.', status: 'contract-needed' },
]} note="Rooms, labs, grade bands, rounding rules, streams, and subject combinations need backend verification and OpenAPI confirmation before this page can persist them." />; }

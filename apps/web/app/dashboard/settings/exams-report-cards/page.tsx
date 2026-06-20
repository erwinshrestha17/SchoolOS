import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function ExamsReportCardsSettingsPage() { return <SettingsDirectoryWorkspace title="Exam & Report Card" description="Keep exam operations in Academics while exposing only verified school-wide configuration here." areas={[
  { title: 'Exams, CAS & results', description: 'Manage terms, assessment activity, marks review, locking, and publishing in Academics.', href: '/dashboard/academics', status: 'module-owned' },
  { title: 'Report cards', description: 'Generate and open protected report cards from the owning Academics workspace.', href: '/dashboard/academics/report-cards', status: 'module-owned' },
  { title: 'School report-card branding', description: 'Manage verified report-card copy and protected school branding.', href: '/dashboard/settings/documents-templates', status: 'available' },
  { title: 'Assessment & result policies', description: 'Absent, retest, practical, project, withheld, remarks, and publishing policy need a dedicated contract.', status: 'contract-needed' },
]} note="No assessment-template or result-policy mutation is connected here until backend verification, OpenAPI confirmation, and safe locking/audit semantics are established." />; }

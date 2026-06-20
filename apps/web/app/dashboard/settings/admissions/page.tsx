import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function AdmissionsSettingsPage() { return <SettingsDirectoryWorkspace title="Admission & Student Rules" description="Review admission and student configuration boundaries for this school." areas={[
  { title: 'Admission workflow', description: 'Applications, duplicate review, student documents, and enrolment lifecycle remain in Admissions.', href: '/dashboard/admissions', status: 'module-owned' },
  { title: 'Admission number format', description: 'A validated tenant-scoped settings contract is required before changing numbering rules.', status: 'contract-needed' },
  { title: 'Required documents & photo policy', description: 'Document requirements and student-photo rules need a File Registry-aware contract.', status: 'contract-needed' },
  { title: 'Student ID & QR rules', description: 'Identity and QR lifecycle rules need backend verification before they can be configured here.', status: 'contract-needed' },
]} note="Admission numbering, guardian relationship types, required documents, photo rules, ID-card rules, and duplicate policy need API contract confirmation. Existing Admissions workflows remain available and unchanged." />; }

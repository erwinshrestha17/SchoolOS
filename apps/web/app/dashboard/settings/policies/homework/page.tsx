import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function HomeworkPolicySettingsPage() {
  return (
    <SettingsDirectoryWorkspace
      title="Homework"
      description="Open the supported homework workflow and review the current school-policy boundary."
      areas={[
        {
          title: 'Homework workspace',
          description:
            'Publishing, reminders, assignments, submissions, and protected attachments remain in Homework.',
          href: '/dashboard/homework',
          status: 'module-owned',
        },
        {
          title: 'School-wide homework policy',
          description:
            'A purpose-limited policy contract is not available for school-wide homework defaults.',
          status: 'contract-needed',
        },
      ]}
      note="School-wide homework configuration stays unavailable until its permission, audit, and persistence contract is confirmed."
    />
  );
}

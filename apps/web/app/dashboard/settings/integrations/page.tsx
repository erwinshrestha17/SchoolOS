import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function IntegrationsSettingsPage() { return <SettingsDirectoryWorkspace title="Integrations" description="Review safe school-visible integration boundaries without exposing credentials or Platform operations." areas={[
  { title: 'Payment gateway status', description: 'School-visible status needs a purpose-limited, secret-free backend response.', status: 'contract-needed' },
  { title: 'SMS, email & push status', description: 'Provider state must distinguish disabled, dev/log, mock, and configured without exposing secrets.', status: 'contract-needed' },
  { title: 'Attendance devices', description: 'Device connection status needs a tenant-scoped integration contract.', status: 'contract-needed' },
  { title: 'School API & webhooks', description: 'Available only when an explicitly supported school-level integration contract exists.', status: 'contract-needed' },
]} note="Integration status needs backend verification and OpenAPI confirmation. Raw credentials, token values, provider secrets, storage details, queues, and Platform provider administration are never shown here." />; }

import { redirect } from 'next/navigation';

export default function SecurityAuditSettingsRedirect() {
  redirect('/dashboard/settings/audit-export');
}

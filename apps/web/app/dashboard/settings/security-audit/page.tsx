import { redirect } from 'next/navigation';

export default function SecurityAuditSettingsRedirect() {
  redirect('/dashboard/settings?section=audit');
}

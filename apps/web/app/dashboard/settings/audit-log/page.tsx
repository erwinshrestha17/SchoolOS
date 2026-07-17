import { redirect } from 'next/navigation';

export default function AuditLogLegacyRedirect() {
  redirect('/dashboard/settings/audit-export');
}

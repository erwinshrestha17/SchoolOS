import { redirect } from 'next/navigation';

export default function ModulesSettingsRedirect() {
  redirect('/dashboard/settings?section=subscription');
}

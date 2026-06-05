import { redirect } from 'next/navigation';

export default function FeesSettingsRedirect() {
  redirect('/dashboard/settings?section=fees');
}

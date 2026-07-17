import { redirect } from 'next/navigation';

export default function SettingsOverviewRedirect() {
  redirect('/dashboard/settings');
}

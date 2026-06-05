import { redirect } from 'next/navigation';

export default function SchoolProfileSettingsRedirect() {
  redirect('/dashboard/settings?section=profile');
}

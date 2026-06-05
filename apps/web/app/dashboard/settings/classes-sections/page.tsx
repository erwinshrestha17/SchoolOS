import { redirect } from 'next/navigation';

export default function ClassesSectionsSettingsRedirect() {
  redirect('/dashboard/settings?section=school-setup');
}

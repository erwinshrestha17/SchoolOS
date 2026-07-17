import { redirect } from 'next/navigation';

export default function AcademicSettingsLegacyRedirect() {
  redirect('/dashboard/settings/academic-calendar');
}

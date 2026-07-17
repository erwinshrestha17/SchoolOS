import { redirect } from 'next/navigation';

export default function SchoolProfileLegacyRedirect() {
  redirect('/dashboard/settings/school-profile');
}

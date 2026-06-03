import { redirect } from 'next/navigation';

export default function SchoolSetupPage() {
  redirect('/dashboard/settings?section=school-setup');
}

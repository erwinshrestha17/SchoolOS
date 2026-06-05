import { redirect } from 'next/navigation';

export default function AcademicStructureSettingsRedirect() {
  redirect('/dashboard/settings?section=academic');
}

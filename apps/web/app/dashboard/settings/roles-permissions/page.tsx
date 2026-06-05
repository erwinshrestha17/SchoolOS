import { redirect } from 'next/navigation';

export default function RolesPermissionsSettingsRedirect() {
  redirect('/dashboard/settings?section=roles-permissions');
}

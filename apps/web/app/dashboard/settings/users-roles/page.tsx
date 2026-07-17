import { redirect } from 'next/navigation';

export default function UsersRolesLegacyRedirect() {
  redirect('/dashboard/settings/users-access');
}

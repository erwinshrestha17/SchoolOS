import { SettingsDirectoryWorkspace } from '@/components/settings/settings-directory-workspace';

export default function UsersRolesSettingsPage() { return <SettingsDirectoryWorkspace title="Users, Roles & Permissions" description="Manage tenant-scoped school staff accounts and review backend-authoritative role permissions." areas={[
  { title: 'School users & access', description: 'Invite school users, review account status, and use supported activation and security actions.', href: '/dashboard/settings/users-access', status: 'available' },
  { title: 'Roles & permissions', description: 'Review school-level role coverage and permission boundaries without exposing Platform roles.', href: '/dashboard/settings/roles-permissions', status: 'available' },
  { title: 'Teacher assignment scope', description: 'Class, section, and subject assignment remains in the owning academic and staff workflows.', href: '/dashboard/academics', status: 'module-owned' },
]} />; }

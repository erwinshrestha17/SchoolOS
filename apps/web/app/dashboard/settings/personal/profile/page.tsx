import { PersonalProfileWorkspace } from '@/components/settings/personal-profile-workspace';

export const metadata = {
  title: 'Profile | Settings | SchoolOS',
  description:
    'Review the account identity associated with your current SchoolOS session.',
};

export default function PersonalProfilePage() {
  return (
    <div className="p-4 pb-20 sm:p-6 lg:p-7">
      <PersonalProfileWorkspace />
    </div>
  );
}

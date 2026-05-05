import { StaffDashboard } from '@/components/staff/staff-dashboard';

export const metadata = {
  title: 'My Profile | SchoolOS',
  description: 'View your personal profile, payslips, and attendance records.',
};

export default function MyProfilePage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">My Profile</h2>
      </div>
      <StaffDashboard />
    </div>
  );
}

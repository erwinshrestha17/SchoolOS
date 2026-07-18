import { BriefcaseBusiness } from 'lucide-react';
import { StaffDashboard } from '@/components/staff/staff-dashboard';
import { Badge } from '@/components/ui/badge';
import { ModuleHeader } from '@/components/ui/module-header';

export const metadata = {
  title: 'My Workspace | SchoolOS',
  description:
    'Review your employment, payslip, attendance, leave, and contract information.',
};

export default function MyWorkspacePage() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
      <ModuleHeader
        eyebrow="Employee self-service"
        title="My Workspace"
        description="Review your employment, payslip, attendance, leave, and contract information for the current school."
        metadata={
          <Badge variant="neutral" className="gap-1.5">
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
            Your employment record
          </Badge>
        }
      />
      <StaffDashboard />
    </div>
  );
}

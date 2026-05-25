import { ParentActivityView } from '../../../../components/activity/parent-activity-view';
import { PageHeader } from '../../../../components/ui/page-header';

export default function ParentActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Parent Activity Feed"
        description="Approved classroom activities and milestones visible for your child."
      />
      <ParentActivityView />
    </div>
  );
}

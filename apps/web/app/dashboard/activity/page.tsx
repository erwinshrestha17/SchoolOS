import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../components/ui/page-header';
import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  return (
    <DashboardPageShell>
      <PageHeader
        title="Activity Feed"
        description="Photo posts, student tags, mood logs, milestones, private media sharing, and delivery records."
      />
      <ActivityFeedForm />
    </DashboardPageShell>
  );
}

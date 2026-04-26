import { AppShell } from '../../../components/app-shell';
import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  return (
    <AppShell
      eyebrow="Activity Feed"
      title="Photo posts, student tags, and mood logs"
      requiredPermissions={['activity_feed:create']}
    >
      <ActivityFeedForm />
    </AppShell>
  );
}

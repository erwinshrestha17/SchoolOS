'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Feed"
        description="Photo posts, student tags, mood logs, milestones, and media sharing."
      />
      <ActivityFeedForm />
    </div>
  );
}

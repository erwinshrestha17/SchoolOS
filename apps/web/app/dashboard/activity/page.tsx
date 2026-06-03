'use client';

import { Camera } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Activity Feed"
        subtitle="Photo posts, student tags, mood logs, milestones, and media sharing."
        badge="Activity"
        category="Classroom"
        icon={<Camera size={28} />}
        accentColor="rose"
        variant="dark"
      />
      <ActivityFeedForm />
    </DashboardPageShell>
  );
}

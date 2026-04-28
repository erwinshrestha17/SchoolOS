'use client';

import { ActivityFeedForm } from '../../../components/forms/activity-feed-form';

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Transport
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Photo posts, student tags, and mood logs.
        </p>
      </div>
      <ActivityFeedForm />
    </div>
  );
}

'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function HomeworkReviewPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework Review"
        description="Review submissions, record feedback, and manage correction workflow from the live Homework workspace."
      />
      <TimetableWorkspace initialSection="Homework" />
    </div>
  );
}

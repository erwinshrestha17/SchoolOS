'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../components/timetable/timetable-workspace';

export default function HomeworkPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Homework"
        description="Create assignments, track submissions, and review student work."
      />

      <TimetableWorkspace />
    </div>
  );
}

'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../components/timetable/timetable-workspace';

export default function TimetablePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable"
        description="Plan class schedules, teacher availability, conflicts, and substitutions."
      />
      <TimetableWorkspace />
    </div>
  );
}

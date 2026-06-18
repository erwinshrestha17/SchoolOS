'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function TimetableWorkloadPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Workload"
        description="Review weekly teaching load, assigned slots, and homework counts from the live timetable workload endpoint."
      />
      <TimetableWorkspace initialSection="Teacher Workload" />
    </div>
  );
}

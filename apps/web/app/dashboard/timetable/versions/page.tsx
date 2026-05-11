'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function TimetableVersionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Versions"
        description="Create, validate, publish, lock, and archive class timetable versions."
      />
      <TimetableWorkspace initialSection="Timetable Builder" />
    </div>
  );
}

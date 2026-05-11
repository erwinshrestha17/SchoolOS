'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function TimetableBuilderPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetable Builder"
        description="Build weekly class schedules, validate conflicts, and manage timetable versions."
      />
      <TimetableWorkspace initialSection="Timetable Builder" />
    </div>
  );
}

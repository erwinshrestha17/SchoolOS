'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function NewHomeworkPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Homework"
        description="Create homework assignments using the live Homework workspace and backend APIs."
      />
      <TimetableWorkspace initialSection="Homework" />
    </div>
  );
}

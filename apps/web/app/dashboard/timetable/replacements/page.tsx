'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TeacherReplacementsList } from '../../../../components/timetable/replacements-list';

export default function TeacherReplacementsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher replacements"
        description="Schedule long-term assignment handovers, activate cutover, dispose pending work, and record handover notes without rewriting historical authorship."
      />
      <TeacherReplacementsList />
    </div>
  );
}

'use client';

import { PageHeader } from '../../../../components/ui/page-header';
import { TimetableWorkspace } from '../../../../components/timetable/timetable-workspace';

export default function TimetableSubstitutionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Substitutions"
        description="Review absent teacher coverage, substitution records, and assigned substitute teachers."
      />
      <TimetableWorkspace initialSection="Substitutions" />
    </div>
  );
}

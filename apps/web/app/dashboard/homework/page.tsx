'use client';

import { TimetableWorkspace } from '../../../components/timetable/timetable-workspace';

export default function HomeworkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Homework
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Create, assign, review, and remind homework through the Phase 2 timetable-homework workspace.
        </p>
      </div>

      <TimetableWorkspace />
    </div>
  );
}

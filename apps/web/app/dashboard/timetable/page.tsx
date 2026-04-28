'use client';

import { TimetableHomeworkForm } from '../../../components/forms/timetable-homework-form';

export default function TimetablePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Library
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Timetable and homework workflow.
        </p>
      </div>
      <TimetableHomeworkForm />
    </div>
  );
}

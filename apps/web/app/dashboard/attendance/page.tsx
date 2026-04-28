'use client';

import { AttendanceForm } from '../../../components/forms/attendance-form';

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Present-by-default class submission.
        </p>
      </div>
      <section className="shell-card p-6">
        <AttendanceForm />
      </section>
    </div>
  );
}

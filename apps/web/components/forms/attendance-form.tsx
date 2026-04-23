'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

const roster = [
  { id: 'demo-1', name: 'Aarav Shrestha' },
  { id: 'demo-2', name: 'Sana Rai' },
  { id: 'demo-3', name: 'Ritu Karki' },
];

export function AttendanceForm() {
  const [exceptions, setExceptions] = useState<Record<string, string>>({});
  const mutation = useMutation({
    mutationFn: api.submitAttendance,
  });

  return (
    <div className="grid gap-4">
      <div className="rounded-[24px] border border-[var(--line)] bg-white/60 p-5">
        <p className="label mb-3">3-Tap Flow</p>
        <p className="text-sm leading-6 text-[var(--muted)]">
          Everyone is treated as present by default. Mark only the exceptions, then submit once.
        </p>
      </div>

      <div className="grid gap-3">
        {roster.map((student) => (
          <div
            key={student.id}
            className="shell-card flex items-center justify-between rounded-[24px] px-5 py-4"
          >
            <div>
              <p className="font-semibold">{student.name}</p>
              <p className="text-sm text-[var(--muted)]">
                {exceptions[student.id] ? `Marked ${exceptions[student.id]}` : 'Present'}
              </p>
            </div>
            <div className="flex gap-2">
              {['ABSENT', 'LATE', 'LEAVE'].map((status) => (
                <button
                  key={status}
                  type="button"
                  className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                  onClick={() =>
                    setExceptions((current) => ({
                      ...current,
                      [student.id]: status,
                    }))
                  }
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white"
        onClick={() =>
          mutation.mutate({
            academicYearId: 'replace-me',
            classId: 'replace-me',
            attendanceDate: new Date().toISOString(),
            exceptions: Object.entries(exceptions).map(([studentId, status]) => ({
              studentId,
              status,
            })),
          })
        }
      >
        {mutation.isPending ? 'Submitting...' : 'Submit attendance'}
      </button>
    </div>
  );
}

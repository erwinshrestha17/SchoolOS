'use client';

type Props = {
  workload: any[];
  isLoading: boolean;
};

export function TeacherWorkloadTab({ workload, isLoading }: Props) {
  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Analytics</p>
          <h2 className="mt-1 text-lg font-bold text-gray-950">Teacher Workload Summary</h2>
          <p className="mt-1 text-sm text-gray-500">Review teaching hours and slot counts across the faculty to balance schedules.</p>
        </div>

        {isLoading ? (
          <div className="py-12 flex justify-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : workload.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No workload data found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--line)]">
                  <th className="py-3 text-left font-semibold text-gray-500">Teacher</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Emp ID</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Total Classes (Slots)</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Weekly Hours</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Active Homeworks</th>
                  <th className="py-3 text-left font-semibold text-gray-500">Workload Level</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((w: any) => {
                  const hours = Number(w.weeklyHours);
                  // Basic heuristic: >25 hours is High, <10 hours is Low
                  const level = hours >= 25 ? 'High' : hours < 10 ? 'Low' : 'Normal';
                  const levelColor = level === 'High' ? 'bg-red-50 text-red-700' : level === 'Low' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';

                  return (
                    <tr key={w.staffId} className="border-b border-[var(--line)] hover:bg-indigo-50/30 transition">
                      <td className="py-3 font-medium text-gray-950">{w.staffName}</td>
                      <td className="py-3 text-gray-500">{w.employeeId || '—'}</td>
                      <td className="py-3 font-semibold text-gray-700">{w.slotCount}</td>
                      <td className="py-3 text-gray-700">{hours.toFixed(1)} hrs</td>
                      <td className="py-3 text-gray-700">{w.homeworkCount}</td>
                      <td className="py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelColor}`}>
                          {level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

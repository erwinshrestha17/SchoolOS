'use client';

import { HRWorkspace } from '../../../components/hr/hr-workspace';

export default function HRAndPayrollPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight sm:text-3xl">
          HR & Payroll
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage staff directory, contracts, leave requests, and attendance.
        </p>
      </div>

      <HRWorkspace />
    </div>
  );
}

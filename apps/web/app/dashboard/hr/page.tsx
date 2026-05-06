'use client';

import { HRWorkspace } from '../../../components/hr/hr-workspace';

export default function HRPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight sm:text-3xl">
          HR / Staff
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage staff profiles, contracts, leave, attendance, and payroll-ready records.
        </p>
      </div>

      <HRWorkspace />
    </div>
  );
}

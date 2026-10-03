'use client';

import { Suspense } from 'react';
import { TeacherEligibilityWorkspace } from '../../../../components/hr/teacher-eligibility-workspace';

export default function TeacherEligibilityPage() {
  return (
    <div className="animate-in fade-in duration-500">
      <Suspense
        fallback={
          <p className="text-sm text-slate-500">Loading teacher eligibility…</p>
        }
      >
        <TeacherEligibilityWorkspace />
      </Suspense>
    </div>
  );
}

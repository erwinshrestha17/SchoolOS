'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { HRWorkspace } from '../../../components/hr/hr-workspace';

export default function HRAndPayrollPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll Workspace"
        description="Review payroll runs, payslips, approvals, and posting readiness."
      />

      <HRWorkspace />
    </div>
  );
}

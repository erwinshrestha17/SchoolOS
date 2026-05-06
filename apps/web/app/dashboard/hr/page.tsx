'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { HRWorkspace } from '../../../components/hr/hr-workspace';

export default function HRPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="HR Workspace"
        description="Manage staff profiles, contracts, leave, and attendance workflows."
      />

      <HRWorkspace />
    </div>
  );
}

'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function PublishingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Result Publishing"
        description="Review readiness, publish results, and notify guardians through approved channels."
      />
      <AcademicsWorkspace initialSection="Result Publishing" />
    </div>
  );
}

'use client';

import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { PageHeader } from '@/components/ui/page-header';

export default function PromotionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotion Readiness"
        description="Review student eligibility and move students to the next academic year."
      />
      <AcademicsWorkspace initialSection="Promotion" />
    </div>
  );
}

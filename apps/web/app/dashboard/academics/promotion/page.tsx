'use client';

import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';

export default function PromotionPage() {
  return (
    <AcademicsSectionPage
      title="Promotion"
      description="Review promotion readiness and class progression decisions."
    >
      <AcademicsWorkspace initialSection="Promotion" />
    </AcademicsSectionPage>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { AcademicsSectionPage } from '@/components/academics/academics-section-page';
import { AcademicsWorkspace } from '@/components/academics/academics-workspace';
import { Button } from '@/components/ui/button';

export default function MarksEntryPage() {
  const router = useRouter();

  return (
    <AcademicsSectionPage
      title="Marks Entry"
      description="Record and review student scores for terminal and periodic assessments."
      primaryAction={
        <Button
          variant="outline"
          type="button"
          onClick={() => router.push('/dashboard/academics/retakes')}
        >
          Retest queue
        </Button>
      }
    >
      <AcademicsWorkspace initialSection="Marks Entry" />
    </AcademicsSectionPage>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingState } from '../../../../components/ui/loading-state';

export default function HomeworkReviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/homework?tab=completion');
  }, [router]);

  return <LoadingState variant="page" label="Redirecting to Homework..." />;
}

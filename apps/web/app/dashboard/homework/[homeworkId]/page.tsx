'use client';

import { useParams } from 'next/navigation';
import { HomeworkDetailPage } from '@/components/homework/homework-detail-page';

export default function HomeworkDetailRoute() {
  const params = useParams<{ homeworkId?: string | string[] }>();
  const homeworkId = Array.isArray(params.homeworkId)
    ? params.homeworkId[0]
    : params.homeworkId;

  return <HomeworkDetailPage homeworkId={homeworkId ?? ''} />;
}

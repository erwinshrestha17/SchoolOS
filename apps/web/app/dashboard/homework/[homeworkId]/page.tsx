'use client';

import { useParams } from 'next/navigation';
import { HomeworkDetailPage } from '@/components/homework/homework-detail-page';
import { SupportHomeworkDetailPage } from '@/components/homework/support-homework-detail-page';
import { useSession } from '@/components/session-provider';

export default function HomeworkDetailRoute() {
  const params = useParams<{ homeworkId?: string | string[] }>();
  const { session } = useSession();
  const homeworkId = Array.isArray(params.homeworkId)
    ? params.homeworkId[0]
    : params.homeworkId;

  if (session?.user.isSupportOverride) {
    return <SupportHomeworkDetailPage homeworkId={homeworkId ?? ''} />;
  }

  return <HomeworkDetailPage homeworkId={homeworkId ?? ''} />;
}

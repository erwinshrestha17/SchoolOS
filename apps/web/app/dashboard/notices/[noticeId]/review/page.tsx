import { NoticeReviewWorkspace } from '@/components/notices/notice-review-workspace';

export default async function ReviewNoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  return <NoticeReviewWorkspace noticeId={noticeId} />;
}

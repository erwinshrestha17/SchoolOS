import { NoticeComposerWorkspace } from '@/components/notices/notice-composer-workspace';

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ noticeId: string }>;
}) {
  const { noticeId } = await params;
  return <NoticeComposerWorkspace noticeId={noticeId} />;
}

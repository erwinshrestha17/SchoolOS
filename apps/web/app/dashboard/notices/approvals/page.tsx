import { NoticeQueueWorkspace } from '@/components/notices/notice-queue-workspace';

export default function NoticeApprovalsPage() {
  return (
    <NoticeQueueWorkspace
      title="Notice approval queue"
      description="Review high-impact notices waiting for the tenant-scoped approval workflow. Open a notice to inspect its current approval record."
      lifecycleStatus="APPROVAL_PENDING"
      readOnlyNotice="This queue is currently read-only. Approval submission and decisions are not yet available in the school web workspace."
    />
  );
}

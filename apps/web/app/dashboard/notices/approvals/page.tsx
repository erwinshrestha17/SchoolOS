import { NoticeQueueWorkspace } from '@/components/notices/notice-queue-workspace';

export default function NoticeApprovalsPage() {
  return (
    <NoticeQueueWorkspace
      title="Notice approval queue"
      description="Review high-impact notices waiting for the tenant-scoped approval workflow. Open a notice to approve or reject the linked approval request."
      lifecycleStatus="APPROVAL_PENDING"
    />
  );
}

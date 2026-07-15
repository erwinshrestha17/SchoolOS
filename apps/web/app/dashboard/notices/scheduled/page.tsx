import { NoticeQueueWorkspace } from '@/components/notices/notice-queue-workspace';

export default function ScheduledNoticesPage() {
  return (
    <NoticeQueueWorkspace
      title="Scheduled notices"
      description="Review notices waiting for their backend-controlled publication time. A time passing never implies successful delivery."
      lifecycleStatus="SCHEDULED"
    />
  );
}

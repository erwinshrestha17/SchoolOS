import { ParentTeacherMessagingWorkspace } from '@/components/messaging/parent-teacher-messaging-workspace';

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <ParentTeacherMessagingWorkspace threadId={threadId} />;
}

import { ParentTeacherMessagingWorkspace } from '@/components/messaging/parent-teacher-messaging-workspace';

export default function MessageModerationPage() {
  return <ParentTeacherMessagingWorkspace initialStatusFilter="ESCALATED" />;
}

import { AttendanceSessionUnavailableWorkspace } from '@/components/attendance/attendance-m2-workspaces';

export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <AttendanceSessionUnavailableWorkspace sessionId={sessionId} />;
}

import { AttendanceCorrectionDetailWorkspace } from '@/components/attendance/attendance-m2-workspaces';

export default async function AttendanceCorrectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AttendanceCorrectionDetailWorkspace id={id} />;
}

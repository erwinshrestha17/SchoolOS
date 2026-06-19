import { AttendanceStudentProfileWorkspace } from '@/components/attendance/attendance-m2-workspaces';

export default async function AttendanceStudentProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  return <AttendanceStudentProfileWorkspace studentId={studentId} />;
}

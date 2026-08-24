import { AttendanceMarkWorkspace } from '@/components/attendance/attendance-m2-workspaces';

type AttendanceDraftSearchParams = Record<
  string,
  string | string[] | undefined
>;

export default async function AttendanceMarkPage({
  searchParams,
}: {
  searchParams: Promise<AttendanceDraftSearchParams>;
}) {
  const values = await searchParams;
  const academicYearId = singleSearchParam(values.academicYearId);
  const classId = singleSearchParam(values.classId);
  const sectionId = singleSearchParam(values.sectionId);
  const attendanceDate = singleSearchParam(values.attendanceDate);
  const initialDraftScope =
    academicYearId && classId && attendanceDate
      ? {
          academicYearId,
          classId,
          attendanceDate,
          ...(sectionId ? { sectionId } : {}),
        }
      : undefined;

  return <AttendanceMarkWorkspace initialDraftScope={initialDraftScope} />;
}

function singleSearchParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

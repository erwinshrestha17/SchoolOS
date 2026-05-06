import { StaffDetailWorkspace } from '../../../../components/hr/staff-detail-workspace';

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Staff Profile
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Profile, attendance, leave, salary, and payroll history.
        </p>
      </div>
      <StaffDetailWorkspace staffId={staffId} />
    </div>
  );
}

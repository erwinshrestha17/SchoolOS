import { DashboardPageShell } from '../../../../../components/dashboard/dashboard-page-shell';
import { LearningWorkspace } from '../../../../../components/learning/learning-workspace';
import { PageHeader } from '../../../../../components/ui/page-header';

export default async function LearningActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>;
}) {
  const { activityId } = await params;

  return (
    <DashboardPageShell>
      <PageHeader
        title="Edit Learning Activity"
        description="Review activity details, update questions, or launch a school-only session."
      />
      <LearningWorkspace initialTab="builder" activityId={activityId} />
    </DashboardPageShell>
  );
}

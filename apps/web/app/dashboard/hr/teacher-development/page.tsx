import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { TeacherDevelopmentWorkspace } from '@/components/hr/teacher-development-workspace';

export default function TeacherDevelopmentPage() {
  return (
    <DashboardPageShell>
      <TeacherDevelopmentWorkspace />
    </DashboardPageShell>
  );
}

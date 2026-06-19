import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';
import { StudentDocumentsWorkspace } from '../../../../components/m1/student-documents-workspace';

export default function StudentDocumentsPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader title="Student Documents & Guardians" description="Review student guardians, protected documents, verification state, expiry, and audit history." />
      <StudentDocumentsWorkspace />
    </DashboardPageShell>
  );
}

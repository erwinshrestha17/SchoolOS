import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { IemisReadinessWorkspace } from '../../../../components/m1/iemis-readiness-workspace';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';

export default function IemisReadinessPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader title="iEMIS Readiness" description="Validate student data against backend-owned iEMIS readiness rules and manage protected imports and exports." />
      <IemisReadinessWorkspace />
    </DashboardPageShell>
  );
}

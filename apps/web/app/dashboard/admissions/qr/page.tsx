import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';
import { QrIdWorkspace } from '../../../../components/m1/qr-id-workspace';

export default function QrIdCardsPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader title="QR / ID Cards" description="Manage secure student QR credentials, card generation, rotation, revocation, and scan audit history." />
      <QrIdWorkspace />
    </DashboardPageShell>
  );
}

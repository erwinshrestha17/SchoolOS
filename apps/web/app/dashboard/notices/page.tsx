import { AppShell } from '../../../components/app-shell';
import { CommunicationsForm } from '../../../components/forms/communications-form';

export default function NoticesPage() {
  return (
    <AppShell eyebrow="Communications" title="Notices, events, and audience targeting">
      <CommunicationsForm />
    </AppShell>
  );
}

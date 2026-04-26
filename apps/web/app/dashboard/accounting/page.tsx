import { AppShell } from '../../../components/app-shell';
import { AccountingForm } from '../../../components/forms/accounting-form';

export default function AccountingPage() {
  return (
    <AppShell
      eyebrow="Phase 2"
      title="Accounting reports and year-end close"
      requiredPermissions={['accounting:read']}
    >
      <AccountingForm />
    </AppShell>
  );
}

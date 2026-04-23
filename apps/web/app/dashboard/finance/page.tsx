import { AppShell } from '../../../components/app-shell';
import { FinanceForm } from '../../../components/forms/finance-form';

export default function FinancePage() {
  return (
    <AppShell eyebrow="Finance" title="Fee setup, collection, and ledger demo">
      <FinanceForm />
    </AppShell>
  );
}

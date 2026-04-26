import { AppShell } from '../../../components/app-shell';
import { PayrollForm } from '../../../components/forms/payroll-form';

export default function PayrollPage() {
  return (
    <AppShell
      eyebrow="Phase 2"
      title="HR contracts and payroll posting"
      requiredPermissions={['payroll:manage']}
    >
      <PayrollForm />
    </AppShell>
  );
}

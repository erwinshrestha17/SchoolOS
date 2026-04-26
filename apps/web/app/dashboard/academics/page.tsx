import { AppShell } from '../../../components/app-shell';
import { AcademicsForm } from '../../../components/forms/academics-form';

export default function AcademicsPage() {
  return (
    <AppShell
      eyebrow="Phase 2"
      title="Academics, exams, CAS, and report cards"
      requiredPermissions={['academics:manage']}
    >
      <AcademicsForm />
    </AppShell>
  );
}

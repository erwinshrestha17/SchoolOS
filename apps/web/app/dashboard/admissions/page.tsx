import { AppShell } from '../../../components/app-shell';
import { AdmissionForm } from '../../../components/forms/admission-form';

export default function AdmissionsPage() {
  return (
    <AppShell eyebrow="Admissions" title="Student onboarding and guardian linkage">
      <section className="shell-card rounded-[32px] p-8">
        <AdmissionForm />
      </section>
    </AppShell>
  );
}

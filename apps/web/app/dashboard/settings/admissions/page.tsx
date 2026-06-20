import Link from 'next/link';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { M1PageHeader } from '../../../../components/m1/m1-page-header';
import { AdmissionPolicySettings } from '../../../../components/settings/admission-policy-settings';

export default function AdmissionSettingsPage() {
  return (
    <DashboardPageShell>
      <M1PageHeader
        title="Admission settings"
        description="Choose when the school can admit a student directly and when admission review is needed."
        secondaryActions={
          <Link
            href="/dashboard/settings"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to settings
          </Link>
        }
      />
      <AdmissionPolicySettings />
    </DashboardPageShell>
  );
}

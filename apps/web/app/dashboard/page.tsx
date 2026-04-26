import { AppShell } from '../../components/app-shell';
import { MetricCard } from '../../components/metric-card';

export default function DashboardPage() {
  return (
    <AppShell
      eyebrow="Overview"
      title="Admin command center"
      requiredPermissions={['tenants:read']}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Admissions queued" value="12" accent="linear-gradient(180deg, #ca5d2e, #7f2f11)" />
        <MetricCard label="Attendance submitted" value="83%" accent="linear-gradient(180deg, #1f6f67, #0f4944)" />
        <MetricCard label="Outstanding invoices" value="Rs 128k" accent="linear-gradient(180deg, #c6a15b, #8d6b2c)" />
      </section>

      <section className="shell-card rounded-[32px] p-8">
        <p className="label mb-3">Implementation Notes</p>
        <div className="grid gap-3 text-sm leading-6 text-[var(--muted)]">
          <p>API routes are versioned under `/api/v1` and documented with Swagger.</p>
          <p>Multi-tenant RBAC remains the control plane across users, attendance, finance, and communications.</p>
          <p>Deferred modules are visible in navigation but intentionally not implemented as fake flows.</p>
        </div>
      </section>
    </AppShell>
  );
}

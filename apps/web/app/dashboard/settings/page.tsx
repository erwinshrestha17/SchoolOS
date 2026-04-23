import { AppShell } from '../../../components/app-shell';

export default function SettingsPage() {
  return (
    <AppShell eyebrow="Settings" title="Roles, deployment model, and rollout posture">
      <section className="shell-card rounded-[32px] p-8">
        <p className="label mb-3">Guardrails</p>
        <div className="grid gap-3 text-sm leading-6 text-[var(--muted)]">
          <p>Primary deployment model is multi-tenant SaaS.</p>
          <p>Web admin/staff is v1. Parent and teacher mobile apps stay deferred behind stable APIs.</p>
          <p>Permissions should stay aligned with the backend permission catalog before new pages ship.</p>
        </div>
      </section>
    </AppShell>
  );
}

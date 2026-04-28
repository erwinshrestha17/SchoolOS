'use client';

import { SetupForm } from '../../../components/forms/setup-form';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          School setup and rollout posture.
        </p>
      </div>

      <SetupForm />

      <section className="shell-card p-6">
        <p className="label mb-3">Phase 1 Guardrails</p>
        <div className="grid gap-3 text-sm leading-6 text-gray-500">
          <p>Primary deployment model is multi-tenant SaaS.</p>
          <p>
            Web admin/staff is v1. Parent and teacher mobile apps stay deferred
            behind stable APIs.
          </p>
          <p>
            Permissions should stay aligned with the backend permission catalog
            before new pages ship.
          </p>
        </div>
      </section>
    </div>
  );
}

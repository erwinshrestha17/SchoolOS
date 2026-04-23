import { TenantRegistrationForm } from '../../components/forms/tenant-registration-form';

export default function RegisterPage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <section className="shell-card rounded-[36px] p-8 md:p-10">
          <p className="label mb-3">Tenant Provisioning</p>
          <h1 className="text-4xl font-black tracking-tight">Create a new school workspace</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Registration provisions the tenant, admin account, RBAC defaults, fee heads, chart accounts,
            and the current academic year on the backend.
          </p>
          <div className="mt-8">
            <TenantRegistrationForm />
          </div>
        </section>
      </div>
    </main>
  );
}

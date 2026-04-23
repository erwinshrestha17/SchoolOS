import Link from 'next/link';
import { LoginForm } from '../../components/forms/login-form';

export default function LoginPage() {
  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="shell-card rounded-[36px] p-8">
          <p className="label mb-3">Operator Login</p>
          <h1 className="text-4xl font-black tracking-tight">Tenant-aware sign in</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
            Web admin uses the backend refresh-cookie flow, short-lived access tokens, and RBAC permissions aligned with the API.
          </p>
          <div className="mt-6">
            <Link href="/register" className="text-sm font-semibold text-[var(--accent-dark)]">
              Need a new school tenant? Register here.
            </Link>
          </div>
        </section>

        <section className="shell-card rounded-[36px] p-8">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}

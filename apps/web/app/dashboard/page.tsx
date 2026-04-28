'use client';

import { MetricCard } from '../../components/metric-card';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Admin Command Center
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of your school operations and key metrics.
        </p>
      </div>

      {/* Metric cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Phase 1 Core"
          value="Live"
          accent="linear-gradient(135deg, #6366f1, #4f46e5)"
        />
        <MetricCard
          label="Phase 2 Academic Cycle"
          value="Ready"
          accent="linear-gradient(135deg, #10b981, #059669)"
        />
        <MetricCard
          label="Ledger-backed Workflows"
          value="Fees + Payroll"
          accent="linear-gradient(135deg, #f59e0b, #d97706)"
        />
      </section>

      {/* Implementation notes */}
      <section className="shell-card p-6">
        <p className="label mb-3">Implementation Notes</p>
        <div className="grid gap-3 text-sm leading-6 text-gray-500">
          <p>
            API routes are versioned under <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5 text-gray-700">/api/v1</code> and documented with Swagger.
          </p>
          <p>
            Multi-tenant RBAC remains the control plane across users, attendance,
            academics, finance, HR, payroll, accounting, and communications.
          </p>
          <p>
            Phase 2 adds subjects, exams, CAS, report cards, timetable, homework,
            HR contracts, payroll journals, accounting reports, and parent-teacher
            messaging.
          </p>
          <p>
            Library, transport, AI narratives, and mobile apps remain visible as
            deferred modules instead of fake implementations.
          </p>
        </div>
      </section>
    </div>
  );
}

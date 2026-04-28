'use client';

import { AdmissionForm } from '../../../components/forms/admission-form';

export default function AdmissionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Students
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Student onboarding and guardian linkage.
        </p>
      </div>
      <section className="shell-card p-6">
        <AdmissionForm />
      </section>
    </div>
  );
}

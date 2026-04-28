'use client';

import { PayrollForm } from '../../../components/forms/payroll-form';

export default function PayrollPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Staff & HR
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          HR contracts and payroll posting.
        </p>
      </div>
      <PayrollForm />
    </div>
  );
}

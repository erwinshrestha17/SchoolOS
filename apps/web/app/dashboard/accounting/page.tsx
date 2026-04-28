'use client';

import { AccountingForm } from '../../../components/forms/accounting-form';

export default function AccountingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Accounting
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Reports and year-end close.
        </p>
      </div>
      <AccountingForm />
    </div>
  );
}

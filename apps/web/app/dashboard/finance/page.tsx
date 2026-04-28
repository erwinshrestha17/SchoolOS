'use client';

import { FinanceForm } from '../../../components/forms/finance-form';

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Fee Collection
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Fee setup, collection, and ledger posting.
        </p>
      </div>
      <FinanceForm />
    </div>
  );
}

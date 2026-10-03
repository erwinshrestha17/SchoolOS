import { Suspense } from 'react';
import { AccountantDestinationWorkspace } from '@/components/accounting/accountant-destination-workspace';
import { PayablesWorkspace } from '@/components/accounting/payables-workspace';
import { SourcePostingBatchesPanel } from '@/components/accounting/source-posting-batches-panel';

export default function AccountingPayablesPage() {
  return (
    <AccountantDestinationWorkspace
      title="Expenses & Payables"
      description="Vendors, vendor bills, approvals and payments. A bill is prepared, approved by a different person and paid by a third; every step posts through the ledger."
    >
      <div className="space-y-5">
        <Suspense
          fallback={<p className="text-sm text-slate-500">Loading payables…</p>}
        >
          <PayablesWorkspace />
        </Suspense>
        <SourcePostingBatchesPanel sourceModule="M11" />
      </div>
    </AccountantDestinationWorkspace>
  );
}

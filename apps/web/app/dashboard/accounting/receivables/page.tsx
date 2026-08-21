import { AccountantDestinationWorkspace } from '@/components/accounting/accountant-destination-workspace';
import { SourcePostingBatchesPanel } from '@/components/accounting/source-posting-batches-panel';

export default function AccountingReceivablesPage() {
  return (
    <AccountantDestinationWorkspace
      title="Fees & Receivables"
      description="Review official student invoices, balances, aging, waivers, allocations, and M3-to-M11 posting state."
      links={[
        { href: '/dashboard/fees/invoices', label: 'Invoice register', description: 'Search the student invoice register.' },
        { href: '/dashboard/fees/ledgers', label: 'Student ledgers', description: 'Open one student’s billed, paid, waived, refunded, and outstanding history.' },
        { href: '/dashboard/fees/adjustments?view=waivers', label: 'Discounts & waivers', description: 'Review controlled discounts and approved waivers.' },
        { href: '/dashboard/fees/reports', label: 'Receivables reports', description: 'Run current fee, collection, and aging reports.' },
      ]}
    >
      <div className="space-y-5">
        <SourcePostingBatchesPanel sourceModule="M3" />
      </div>
    </AccountantDestinationWorkspace>
  );
}

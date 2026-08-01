import { AccountantDestinationWorkspace } from '@/components/accounting/accountant-destination-workspace';

export default function AccountingCashBankPage() {
  return (
    <AccountantDestinationWorkspace
      title="Cash & Bank"
      description="Reconcile bank statements, review cash position, and trace cashier closes and deposits through authoritative records."
      links={[
        { href: '/dashboard/accounting/reconciliation', label: 'Bank reconciliation', description: 'Import, match, review, and finalize bank reconciliation.' },
        { href: '/dashboard/accounting/reports?report=cash-book', label: 'Cash book', description: 'Review deterministic cash running balances.' },
        { href: '/dashboard/accounting/reports?report=bank-book', label: 'Bank book', description: 'Review bank-account postings for the selected fiscal context.' },
        { href: '/dashboard/fees/cashier-close', label: 'Cashier closes & deposits', description: 'Review daily close, variance, and deposit preparation.' },
      ]}
    />
  );
}

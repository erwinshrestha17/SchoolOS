import { AccountantDestinationWorkspace } from '@/components/accounting/accountant-destination-workspace';

export default function AccountingCollectionsPage() {
  return (
    <AccountantDestinationWorkspace
      title="Collections & Receipts"
      description="Collect against verified invoices, inspect allocations, open protected receipts, and use correction workflows without editing confirmed history."
      links={[
        { href: '/dashboard/fees/collect', label: 'Collect payment', description: 'Find a student or invoice and record one idempotent collection.' },
        { href: '/dashboard/fees/receipts', label: 'Receipt center', description: 'Verify and download permission-checked receipts.' },
        { href: '/dashboard/fees/adjustments', label: 'Refunds & reversals', description: 'Request controlled corrections with an audit reason.' },
        { href: '/dashboard/fees/cashier-close', label: 'Cashier close', description: 'Count, explain variance, submit, approve, and prepare deposit.' },
      ]}
    />
  );
}

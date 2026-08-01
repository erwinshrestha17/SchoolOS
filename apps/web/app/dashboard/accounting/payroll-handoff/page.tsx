import { AccountantDestinationWorkspace } from '@/components/accounting/accountant-destination-workspace';
import { SourcePostingBatchesPanel } from '@/components/accounting/source-posting-batches-panel';

export default function AccountingPayrollHandoffPage() {
  return (
    <AccountantDestinationWorkspace
      title="Payroll Handoff"
      description="Review approved M7 payroll totals and M11 posting state without recalculating salary or gaining payroll payment authority."
      links={[
        { href: '/dashboard/payroll/reports', label: 'Payroll reports', description: 'Review approved payroll summaries and accounting posting status.' },
        { href: '/dashboard/payroll/readiness', label: 'Payroll readiness', description: 'Review M7 exceptions before an approved accounting handoff.' },
        { href: '/dashboard/accounting/source-mappings', label: 'Posting mappings', description: 'Review M7-to-M11 account mapping health.' },
        { href: '/dashboard/accounting/reports?report=failed-unposted', label: 'Posting failures', description: 'Inspect approved source records not represented in the ledger.' },
      ]}
    >
      <div className="space-y-5">
        <SourcePostingBatchesPanel sourceModule="M7" />
      </div>
    </AccountantDestinationWorkspace>
  );
}

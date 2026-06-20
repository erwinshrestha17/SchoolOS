import { AccountingAuditWorkspace } from '../../../../components/accounting/accounting-audit-workspace';

export const metadata = {
  title: 'Audit Trail | M11 Accounting | SchoolOS',
};

export default function AccountingAuditPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Audit Trail
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Immutable log of all financial transactions, configurations, and ledger modifications.
        </p>
      </div>

      <AccountingAuditWorkspace />
    </div>
  );
}

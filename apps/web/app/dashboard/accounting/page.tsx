'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { AccountingWorkspace } from '../../../components/accounting/accounting-workspace';

export default function AccountingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounting Workspace"
        description="Track journals, ledgers, fiscal periods, and financial reports."
      />
      <AccountingWorkspace />
    </div>
  );
}

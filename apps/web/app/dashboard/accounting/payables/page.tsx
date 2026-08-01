import { AccountantDestinationUnavailable } from '@/components/accounting/accountant-destination-workspace';

export default function AccountingPayablesPage() {
  return (
    <AccountantDestinationUnavailable
      title="Expenses & Payables are safely locked"
      description="The additive vendor, expense, payable, settlement, petty-cash, and supporting-document contracts are being connected. No placeholder payable writes are available."
    />
  );
}

import { redirect } from 'next/navigation';

export default function FinanceCashierCloseRedirect() {
  redirect('/dashboard/fees/cashier-close');
}

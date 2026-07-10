import { redirect } from 'next/navigation';

export default function FinanceInvoicesRedirect() {
  redirect('/dashboard/fees/invoices');
}

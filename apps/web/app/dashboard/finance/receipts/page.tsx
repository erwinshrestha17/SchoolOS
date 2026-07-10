import { redirect } from 'next/navigation';

export default function FinanceReceiptsRedirect() {
  redirect('/dashboard/fees/receipts');
}

import { redirect } from 'next/navigation';

export default function FinanceReversalsRefundsRedirect() {
  redirect('/dashboard/fees/adjustments');
}

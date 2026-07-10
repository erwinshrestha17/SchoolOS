import { redirect } from 'next/navigation';

export default function FinanceReportsRedirect() {
  redirect('/dashboard/fees/reports');
}

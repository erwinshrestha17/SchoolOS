import { redirect } from 'next/navigation';

export default function FinanceCollectionsRedirect() {
  redirect('/dashboard/fees/collect');
}

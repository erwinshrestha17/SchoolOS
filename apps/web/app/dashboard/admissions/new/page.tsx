import { redirect } from 'next/navigation';

export default function NewAdmissionRedirect() {
  redirect('/dashboard/admissions');
}

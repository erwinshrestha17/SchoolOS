import { redirect } from 'next/navigation';

export default function AdmissionReviewRedirect() {
  redirect('/dashboard/admissions');
}

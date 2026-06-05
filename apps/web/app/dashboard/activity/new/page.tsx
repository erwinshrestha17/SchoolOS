import { redirect } from 'next/navigation';

export default function NewActivityPostRedirect() {
  redirect('/dashboard/activity');
}

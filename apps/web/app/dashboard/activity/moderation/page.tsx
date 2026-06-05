import { redirect } from 'next/navigation';

export default function ActivityModerationRedirect() {
  redirect('/dashboard/activity');
}

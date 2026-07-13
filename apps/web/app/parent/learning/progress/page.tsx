import { redirect } from 'next/navigation';

export default function ParentLearningProgressPage() {
  redirect('/login?notice=parent-mobile-only');
}

import { redirect } from 'next/navigation';

export default function ParentLearningPage() {
  redirect('/login?notice=parent-mobile-only');
}

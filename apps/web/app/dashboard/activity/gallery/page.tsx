import { redirect } from 'next/navigation';

export default function ActivityGalleryRedirect() {
  redirect('/dashboard/activity?section=Media+Gallery');
}

import { redirect } from 'next/navigation';

export function redirectToPlatformRoute(to: string): never {
  redirect(to);
}

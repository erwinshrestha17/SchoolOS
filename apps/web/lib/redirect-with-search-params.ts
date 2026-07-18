import { redirect } from 'next/navigation';

export type RouteSearchParams = Record<string, string | string[] | undefined>;

/**
 * Keeps compatibility redirects safe for bookmarked filtered views. Callers
 * may omit migration-only keys such as `section` and `tab`.
 */
export async function redirectWithSearchParams(
  destination: string,
  searchParams: Promise<RouteSearchParams>,
  omit: string[] = [],
): Promise<never> {
  const values = await searchParams;
  const omitted = new Set(omit);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (omitted.has(key) || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) query.append(key, entry);
    } else {
      query.set(key, value);
    }
  }

  const serialized = query.toString();
  redirect(serialized ? `${destination}?${serialized}` : destination);
}

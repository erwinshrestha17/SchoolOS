import {
  redirectWithSearchParams,
  type RouteSearchParams,
} from '@/lib/redirect-with-search-params';

export default function AttendanceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  return redirectWithSearchParams(
    '/dashboard/settings/policies/attendance',
    searchParams,
  );
}

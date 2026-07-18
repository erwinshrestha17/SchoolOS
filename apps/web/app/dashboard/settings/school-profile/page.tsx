import {
  redirectWithSearchParams,
  type RouteSearchParams,
} from '@/lib/redirect-with-search-params';

export default function SchoolProfilePage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  return redirectWithSearchParams(
    '/dashboard/settings/school/identity',
    searchParams,
  );
}

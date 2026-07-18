import {
  redirectWithSearchParams,
  type RouteSearchParams,
} from '@/lib/redirect-with-search-params';

export default function ClassesSectionsSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  return redirectWithSearchParams(
    '/dashboard/settings/school/academic-structure',
    searchParams,
  );
}

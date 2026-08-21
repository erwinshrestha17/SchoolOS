import {
  redirectWithSearchParams,
  type RouteSearchParams,
} from '@/lib/redirect-with-search-params';

export default function LegacyNoticeFailuresPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  return redirectWithSearchParams(
    '/dashboard/notifications/failures',
    searchParams,
  );
}

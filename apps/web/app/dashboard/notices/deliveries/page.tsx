import {
  redirectWithSearchParams,
  type RouteSearchParams,
} from '@/lib/redirect-with-search-params';

export default function LegacyNoticeDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<RouteSearchParams>;
}) {
  return redirectWithSearchParams(
    '/dashboard/notifications/deliveries',
    searchParams,
  );
}

'use client';

import { PaginatedDataTable } from '@/components/schoolos';
import { useQuery } from '@tanstack/react-query';
import { formatBsDateTime } from '@schoolos/core';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { StatusBadge } from '../../../../components/ui/status-badge';

export default function ActivityDeliveriesPage() {
  const deliveriesQuery = useQuery({
    queryKey: ['activity-deliveries'],
    queryFn: () =>
      api.listNotificationDeliveries({ sourceType: 'activity_post' }),
  });

  const deliveries = deliveriesQuery.data ?? [];

  return (
    <DashboardPageShell>
      <PageHeader
        title="Activity deliveries"
        description="Guardian notification delivery state for published activity posts — channel, destination, timestamps, and failures."
      />

      <PaginatedDataTable
        columns={[
          {
            id: 'title',
            header: 'Notification',
            cell: (row) => row.title ?? '',
          },
          {
            id: 'channel',
            header: 'Channel',
            cell: (row) => row.channel ?? '',
          },
          {
            id: 'destination',
            header: 'Destination',
            cell: (delivery) => delivery.destination || 'Direct',
          },
          {
            id: 'status',
            header: 'Status',
            cell: (delivery) => <StatusBadge status={delivery.status} />,
          },
          {
            id: 'sent',
            header: 'Sent',
            cell: (delivery) =>
              delivery.sentAt ? formatBsDateTime(delivery.sentAt) : 'Not yet',
          },
          {
            id: 'created',
            header: 'Created',
            cell: (delivery) => formatBsDateTime(delivery.createdAt),
          },
        ]}
        items={deliveries}
        emptyTitle="No delivery records"
        emptyDescription="Notification history will appear here once activities are published."
        getRowId={(delivery) => delivery.id}
        status={
          deliveriesQuery.isError
            ? 'error'
            : deliveriesQuery.isLoading
              ? 'loading'
              : 'ready'
        }
        errorMessage={deliveriesQuery.error?.message}
        onRetry={() => void deliveriesQuery.refetch()}
        completeList
      />
    </DashboardPageShell>
  );
}

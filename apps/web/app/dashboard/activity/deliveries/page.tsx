'use client';

import { useQuery } from '@tanstack/react-query';
import { formatBsDateTime } from '@schoolos/core';
import { api } from '../../../../lib/api';
import { DashboardPageShell } from '../../../../components/dashboard/dashboard-page-shell';
import { PageHeader } from '../../../../components/ui/page-header';
import { DataTable } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';

export default function ActivityDeliveriesPage() {
  const deliveriesQuery = useQuery({
    queryKey: ['activity-deliveries'],
    queryFn: () => api.listNotificationDeliveries({ sourceType: 'activity_post' }),
  });

  const deliveries = deliveriesQuery.data ?? [];

  return (
    <DashboardPageShell>
      <PageHeader
        title="Activity deliveries"
        description="Guardian notification delivery state for published activity posts — channel, destination, timestamps, and failures. Backend-owned records only."
      />

      <DataTable
        columns={[
          { header: 'Notification', accessorKey: 'title' },
          { header: 'Channel', accessorKey: 'channel' },
          {
            header: 'Destination',
            cell: (delivery) => delivery.destination || 'Direct',
          },
          {
            header: 'Status',
            cell: (delivery) => <StatusBadge status={delivery.status} />,
          },
          {
            header: 'Sent',
            cell: (delivery) =>
              delivery.sentAt ? formatBsDateTime(delivery.sentAt) : 'Not yet',
          },
          {
            header: 'Created',
            cell: (delivery) => formatBsDateTime(delivery.createdAt),
          },
        ]}
        data={deliveries}
        isLoading={deliveriesQuery.isLoading}
        error={deliveriesQuery.isError ? deliveriesQuery.error : null}
        emptyTitle="No delivery records"
        emptyMessage="Notification history will appear here once activities are published."
        getRowKey={(delivery) => delivery.id}
      />
    </DashboardPageShell>
  );
}

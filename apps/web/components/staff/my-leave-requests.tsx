'use client';

import { Surface } from '@/components/schoolos';
import { useState } from 'react';
import { formatBsDate } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { LeaveRequestCreateDialog } from '../hr/leave-request-create-dialog';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useSession } from '@/components/session-provider';

interface MyLeaveRequestsProps {
  staffId?: string;
}

export function MyLeaveRequests({ staffId }: MyLeaveRequestsProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { hasPermissions } = useSession();
  const canRequestLeave = hasPermissions(['hr:leave:request']);

  const queryClient = useQueryClient();
  const requestsQuery = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: api.listMyLeaveRequests,
  });
  const withdrawMutation = useMutation({
    mutationFn: (id: string) => api.withdrawLeaveRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
  });

  if (requestsQuery.isLoading) {
    return <LoadingState label="Loading your leave requests..." />;
  }

  if (requestsQuery.isError) {
    return (
      <ErrorState
        title="Leave history unavailable"
        message="Your leave requests could not be loaded. The HR module may be unavailable for this school."
        error={requestsQuery.error}
        onRetry={() => void requestsQuery.refetch()}
      />
    );
  }

  const requests = requestsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Leave Requests</h3>
        {canRequestLeave ? (
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request leave
          </Button>
        ) : null}
      </div>

      {withdrawMutation.isError ? (
        <p role="alert" className="text-sm text-rose-700">
          {withdrawMutation.error instanceof Error &&
          withdrawMutation.error.message
            ? withdrawMutation.error.message
            : 'The leave request could not be withdrawn.'}
        </p>
      ) : null}

      <Surface padding="flush">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reviewer Notes</TableHead>
              <TableHead className="pr-6 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No leave requests found.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="pl-6 font-medium">
                    {formatValue(request.leaveType)}
                  </TableCell>
                  <TableCell>
                    {formatBsDate(request.startsOn)} –{' '}
                    {formatBsDate(request.endsOn)}
                  </TableCell>
                  <TableCell>{String(request.days)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        request.status === 'APPROVED'
                          ? 'success'
                          : request.status === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {formatValue(request.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {request.reviewNote || '—'}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {request.status === 'PENDING' && canRequestLeave ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => withdrawMutation.mutate(request.id)}
                        disabled={withdrawMutation.isPending}
                      >
                        Withdraw
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Surface>

      {isCreateOpen && canRequestLeave ? (
        <LeaveRequestCreateDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          lockedStaffId={staffId}
          selfService
        />
      ) : null}
    </div>
  );
}

function formatValue(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

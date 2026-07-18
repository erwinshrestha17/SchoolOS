'use client';

import { useState } from 'react';
import { formatBsDate } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  const requestsQuery = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: api.listMyLeaveRequests,
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Reviewer Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {request.reviewNote || '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { LeaveRequestCreateDialog } from '../hr/leave-request-create-dialog';

interface MyLeaveRequestsProps {
  staffId?: string;
}

export function MyLeaveRequests({ staffId }: MyLeaveRequestsProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: async () => {
      const data = await api.listMyLeaveRequests();
      return Array.isArray(data) ? data : [];
    },
  });

  if (isLoading) return (
    <div className="flex justify-center p-8">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Leave Requests</h3>
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Request Leave
        </Button>
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
              {error ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-red-500 py-8">
                    Failed to load leave requests.
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No leave requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="pl-6 font-medium">{req.leaveType}</TableCell>
                    <TableCell>
                      {new Date(req.startsOn).toLocaleDateString()} - {new Date(req.endsOn).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{req.totalDays}</TableCell>
                    <TableCell>
                      <Badge variant={
                        req.status === 'APPROVED' ? 'success' as any : 
                        req.status === 'REJECTED' ? 'destructive' : 
                        'secondary'
                      }>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {req.reviewerRemarks || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isCreateOpen && (
        <LeaveRequestCreateDialog
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          lockedStaffId={staffId}
        />
      )}
    </div>
  );
}

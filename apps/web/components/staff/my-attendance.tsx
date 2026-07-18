'use client';

import { useQuery } from '@tanstack/react-query';
import { formatBsDate, formatNepalTime } from '@schoolos/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { api } from '../../lib/api';

export function MyAttendance() {
  const attendanceQuery = useQuery({
    queryKey: ['my-attendance'],
    queryFn: api.listMyAttendance,
  });

  if (attendanceQuery.isLoading) {
    return <LoadingState label="Loading your attendance history..." />;
  }

  if (attendanceQuery.isError) {
    return (
      <ErrorState
        title="Attendance history unavailable"
        message="Your attendance history could not be loaded. The Attendance module may be unavailable for this school."
        error={attendanceQuery.error}
        onRetry={() => void attendanceQuery.refetch()}
      />
    );
  }

  const records = attendanceQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent attendance history</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No attendance records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {formatBsDate(record.attendanceDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <AttendanceStatusIcon status={record.status} />
                          <span className="text-sm font-medium">
                            {formatStatus(record.status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.checkInAt
                          ? formatNepalTime(record.checkInAt)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {record.checkOutAt
                          ? formatNepalTime(record.checkOutAt)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.note || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AttendanceStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'PRESENT':
      return (
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
      );
    case 'ABSENT':
      return <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />;
    case 'LATE':
      return <Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />;
    default:
      return (
        <AlertCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />
      );
  }
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

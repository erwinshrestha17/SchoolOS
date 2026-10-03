'use client';
import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDate,
  type StaffAttendanceCorrectionRecord,
} from '@schoolos/core';
import { formatNepalDateTimeLocalInput } from '../../lib/date-utils';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { Button } from '../ui/button';
import { FormField, TextArea } from '../ui/form-field';

function Review({
  item,
  canDecide,
}: {
  item: StaffAttendanceCorrectionRecord;
  canDecide: boolean;
}) {
  const client = useQueryClient();
  const [reason, setReason] = useState('');
  const impact = useQuery({
    queryKey: ['staff-attendance-correction-impact', item.id],
    queryFn: () => api.staffAttendanceCorrectionImpact(item.id),
  });
  const decision = useMutation({
    mutationFn: (action: 'approve' | 'reject') =>
      api.decideStaffAttendanceCorrection(item.id, action, reason.trim()),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ['staff-attendance-corrections'],
      });
      await client.invalidateQueries({
        queryKey: ['staff-attendance-summary'],
      });
    },
  });
  return (
    <div className="space-y-3 border-t border-[var(--border-default)] p-4">
      <dl className="grid gap-3 sm:grid-cols-2 text-sm">
        <div>
          <dt className="font-semibold">Original times (Nepal)</dt>
          <dd>
            In:{' '}
            {item.originalCheckInAt
              ? `${formatBsDate(item.originalCheckInAt)} · ${formatNepalDateTimeLocalInput(item.originalCheckInAt).slice(11)}`
              : 'Not recorded'}{' '}
            · Out:{' '}
            {item.originalCheckOutAt
              ? `${formatBsDate(item.originalCheckOutAt)} · ${formatNepalDateTimeLocalInput(item.originalCheckOutAt).slice(11)}`
              : 'Not recorded'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Requested times (Nepal)</dt>
          <dd>
            In:{' '}
            {item.requestedCheckInAt
              ? `${formatBsDate(item.requestedCheckInAt)} · ${formatNepalDateTimeLocalInput(item.requestedCheckInAt).slice(11)}`
              : 'Not recorded'}{' '}
            · Out:{' '}
            {item.requestedCheckOutAt
              ? `${formatBsDate(item.requestedCheckOutAt)} · ${formatNepalDateTimeLocalInput(item.requestedCheckOutAt).slice(11)}`
              : 'Not recorded'}
          </dd>
        </div>
      </dl>
      <p className="text-sm break-words">{item.reason}</p>
      {impact.isPending && <p role="status">Loading payroll day impact…</p>}
      {impact.isError && (
        <p role="status">
          Payroll impact unavailable. Check payroll access or retry.{' '}
          <Button variant="outline" onClick={() => void impact.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {impact.data && !impact.isError && (
        <p className="text-sm">
          Provisional impact ({impact.data.workingDays} working days): paid days{' '}
          {impact.data.paidDaysDelta > 0 ? '+' : ''}
          {impact.data.paidDaysDelta}; unpaid days{' '}
          {impact.data.unpaidDaysDelta > 0 ? '+' : ''}
          {impact.data.unpaidDaysDelta}.{' '}
          {impact.data.payrollLocked
            ? 'Approval queues this change for the next payroll run. Finalized attendance and pay stay unchanged.'
            : 'Approval applies this change to attendance.'}
        </p>
      )}
      {item.status === 'PENDING_PAYROLL_ADJUSTMENT' && (
        <p role="status">
          Approved · Pending payroll adjustment. Finalized attendance and
          payroll are preserved.
        </p>
      )}
      {item.status === 'PENDING' && canDecide && (
        <>
          <FormField label="Decision reason (required to reject)">
            <TextArea
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button
              disabled={decision.isPending}
              onClick={() => decision.mutate('approve')}
            >
              Approve
            </Button>
            <Button
              variant="outline"
              disabled={decision.isPending || !reason.trim()}
              onClick={() => decision.mutate('reject')}
            >
              Reject
            </Button>
          </div>
        </>
      )}
      {item.status === 'PENDING' && !canDecide && (
        <p>A different authorized user must decide this request.</p>
      )}
      {decision.isError && (
        <p role="alert">
          {decision.error.message}{' '}
          <Button
            variant="outline"
            onClick={() =>
              void client.invalidateQueries({
                queryKey: ['staff-attendance-corrections'],
              })
            }
          >
            Refresh queue
          </Button>
        </p>
      )}
    </div>
  );
}

export function StaffAttendanceCorrectionQueue() {
  const { hasPermissions, session } = useSession();
  const canReview = hasPermissions(['hr:attendance-corrections:approve']);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [
      'staff-attendance-corrections',
      session?.tenant.id,
      session?.user.id,
      page,
    ],
    queryFn: () => api.listStaffAttendanceCorrections(page),
    enabled: canReview,
  });
  if (!canReview) return null;
  return (
    <section
      className="space-y-3 pt-6"
      aria-label="Staff attendance correction review"
    >
      <h2 className="text-lg font-semibold">Attendance correction review</h2>
      {query.isPending && <p role="status">Loading requests…</p>}
      {query.isError && (
        <p role="alert">
          Unable to load correction requests.{' '}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {query.data?.items.length === 0 && <p>No correction requests.</p>}
      {query.data && !query.isError && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th scope="col">Staff / date</th>
                <th scope="col">Original</th>
                <th scope="col">Requested</th>
                <th scope="col">State</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-t align-top">
                    <td className="p-3">
                      {item.staff?.fullName}
                      <br />
                      {formatBsDate(item.attendanceDate)}
                    </td>
                    <td className="p-3">{item.originalStatus}</td>
                    <td className="p-3">{item.requestedStatus}</td>
                    <td className="p-3">{item.status.replaceAll('_', ' ')}</td>
                    <td className="p-3">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setSelected(selected === item.id ? null : item.id)
                        }
                        aria-expanded={selected === item.id}
                      >
                        Review request
                      </Button>
                    </td>
                  </tr>
                  {selected === item.id && (
                    <tr>
                      <td colSpan={5}>
                        <Review
                          item={item}
                          canDecide={item.requesterId !== session?.user.id}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {query.data && !query.isError && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>Page {page}</span>
          <Button
            variant="outline"
            disabled={page * 25 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}

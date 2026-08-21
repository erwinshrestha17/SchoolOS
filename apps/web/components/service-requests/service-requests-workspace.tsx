'use client';

import type { PermissionKey } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Download,
  MessageSquarePlus,
  UserCheck,
} from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { PaginatedDataTable } from '@/components/schoolos/data/paginated-data-table';
import { useSession } from '@/components/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/primitives/button';
import { ModuleHeader } from '@/components/ui/module-header';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { ReasonDialog } from '@/components/ui/reason-dialog';
import { SectionCard } from '@/components/ui/section-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/primitives/tabs';
import { api } from '@/lib/api';
import {
  serviceRequestsApi,
  type SchoolServiceRequestStatus,
  type SchoolServiceRequestSummary,
} from '@/lib/api/service-requests';
import { formatDate, formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 25;

const ACTIVE_STATUSES: SchoolServiceRequestStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'REOPENED',
];

const STATUS_TABS: Array<{
  value: string;
  label: string;
  status?: SchoolServiceRequestStatus;
}> = [
  { value: 'OPEN', label: 'Open', status: 'OPEN' },
  { value: 'ASSIGNED', label: 'Assigned', status: 'ASSIGNED' },
  { value: 'IN_PROGRESS', label: 'In progress', status: 'IN_PROGRESS' },
  { value: 'REOPENED', label: 'Reopened', status: 'REOPENED' },
  { value: 'RESOLVED', label: 'Resolved', status: 'RESOLVED' },
  { value: 'ALL', label: 'All' },
];

function hasPermission(
  granted: Set<PermissionKey>,
  permission: PermissionKey,
) {
  return granted.has(permission);
}

function statusTone(status: SchoolServiceRequestStatus) {
  switch (status) {
    case 'OPEN':
    case 'REOPENED':
      return 'warning' as const;
    case 'ASSIGNED':
    case 'IN_PROGRESS':
      return 'info' as const;
    case 'RESOLVED':
    case 'CLOSED':
      return 'success' as const;
    case 'CANCELLED':
      return 'neutral' as const;
    default:
      return 'neutral' as const;
  }
}

function priorityTone(priority: string) {
  return priority === 'HIGH' ? ('warning' as const) : ('neutral' as const);
}

function formatType(type: string) {
  return type === 'PAYMENT_DISPUTE' ? 'Payment dispute' : 'General request';
}

function formatCategory(category: string) {
  return category
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function ServiceRequestsQueueWorkspace() {
  const { session } = useSession();
  const grantedPermissions = new Set<PermissionKey>(
    session?.user.permissions ?? [],
  );
  const canRead = hasPermission(grantedPermissions, 'service_requests:read');
  const [statusTab, setStatusTab] = useState('OPEN');
  const [page, setPage] = useState(1);
  const selectedStatus = STATUS_TABS.find((tab) => tab.value === statusTab)
    ?.status;

  const listQuery = useQuery({
    queryKey: ['service-requests', selectedStatus, page],
    queryFn: () =>
      serviceRequestsApi.listServiceRequests({
        status: selectedStatus,
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Action Centre is restricted"
        description="You do not have permission to review parent and school service requests."
      />
    );
  }

  const columns = [
    {
      id: 'subject',
      header: 'Request',
      cell: (row: SchoolServiceRequestSummary) => (
        <div>
          <p className="font-bold text-slate-900">{row.subject}</p>
          <p className="text-xs font-semibold text-slate-500">
            {formatType(row.type)} • {formatCategory(row.category)}
          </p>
        </div>
      ),
    },
    {
      id: 'student',
      header: 'Child',
      cell: (row: SchoolServiceRequestSummary) => (
        <div>
          <p className="font-semibold text-slate-800">{row.student.name}</p>
          <p className="text-xs text-slate-500">{row.student.classSection}</p>
        </div>
      ),
    },
    {
      id: 'requester',
      header: 'Requested by',
      hideBelow: 'md' as const,
      cell: (row: SchoolServiceRequestSummary) => row.requestedBy.name,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row: SchoolServiceRequestSummary) => (
        <Badge variant={statusTone(row.status)}>{formatStatus(row.status)}</Badge>
      ),
    },
    {
      id: 'deadline',
      header: 'Deadline',
      hideBelow: 'lg' as const,
      cell: (row: SchoolServiceRequestSummary) => (
        <div>
          <p className="text-sm text-slate-700">
            {formatDateTime(row.responseDeadline)}
          </p>
          {row.isOverdue ? (
            <Badge variant="warning">Overdue</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      align: 'right' as const,
      cell: (row: SchoolServiceRequestSummary) => (
        <Link
          href={`/dashboard/service-requests/${row.id}`}
          className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-bold text-[var(--primary-dark)] transition hover:bg-slate-50"
        >
          Review
        </Link>
      ),
    },
  ];

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="Action Centre"
        title="Parent & school requests"
        description="Review structured parent complaints, payment disputes, and school follow-up cases with independent escalation and resolution controls."
        primaryAction={
          <Link
            href="/dashboard/attendance/corrections"
            className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Attendance corrections
          </Link>
        }
      />

      <Tabs
        value={statusTab}
        onValueChange={(value) => {
          setStatusTab(value);
          setPage(1);
        }}
      >
        <TabsList aria-label="Service request queue">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <SectionCard
        title="Request queue"
        description="School service requests matching the current filters."
        headerAction={
          <Badge variant="neutral">{listQuery.data?.total ?? 0} requests</Badge>
        }
      >
        <PaginatedDataTable
          columns={columns}
          items={listQuery.data?.items ?? []}
          getRowId={(row) => row.id}
          status={
            listQuery.isError
              ? 'error'
              : listQuery.isLoading
                ? 'loading'
                : 'ready'
          }
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={listQuery.data?.total ?? 0}
          onPageChange={setPage}
          onRetry={() => void listQuery.refetch()}
          errorMessage="Service requests could not load. Retry to refresh this tenant-scoped queue."
          emptyTitle="No requests in this queue"
          emptyDescription="Cases matching this status will appear here when parents or staff open structured requests."
        />
      </SectionCard>
    </DashboardPageShell>
  );
}

type DialogMode = 'resolve' | 'escalate' | 'note-parent' | 'note-internal' | null;

export function ServiceRequestDetailWorkspace({ requestId }: { requestId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const grantedPermissions = new Set<PermissionKey>(
    session?.user.permissions ?? [],
  );
  const canRead = hasPermission(grantedPermissions, 'service_requests:read');
  const canManage = hasPermission(grantedPermissions, 'service_requests:manage');
  const currentUserId = session?.user.id ?? null;

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [escalateAssigneeId, setEscalateAssigneeId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['service-request', requestId],
    queryFn: () => serviceRequestsApi.getServiceRequest(requestId),
    enabled: canRead,
  });

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: api.listRoleCatalog,
    enabled: canManage,
  });

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: api.listUsers,
    enabled: canManage,
  });

  const eligibleAssignees = useMemo(() => {
    if (!rolesQuery.data || !usersQuery.data) return [];
    const managerRoleIds = new Set(
      rolesQuery.data
        .filter((role) =>
          role.permissions.some(
            (permission) => permission.key === 'service_requests:manage',
          ),
        )
        .map((role) => role.id),
    );
    return usersQuery.data.filter(
      (user) =>
        user.status === 'ACTIVE' &&
        user.roles.some((role) => managerRoleIds.has(role.id)),
    );
  }, [rolesQuery.data, usersQuery.data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['service-request', requestId] }),
      queryClient.invalidateQueries({ queryKey: ['service-requests'] }),
    ]);
  };

  const triageMutation = useMutation({
    mutationFn: (reason: string) => {
      if (!currentUserId) {
        throw new Error('Session is unavailable. Sign in again and retry.');
      }
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      return serviceRequestsApi.triageServiceRequest(requestId, {
        assignedToUserId: currentUserId,
        priority: 'NORMAL',
        responseDeadline: deadline,
        status: 'IN_PROGRESS',
        reason,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Assignment could not be saved.',
      );
    },
  });

  const noteMutation = useMutation({
    mutationFn: ({
      body,
      visibility,
    }: {
      body: string;
      visibility: 'PARENT' | 'INTERNAL';
    }) => serviceRequestsApi.addServiceRequestNote(requestId, { body, visibility }),
    onSuccess: async () => {
      setDialogMode(null);
      setActionError(null);
      await invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Note could not be saved.',
      );
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (resolutionSummary: string) =>
      serviceRequestsApi.resolveServiceRequest(requestId, { resolutionSummary }),
    onSuccess: async () => {
      setDialogMode(null);
      setActionError(null);
      await invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Resolution could not be saved.',
      );
    },
  });

  const escalateMutation = useMutation({
    mutationFn: ({ reason, assignedToUserId }: { reason: string; assignedToUserId: string }) =>
      serviceRequestsApi.escalateServiceRequest(requestId, {
        reason,
        assignedToUserId,
      }),
    onSuccess: async () => {
      setDialogMode(null);
      setEscalateAssigneeId('');
      setActionError(null);
      await invalidate();
    },
    onError: (error) => {
      setActionError(
        error instanceof Error ? error.message : 'Escalation could not be saved.',
      );
    },
  });

  if (!canRead) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Action Centre is restricted"
        description="You do not have permission to review parent and school service requests."
      />
    );
  }

  const request = detailQuery.data;
  const isActive = request ? ACTIVE_STATUSES.includes(request.status) : false;
  const cannotResolve =
    !request ||
    !currentUserId ||
    request.requestedBy.id === currentUserId ||
    request.assignedTo?.id === currentUserId;

  return (
    <DashboardPageShell>
      <div className="mb-4">
        <Button
          type="button"
          variant="ghost"
          className="px-0 text-[var(--primary-dark)]"
          onClick={() => router.push('/dashboard/service-requests')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Action Centre
        </Button>
      </div>

      {detailQuery.isLoading ? (
        <SectionCard title="Loading request" description="Fetching case details.">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </SectionCard>
      ) : detailQuery.isError || !request ? (
        <SectionCard
          title="Request unavailable"
          description="This case could not be loaded or is outside your tenant scope."
        >
          <Button type="button" onClick={() => void detailQuery.refetch()}>
            Retry
          </Button>
        </SectionCard>
      ) : (
        <>
          <ModuleHeader
            eyebrow="Action Centre"
            title={request.subject}
            description={`${formatType(request.type)} • ${formatCategory(request.category)}`}
            primaryAction={
              canManage && isActive ? (
                <Button
                  type="button"
                  onClick={() =>
                    triageMutation.mutate('Assigned from web Action Centre.')
                  }
                  disabled={triageMutation.isPending}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Assign to me
                </Button>
              ) : undefined
            }
            moreActionItems={
              canManage
                ? [
                    {
                      label: 'Add parent update',
                      icon: <MessageSquarePlus className="h-4 w-4" />,
                      onClick: () => setDialogMode('note-parent'),
                    },
                    {
                      label: 'Add internal note',
                      icon: <ClipboardList className="h-4 w-4" />,
                      onClick: () => setDialogMode('note-internal'),
                    },
                  ]
                : []
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone(request.status)}>
                {formatStatus(request.status)}
              </Badge>
              <Badge variant={priorityTone(request.priority)}>
                {request.priority === 'HIGH' ? 'High priority' : 'Normal priority'}
              </Badge>
              {request.isOverdue ? (
                <Badge variant="warning">Response overdue</Badge>
              ) : null}
            </div>
          </ModuleHeader>

          {actionError ? (
            <p className="rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm text-danger-800">
              {actionError}
            </p>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SectionCard title="Case details" description="Parent-visible request context and school response state.">
              <p className="text-sm leading-6 text-slate-700">{request.description}</p>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <DetailItem label="Child" value={`${request.student.name} • ${request.student.classSection}`} />
                <DetailItem label="Requested by" value={request.requestedBy.name} />
                <DetailItem
                  label="Assigned to"
                  value={request.assignedTo?.name ?? 'Unassigned'}
                />
                <DetailItem
                  label="Response deadline"
                  value={formatDateTime(request.responseDeadline)}
                />
                <DetailItem label="Opened" value={formatDateTime(request.createdAt)} />
                <DetailItem label="Last updated" value={formatDateTime(request.updatedAt)} />
              </dl>

              {request.invoice ? (
                <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Linked invoice
                  </p>
                  <p className="mt-2 font-bold text-slate-900">
                    {request.invoice.invoiceNumber}
                  </p>
                  <p className="text-sm text-slate-600">
                    {request.invoice.status} • due {formatDate(request.invoice.dueDate)}
                  </p>
                  <Link
                    href={`/dashboard/fees/ledgers?invoiceId=${encodeURIComponent(request.invoice.id)}`}
                    className="mt-3 inline-flex text-sm font-bold text-[var(--primary-dark)]"
                  >
                    Open fee ledger
                  </Link>
                </div>
              ) : null}

              {request.resolutionSummary ? (
                <div className="mt-6 rounded-xl border border-success-100 bg-success-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-success-700">
                    Resolution sent to parent
                  </p>
                  <p className="mt-2 text-sm leading-6 text-success-900">
                    {request.resolutionSummary}
                  </p>
                </div>
              ) : null}

              {request.escalation ? (
                <div className="mt-6 rounded-xl border border-warning-100 bg-warning-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-warning-700">
                    Escalated
                  </p>
                  <p className="mt-2 text-sm leading-6 text-warning-900">
                    {request.escalation.reason ?? 'Escalated for urgent follow-up.'}
                  </p>
                  <p className="mt-1 text-xs text-warning-700">
                    {formatDateTime(request.escalation.at)}
                  </p>
                </div>
              ) : null}
            </SectionCard>

            <div className="space-y-6">
              {canManage && isActive ? (
                <SectionCard title="Actions" description="Independent review rules apply to resolve and escalate.">
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      onClick={() => setDialogMode('resolve')}
                      disabled={resolveMutation.isPending || cannotResolve}
                    >
                      Resolve for parent
                    </Button>
                    {cannotResolve ? (
                      <p className="text-xs leading-5 text-slate-500">
                        Independent review required: the requester or current assignee cannot close this case. Escalate to another manager first.
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDialogMode('escalate')}
                      disabled={escalateMutation.isPending}
                    >
                      Escalate & reassign
                    </Button>
                  </div>
                </SectionCard>
              ) : null}

              <NotesSection title="Parent-visible updates" notes={request.notes} />
              <NotesSection title="Internal notes" notes={request.internalNotes} internal />

              {request.attachments.length > 0 ? (
                <SectionCard title="Protected evidence" description="Downloads require your signed-in SchoolOS access.">
                  <ul className="space-y-3">
                    {request.attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {attachment.label ?? attachment.fileName}
                          </p>
                          <p className="text-xs text-slate-500">{attachment.mimeType}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            void serviceRequestsApi
                              .downloadServiceRequestAttachment(
                                requestId,
                                attachment.id,
                                attachment.fileName,
                              )
                              .catch((error) => {
                                setActionError(
                                  error instanceof Error
                                    ? error.message
                                    : 'Evidence download failed.',
                                );
                              })
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ) : null}
            </div>
          </div>
        </>
      )}

      <ReasonDialog
        isOpen={dialogMode === 'resolve'}
        title="Resolve this request"
        description="Explain the outcome the parent should see. The resolution is sent after the request is successfully recorded."
        confirmLabel="Send resolution"
        destructive={false}
        minLength={8}
        reasonLabel="Resolution summary"
        reasonPlaceholder="Describe what the school decided and what happens next."
        isConfirming={resolveMutation.isPending}
        onConfirm={(reason) => resolveMutation.mutate(reason)}
        onClose={() => setDialogMode(null)}
      />

      <ReasonDialog
        isOpen={dialogMode === 'note-parent' || dialogMode === 'note-internal'}
        title={
          dialogMode === 'note-parent'
            ? 'Add parent-visible update'
            : 'Add internal note'
        }
        description={
          dialogMode === 'note-parent'
            ? 'This update is shared with the linked parent in the mobile app.'
            : 'This note stays internal to school staff with service-request access.'
        }
        confirmLabel="Save note"
        destructive={false}
        minLength={2}
        reasonLabel="Note"
        reasonPlaceholder="Write the school follow-up note."
        isConfirming={noteMutation.isPending}
        onConfirm={(body) =>
          noteMutation.mutate({
            body,
            visibility: dialogMode === 'note-parent' ? 'PARENT' : 'INTERNAL',
          })
        }
        onClose={() => setDialogMode(null)}
      />

      {dialogMode === 'escalate' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning-600" />
              <div className="flex-1">
                <h2 className="text-lg font-black text-slate-950">Escalate & reassign</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Escalation sets high priority and requires an independent manager with service-request manage access.
                </p>
              </div>
            </div>
            <label className="mt-5 block">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Reassign to
              </span>
              <select
                value={escalateAssigneeId}
                onChange={(event) => setEscalateAssigneeId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select a manager</option>
                {eligibleAssignees
                  .filter((user) => user.id !== request?.assignedTo?.id)
                  .map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email ?? user.phone ?? user.id}
                    </option>
                  ))}
              </select>
            </label>
            <EscalateReasonForm
              disabled={!escalateAssigneeId || escalateMutation.isPending}
              isConfirming={escalateMutation.isPending}
              onCancel={() => {
                setDialogMode(null);
                setEscalateAssigneeId('');
              }}
              onConfirm={(reason) =>
                escalateMutation.mutate({
                  reason,
                  assignedToUserId: escalateAssigneeId,
                })
              }
            />
          </div>
        </div>
      ) : null}
    </DashboardPageShell>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function NotesSection({
  title,
  notes,
  internal = false,
}: {
  title: string;
  notes: SchoolServiceRequestSummary['notes'];
  internal?: boolean;
}) {
  if (notes.length === 0) {
    return (
      <SectionCard title={title} description={internal ? 'Internal school notes only.' : 'Updates shared with the parent.'}>
        <p className="text-sm text-slate-500">No notes yet.</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title={title} description={internal ? 'Internal school notes only.' : 'Updates shared with the parent.'}>
      <ul className="space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="rounded-xl border border-slate-100 p-3">
            <p className="text-sm leading-6 text-slate-800">{note.body}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              {note.author} • {formatDateTime(note.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function EscalateReasonForm({
  disabled,
  isConfirming,
  onCancel,
  onConfirm,
}: {
  disabled: boolean;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <>
      <label className="mt-4 block">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Escalation reason
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          placeholder="Why does this need urgent follow-up?"
        />
      </label>
      <div className="mt-5 flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={disabled || reason.trim().length < 8}
          onClick={() => onConfirm(reason.trim())}
        >
          {isConfirming ? 'Escalating…' : 'Escalate request'}
        </Button>
      </div>
    </>
  );
}

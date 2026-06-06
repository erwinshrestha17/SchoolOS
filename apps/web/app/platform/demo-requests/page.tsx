'use client';

import type {
  PaginatedResponse,
  PlatformDemoRequestDetail,
  PlatformDemoRequestStatus,
  PlatformDemoRequestSummary,
} from '@schoolos/core';
import {
  Building2,
  Calendar,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../../../lib/api';
import {
  PlatformEmptyState,
  PlatformInlineError,
  PlatformSectionSkeleton,
} from '../_components/platform-operator-states';

const DEMO_STATUSES: PlatformDemoRequestStatus[] = [
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'CONVERTED',
  'CLOSED',
  'SPAM',
];

const initialPage: PaginatedResponse<PlatformDemoRequestSummary> = {
  items: [],
  total: 0,
  page: 1,
  limit: 15,
  hasNextPage: false,
};

function statusBadgeVariant(
  status: PlatformDemoRequestStatus,
): 'success' | 'warning' | 'destructive' | 'info' | 'neutral' {
  switch (status) {
    case 'CONVERTED':
      return 'success';
    case 'SCHEDULED':
      return 'warning';
    case 'SPAM':
      return 'destructive';
    case 'NEW':
      return 'info';
    default:
      return 'neutral';
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PlatformDemoRequestsPage() {
  const [data, setData] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PlatformDemoRequestStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlatformDemoRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<PlatformDemoRequestStatus>('NEW');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listPlatformDemoRequests({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status,
      });
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load demo requests.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const result = await api.getPlatformDemoRequest(id);
      setDetail(result);
      setNextStatus(result.status);
      setInternalNotes(result.internalNotes ?? '');
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : 'Failed to load demo request.',
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setSaving(false);
  };

  const handleStatusUpdate = async () => {
    if (!selectedId) return;
    setSaving(true);
    setDetailError(null);
    try {
      const updated = await api.updatePlatformDemoRequestStatus(selectedId, {
        status: nextStatus,
        internalNotes: internalNotes.trim() || undefined,
      });
      setDetail(updated);
      await fetchList();
    } catch (err) {
      setDetailError(
        err instanceof Error ? err.message : 'Failed to update demo request.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Demo Requests
          </h1>
          <p className="mt-1 text-slate-500">
            Review public marketing intake leads, follow up, and track conversion
            status.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => fetchList()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <Input
            placeholder="Search school, contact, email, or phone..."
            className="pl-10"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as PlatformDemoRequestStatus | 'all');
            setPage(1);
          }}
          className="w-[200px]"
        >
          <option value="all">All statuses</option>
          {DEMO_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <PlatformInlineError message={error} onRetry={fetchList} />
      ) : loading ? (
        <PlatformSectionSkeleton rows={5} />
      ) : data.items.length === 0 ? (
        <PlatformEmptyState
          icon={MessageSquare}
          title="No demo requests yet"
          description="Public demo intake submissions will appear here for platform operators to review and follow up."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Students</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-semibold text-slate-900">
                      {item.schoolName}
                    </div>
                    <div className="text-xs text-slate-500">{item.schoolType}</div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-800">
                      {item.contactName}
                    </div>
                    <div className="text-xs text-slate-500">{item.role}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {item.location}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {item.studentsCount}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(item.status)}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(item.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => openDetail(item.id)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t border-slate-100 p-4">
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(selectedId)}
        onOpenChange={(open: boolean) => !open && closeDetail()}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demo request review</DialogTitle>
            <DialogDescription>
              Update follow-up status and keep internal operator notes for sales
              handoff.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <PlatformSectionSkeleton rows={4} />
          ) : detailError && !detail ? (
            <PlatformInlineError message={detailError} />
          ) : detail ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField
                  icon={Building2}
                  label="School"
                  value={`${detail.schoolName} (${detail.schoolType})`}
                />
                <DetailField
                  icon={User}
                  label="Contact"
                  value={`${detail.contactName} — ${detail.role}`}
                />
                <DetailField icon={Mail} label="Email" value={detail.email} />
                <DetailField icon={Phone} label="Phone" value={detail.phone} />
                <DetailField label="Location" value={detail.location} />
                <DetailField
                  icon={Calendar}
                  label="Expected timeline"
                  value={detail.expectedTimeline}
                />
                <DetailField label="Students" value={detail.studentsCount} />
                {detail.branchesCount ? (
                  <DetailField label="Branches" value={detail.branchesCount} />
                ) : null}
              </div>

              {detail.interestedModules.length > 0 ? (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Interested modules
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.interestedModules.map((module) => (
                      <Badge key={module} variant="neutral">
                        {module}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail.message ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Message
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {detail.message}
                  </p>
                </div>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div>
                  <Label htmlFor="demo-status">Status</Label>
                  <Select
                    id="demo-status"
                    value={nextStatus}
                    onChange={(event) =>
                      setNextStatus(event.target.value as PlatformDemoRequestStatus)
                    }
                    className="mt-1"
                  >
                    {DEMO_STATUSES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="demo-notes">Internal notes</Label>
                  <Textarea
                    id="demo-notes"
                    className="mt-1 min-h-[120px]"
                    placeholder="Follow-up notes visible only to platform operators..."
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                    maxLength={2000}
                  />
                </div>
                {detailError ? (
                  <PlatformInlineError message={detailError} />
                ) : null}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeDetail}>
              Close
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={!detail || saving || detailLoading}
            >
              {saving ? 'Saving...' : 'Save follow-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {Icon ? <Icon size={14} /> : null}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

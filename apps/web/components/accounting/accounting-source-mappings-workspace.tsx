'use client';

import {
  formatBsDate,
  formatBsDateForInput,
  formatBsDateTime,
  parseBsDateInput,
  toGregorianDateFromBs,
  type AccountingSourceMappingSummary,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, Waypoints } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { api } from '../../lib/api';
import { useSession } from '../session-provider';
import { Badge } from '../ui/badge';
import { BsDateField } from '../ui/bs-date-field';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';
import { PageState } from '../ui/page-state';
import { SectionCard } from '../ui/section-card';
import { Select } from '../ui/select';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';

const sourceModules = ['FEES', 'PAYROLL', 'CANTEEN', 'LIBRARY', 'TRANSPORT'] as const;
type SourceModule = (typeof sourceModules)[number];
type MappingStatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

const emptyForm = () => ({
  sourceModule: 'FEES' as SourceModule,
  sourceType: '',
  postingType: 'DEFAULT',
  debitAccountId: '',
  creditAccountId: '',
  description: '',
  effectiveFromBs: formatBsDateForInput(new Date()),
  effectiveToBs: '',
});

export function AccountingSourceMappingsWorkspace() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { hasPermissions } = useSession();
  const canManage = hasPermissions(['accounting:settings:update']);

  const page = positiveInt(searchParams.get('page'), 1);
  const search = searchParams.get('search') ?? '';
  const deferredSearch = useDeferredValue(search.trim());
  const requestedModule = searchParams.get('sourceModule');
  const sourceModule = sourceModules.includes(requestedModule as SourceModule)
    ? (requestedModule as SourceModule)
    : undefined;
  const requestedStatus = searchParams.get('status');
  const status: MappingStatusFilter =
    requestedStatus === 'ACTIVE' || requestedStatus === 'ARCHIVED'
      ? requestedStatus
      : 'ALL';
  const limit = 20;

  const mappingsQuery = useQuery({
    queryKey: ['accounting-source-mappings', page, limit, sourceModule, status, deferredSearch],
    queryFn: () =>
      api.listAccountingSourceMappings({
        page,
        limit,
        sourceModule,
        status: status === 'ALL' ? undefined : status,
        search: deferredSearch || undefined,
      }),
  });
  const healthQuery = useQuery({
    queryKey: ['accounting-source-mapping-health'],
    queryFn: () => api.getAccountingSourceMappingHealth(),
    staleTime: 60_000,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<AccountingSourceMappingSummary | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  const accountsQuery = useQuery({
    queryKey: ['chart-accounts', 'source-mapping-editor'],
    queryFn: () => api.listChartAccounts(),
    enabled: createOpen,
  });

  const createMutation = useMutation({
    mutationFn: api.createAccountingSourceMapping,
    onSuccess: () => {
      void invalidateSourceMappingQueries(queryClient);
      setCreateOpen(false);
      setForm(emptyForm());
      setFormError(null);
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The source mapping could not be saved. Review the fields and try again.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.archiveAccountingSourceMapping(id, reason),
    onSuccess: () => {
      void invalidateSourceMappingQueries(queryClient);
      setArchiveTarget(null);
      setArchiveReason('');
    },
  });

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`${pathname}${next.size ? `?${next.toString()}` : ''}`, {
      scroll: false,
    });
  };

  const submitMapping = () => {
    setFormError(null);
    if (form.debitAccountId === form.creditAccountId) {
      setFormError('Debit and credit accounts must be different.');
      return;
    }
    try {
      const effectiveFrom = gregorianDateString(form.effectiveFromBs);
      const effectiveTo = form.effectiveToBs.trim()
        ? gregorianDateString(form.effectiveToBs)
        : undefined;
      createMutation.mutate({
        sourceModule: form.sourceModule,
        sourceType: form.sourceType.trim(),
        postingType: form.postingType.trim() || 'DEFAULT',
        debitAccountId: form.debitAccountId,
        creditAccountId: form.creditAccountId,
        description: form.description.trim() || undefined,
        effectiveFrom,
        ...(effectiveTo ? { effectiveTo } : {}),
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Enter valid BS effective dates.',
      );
    }
  };

  const mappings = mappingsQuery.data?.items ?? [];
  const total = mappingsQuery.data?.total ?? 0;
  const activeAccounts = (accountsQuery.data ?? []).filter((account) => account.isActive !== false);

  const mappingColumns: PaginatedDataTableColumn<AccountingSourceMappingSummary>[] = [
    {
      id: 'source',
      header: 'Source',
      cell: (item) => (
        <>
          <Badge variant="info">{item.sourceModule}</Badge>
          <p className="mt-2 font-bold text-slate-950">{item.sourceType}</p>
          {item.description ? <p className="mt-1 max-w-xs text-xs text-slate-500">{item.description}</p> : null}
        </>
      ),
    },
    {
      id: 'posting',
      header: 'Posting',
      cell: (item) => <span className="font-semibold text-slate-700">{item.postingType}</span>,
    },
    {
      id: 'debitAccount',
      header: 'Debit account',
      cell: (item) => <AccountCell account={item.debitAccount} />,
    },
    {
      id: 'creditAccount',
      header: 'Credit account',
      cell: (item) => <AccountCell account={item.creditAccount} />,
    },
    {
      id: 'effectivePeriod',
      header: 'Effective period',
      cell: (item) => (
        <div className="text-xs text-slate-600">
          <p>{formatBsDate(item.effectiveFrom)}</p>
          <p className="mt-1">to {item.effectiveTo ? formatBsDate(item.effectiveTo) : 'open-ended'}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (item) => <Badge variant={item.isActive ? 'success' : 'neutral'}>{item.isActive ? 'Active' : 'Archived'}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Waypoints className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-950">Source posting mappings</h2>
              <p className="mt-1 text-sm text-slate-600">
                Effective-dated debit and credit configuration for approved SchoolOS source modules.
              </p>
            </div>
          </div>
        </div>
        {canManage ? (
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add source mapping
          </Button>
        ) : (
          <Badge variant="neutral">Read-only access</Badge>
        )}
      </div>

      {healthQuery.isLoading ? (
        <PageState
          tone="loading"
          title="Checking posting health"
          description="Reviewing a bounded sample of posted source journals and active mappings."
          className="min-h-40"
        />
      ) : healthQuery.isError ? (
        <PageState
          tone="warning"
          title="Posting health is temporarily unavailable"
          description="Mappings can still be reviewed. Retry the health check before approving source-posting changes."
          actionLabel="Retry health check"
          onAction={() => void healthQuery.refetch()}
          className="min-h-40"
        />
      ) : healthQuery.data ? (
        <SectionCard
          title="Finance Posting Health"
          description={`Checked ${formatBsDateTime(healthQuery.data.checkedAt)} against up to ${healthQuery.data.sampleLimit} recent source postings.`}
        >
          <div className="grid gap-4 md:grid-cols-3">
            <HealthMetric label="Sampled posted entries" value={healthQuery.data.sampledPostedSourceEntries} tone="neutral" />
            <HealthMetric label="Missing source references" value={healthQuery.data.missingSourceId.count} tone={healthQuery.data.missingSourceId.count > 0 ? 'danger' : 'success'} />
            <HealthMetric label="Overall sample status" value={healthQuery.data.isClean ? 'No sampled issues' : 'Needs review'} tone={healthQuery.data.isClean ? 'success' : 'warning'} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {healthQuery.data.modules.map((module) => (
              <div key={module.sourceModule} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-600">{module.sourceModule}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {module.configuredMappingCount} active mapping(s)
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {module.postedCount} sampled posting(s) · {module.missingSourceIdCount} missing source reference(s)
                </p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            This health check is bounded and does not prove end-to-end posting readiness. Source posting, reversal, fiscal-lock, and pilot evidence must still pass for each module.
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title="Mapping registry" description="Search and review tenant-scoped mapping versions. Archived versions remain visible for audit history.">
        <div className="grid gap-3 border-b border-slate-100 pb-5 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <FormField label="Search mappings">
            <Input
              value={search}
              onChange={(event) => updateFilters({ search: event.target.value, page: undefined })}
              placeholder="Source type, posting type, or description"
            />
          </FormField>
          <FormField label="Source module">
            <Select
              value={sourceModule ?? 'ALL'}
              onChange={(event) => updateFilters({ sourceModule: event.target.value === 'ALL' ? undefined : event.target.value, page: undefined })}
            >
              <option value="ALL">All modules</option>
              {sourceModules.map((module) => <option key={module} value={module}>{module}</option>)}
            </Select>
          </FormField>
          <FormField label="Lifecycle status">
            <Select
              value={status}
              onChange={(event) => updateFilters({ status: event.target.value === 'ALL' ? undefined : event.target.value, page: undefined })}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </FormField>
        </div>

        <PaginatedDataTable
          columns={mappingColumns}
          items={mappings}
          getRowId={(item) => item.id}
          status={mappingsQuery.isError ? 'error' : mappingsQuery.isLoading ? 'loading' : 'ready'}
          page={page}
          pageSize={limit}
          totalItems={total}
          onPageChange={(nextPage) => updateFilters({ page: String(nextPage) })}
          onRetry={() => void mappingsQuery.refetch()}
          errorMessage="Your filters have been preserved. Retry when the accounting service is available."
          emptyTitle="No source mappings match these filters"
          emptyDescription="Clear the filters or add a reviewed, effective-dated mapping if you have accounting settings permission."
          className="mt-5"
          rowActions={(item) =>
            item.isActive && canManage ? (
              <Button type="button" size="sm" variant="outline" onClick={() => { setArchiveTarget(item); setArchiveReason(''); }}>
                Archive
              </Button>
            ) : (
              <span className="text-slate-400">—</span>
            )
          }
        />
      </SectionCard>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="source-mapping-title">
          <div className="my-8 w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="source-mapping-title" className="text-xl font-black text-slate-950">Add source mapping</h3>
            <p className="mt-2 text-sm text-slate-600">Create a reviewed effective-dated mapping. Existing overlapping mappings are rejected by the backend.</p>
            {accountsQuery.isError ? (
              <PageState tone="danger" title="Chart accounts could not be loaded" actionLabel="Retry" onAction={() => void accountsQuery.refetch()} className="mt-5 min-h-40" />
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <FormField label="Source module"><Select value={form.sourceModule} onChange={(event) => setForm((current) => ({ ...current, sourceModule: event.target.value as SourceModule }))}>{sourceModules.map((module) => <option key={module} value={module}>{module}</option>)}</Select></FormField>
                <FormField label="Source event / type"><Input value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))} placeholder="PAYROLL_RUN" /></FormField>
                <FormField label="Posting type"><Input value={form.postingType} onChange={(event) => setForm((current) => ({ ...current, postingType: event.target.value }))} placeholder="APPROVAL" /></FormField>
                <FormField label="Description"><Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></FormField>
                <FormField label="Debit account"><Select value={form.debitAccountId} onChange={(event) => setForm((current) => ({ ...current, debitAccountId: event.target.value }))}><option value="">Select debit account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</Select></FormField>
                <FormField label="Credit account"><Select value={form.creditAccountId} onChange={(event) => setForm((current) => ({ ...current, creditAccountId: event.target.value }))}><option value="">Select credit account</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</Select></FormField>
                <BsDateField label="Effective from (BS)" value={form.effectiveFromBs} onChange={(value) => setForm((current) => ({ ...current, effectiveFromBs: value }))} required />
                <BsDateField label="Effective to (BS, optional)" value={form.effectiveToBs} onChange={(value) => setForm((current) => ({ ...current, effectiveToBs: value }))} />
              </div>
            )}
            {formError ? <p className="mt-4 text-sm font-semibold text-rose-700" role="alert">{formError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); setFormError(null); }}>Cancel</Button>
              <Button type="button" isLoading={createMutation.isPending} disabled={accountsQuery.isLoading || !form.sourceType.trim() || !form.debitAccountId || !form.creditAccountId || !form.effectiveFromBs.trim()} onClick={submitMapping}>Save mapping</Button>
            </div>
          </div>
        </div>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="archive-mapping-title">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" /><div><h3 id="archive-mapping-title" className="text-lg font-black text-slate-950">Archive source mapping?</h3><p className="mt-2 text-sm text-slate-600">This closes the active mapping version. Posted journals remain unchanged.</p></div></div>
            <FormField label="Reason" className="mt-5"><Input value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Why is this mapping being archived?" /></FormField>
            {archiveMutation.isError ? <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{archiveMutation.error instanceof Error ? archiveMutation.error.message : 'The mapping could not be archived.'}</p> : null}
            <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setArchiveTarget(null)}>Cancel</Button><Button type="button" variant="destructive" isLoading={archiveMutation.isPending} disabled={archiveReason.trim().length < 3} onClick={() => archiveMutation.mutate({ id: archiveTarget.id, reason: archiveReason.trim() })}>Archive mapping</Button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HealthMetric({ label, value, tone }: { label: string; value: string | number; tone: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const classes = tone === 'success' ? 'border-emerald-200 bg-emerald-50' : tone === 'warning' ? 'border-amber-200 bg-amber-50' : tone === 'danger' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50';
  return <div className={`rounded-xl border p-4 ${classes}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{value}</p></div>;
}

function AccountCell({ account }: { account: AccountingSourceMappingSummary['debitAccount'] }) {
  return (
    <>
      <p className="font-mono text-xs font-bold text-slate-500">{account.code}</p>
      <p className="mt-1 font-semibold text-slate-900">{account.name}</p>
      {account.isActive === false ? <Badge variant="warning" className="mt-2">Inactive account</Badge> : null}
    </>
  );
}

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}

function invalidateSourceMappingQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['accounting-source-mappings'] }),
    queryClient.invalidateQueries({ queryKey: ['accounting-source-mapping-health'] }),
    queryClient.invalidateQueries({ queryKey: ['accounting-dashboard-summary'] }),
  ]);
}

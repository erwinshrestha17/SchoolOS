'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { ReportTable } from './report-table';
import { Select } from '../ui/select';
import { Search, History, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';

export function AccountingAuditWorkspace() {
  const [resourceFilter, setResourceFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const query = useQuery({
    queryKey: ['accounting-audit-trail', resourceFilter, actionFilter, page],
    queryFn: () =>
      api.getAccountingAuditTrail({
        resource: resourceFilter || undefined,
        action: actionFilter || undefined,
        page,
        limit: 50,
      }),
  });

  const records = query.data?.items ?? [];
  const activeFilterLabel =
    [resourceFilter || null, actionFilter || null]
      .filter(Boolean)
      .join(' / ') || 'All accounting events';

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionCard
        title="Accounting Audit Trail"
        description="Immutable record of all changes to accounting entities, ledgers, and configurations."
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <AuditSummaryCard label="Records on page" value={records.length} />
          <AuditSummaryCard label="Page" value={page} />
          <AuditSummaryCard label="Filter" value={activeFilterLabel} />
        </div>

        <div className="mb-6 flex flex-col gap-4 md:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Select
              value={resourceFilter}
              onChange={(e) => {
                setResourceFilter(e.target.value);
                setPage(1);
              }}
              className="pl-10 w-full"
            >
              <option value="">All Resources</option>
              <option value="journal_entry">Journal Entry</option>
              <option value="chart_account">Chart Account</option>
              <option value="accounting_period">Accounting Period</option>
              <option value="fiscal_year">Fiscal Year</option>
              <option value="bank_statement">Bank Statement</option>
              <option value="voucher">Voucher</option>
            </Select>
          </div>
          <div className="flex-1">
            <Select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="post">Post</option>
              <option value="reconcile">Reconcile</option>
              <option value="close">Close</option>
            </Select>
          </div>
        </div>

        {query.isLoading ? (
          <LoadingState variant="skeleton" label="Loading audit trail..." />
        ) : query.data?.items.length === 0 ? (
          <EmptyState
            title="No audit records"
            description="No accounting audit logs match your current filters."
            icon={<History size={32} />}
          />
        ) : (
          <div className="space-y-4">
            <ReportTable
              headers={[
                'Timestamp',
                'Action',
                'Resource',
                'Actor ID',
                'Details',
              ]}
              rows={(query.data?.items ?? []).map((log: any) => ({
                id: log.id,
                cells: [
                  {
                    value: new Date(log.createdAt).toLocaleString(),
                    type: 'date',
                  },
                  {
                    value: log.action.toUpperCase(),
                    bold: true,
                    className:
                      log.action === 'create'
                        ? 'text-emerald-600'
                        : log.action === 'delete'
                          ? 'text-rose-600'
                          : 'text-[var(--color-mod-accounting-accent)]',
                  },
                  { value: `${log.resource} (${log.resourceId || 'Resource ID not recorded'})` },
                  { value: log.userId || 'System actor' },
                  {
                    value: (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200"
                      >
                        <Eye size={12} />
                        View Diff
                      </button>
                    ),
                  },
                ],
              }))}
            />

            <div className="flex items-center justify-between px-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span
                className="text-sm font-bold text-slate-500"
                data-testid="accounting-audit-page-summary"
              >
                Page {page} / {records.length} records
              </span>
              <button
                disabled={!query.data?.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <AuditDetailField
                  label="Action"
                  value={selectedLog.action.toUpperCase()}
                />
                <AuditDetailField
                  label="Resource"
                  value={selectedLog.resource}
                />
                <AuditDetailField
                  label="Resource ID"
                  value={selectedLog.resourceId || 'Resource ID not recorded'}
                />
                <AuditDetailField
                  label="Actor ID"
                  value={selectedLog.userId || 'System actor'}
                />
                <AuditDetailField
                  label="Timestamp"
                  value={new Date(selectedLog.createdAt).toLocaleString()}
                />
                <AuditDetailField
                  label="Tenant scope"
                  value={selectedLog.tenantId || 'Tenant scope not recorded'}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Before
                  </label>
                  <div className="max-h-60 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[10px]">
                    <pre>
                      {selectedLog.before
                        ? JSON.stringify(selectedLog.before, null, 2)
                        : 'No previous value recorded'}
                    </pre>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    After
                  </label>
                  <div className="max-h-60 overflow-auto rounded-2xl border border-slate-100 bg-slate-50 p-4 text-[10px]">
                    <pre>
                      {selectedLog.after
                        ? JSON.stringify(selectedLog.after, null, 2)
                        : 'No updated value recorded'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditSummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-lg font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

function AuditDetailField({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </label>
      <p className="mt-1 break-words font-bold text-slate-900">{value}</p>
    </div>
  );
}

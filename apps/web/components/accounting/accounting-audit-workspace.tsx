'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { SectionCard } from '../ui/section-card';
import { ReportTable } from './report-table';
import { Select } from '../ui/select';
import { Search, History, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

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

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionCard
        title="Accounting Audit Trail"
        description="Immutable record of all changes to accounting entities, ledgers, and configurations."
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6">
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
          <div className="py-20 text-center text-slate-500">
            Loading audit trail...
          </div>
        ) : query.data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-[2rem] bg-slate-50 border border-dashed border-slate-200 text-center">
            <div className="h-16 w-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
              <History size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Audit Records</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">
              No audit logs match your current filters.
            </p>
          </div>
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
                          : 'text-primary-600',
                  },
                  { value: `${log.resource} (${log.resourceId || 'N/A'})` },
                  { value: log.userId || 'SYSTEM' },
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

            <div className="flex justify-between items-center px-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-bold text-slate-500">
                Page {page}
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Action
                  </label>
                  <p className="font-bold text-slate-900">
                    {selectedLog.action.toUpperCase()}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Resource
                  </label>
                  <p className="font-bold text-slate-900">
                    {selectedLog.resource}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Before
                  </label>
                  <div className="rounded-2xl bg-slate-50 p-4 font-mono text-[10px] overflow-auto max-h-60 border border-slate-100">
                    <pre>
                      {selectedLog.before
                        ? JSON.stringify(selectedLog.before, null, 2)
                        : 'N/A'}
                    </pre>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    After
                  </label>
                  <div className="rounded-2xl bg-slate-50 p-4 font-mono text-[10px] overflow-auto max-h-60 border border-slate-100">
                    <pre>
                      {selectedLog.after
                        ? JSON.stringify(selectedLog.after, null, 2)
                        : 'N/A'}
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

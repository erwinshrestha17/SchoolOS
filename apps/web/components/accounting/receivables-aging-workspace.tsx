'use client';

import { useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import {
  formatBsDate,
  getNepalSchoolDay,
  RECEIVABLES_AGING_BUCKET_LABELS,
  RECEIVABLES_AGING_BUCKETS,
  type ReceivablesAgingBucket,
  type ReceivablesAgingResponse,
  type ReceivablesReconciliationResponse,
} from '@schoolos/core';
import { Surface } from '@/components/schoolos';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';
import { useSession } from '../session-provider';
import { MoneyDisplay } from '../ui/money-display';
import { PermissionDenied } from '../ui/permission-denied';
import { SearchInput } from '../ui/search-input';
import { StatusBadge } from '../ui/status-badge';

/**
 * Phase 7.11b (ASTRA M11-G): receivables, aging first. Every figure comes
 * from the server's single aging definition (Nepal school day, allocation
 * basis); the page never adds or ages money itself. Read-only.
 */
const PAGE_SIZE = 25;

type AgingRow = ReceivablesAgingResponse['rows'][number];

export function ReceivablesAgingWorkspace() {
  const { hasPermissions } = useSession();
  const canRead = hasPermissions([
    'accounting:reports:read',
    'accounting:read',
  ]);
  const today = getNepalSchoolDay(new Date()).gregorianDate;
  const [asOfDate, setAsOfDate] = useState(today);
  const [bucket, setBucket] = useState<ReceivablesAgingBucket | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const agingQuery = useQuery({
    queryKey: ['receivables-aging', asOfDate, bucket, search, page],
    queryFn: () =>
      api.getReceivablesAging({
        asOfDate,
        ...(bucket ? { bucket } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canRead,
  });
  const reconciliationQuery = useQuery({
    queryKey: ['receivables-reconciliation', asOfDate],
    queryFn: () => api.getReceivablesReconciliation({ asOfDate }),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <PermissionDenied
        title="Receivables are restricted"
        description="You need accounting report access to see receivables aging."
      />
    );
  }

  const data = agingQuery.data;
  const columns: PaginatedDataTableColumn<AgingRow>[] = [
    {
      id: 'student',
      header: 'Student',
      cell: (row) => (
        <div>
          <Link
            href={row.ledgerHref}
            className="font-semibold text-slate-900 hover:underline"
          >
            {row.studentName}
          </Link>
          <div className="text-xs text-slate-500">
            {row.studentSystemId} · {row.className}
            {row.sectionName ? ` ${row.sectionName}` : ''}
          </div>
        </div>
      ),
    },
    { id: 'invoice', header: 'Invoice', cell: (row) => row.invoiceNumber },
    {
      id: 'due',
      header: 'Due (BS)',
      cell: (row) => formatBsDate(row.dueDate),
      hideBelow: 'md',
    },
    {
      id: 'bucket',
      header: 'Aging',
      cell: (row) => (
        <StatusBadge tone={row.bucket === 'CURRENT' ? 'unpaid' : 'overdue'}>
          {RECEIVABLES_AGING_BUCKET_LABELS[row.bucket]}
        </StatusBadge>
      ),
    },
    {
      id: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => <MoneyDisplay amount={row.outstanding} />,
    },
  ];

  return (
    <div className="space-y-6" data-testid="receivables-aging-workspace">
      <Surface
        title="Receivables aging"
        description="Student fee balances by how long they are overdue, from the official ledger basis. Received amounts are allocations active on the day; invoice totals are current."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            As of
            <input
              type="date"
              value={asOfDate}
              max={today}
              onChange={(event) => {
                setAsOfDate(event.target.value || today);
                setPage(1);
              }}
              className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
              aria-label="As of date"
            />
            <span className="text-xs text-slate-500">
              {formatBsDate(asOfDate)} BS
            </span>
          </label>
        }
      >
        {agingQuery.isError ? (
          <p className="text-sm text-slate-600">
            Receivables could not be loaded. Retry, or check your accounting
            access.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {RECEIVABLES_AGING_BUCKETS.map((key) => {
                const total = data?.totals.buckets.find(
                  (entry) => entry.bucket === key,
                );
                const active = bucket === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setBucket(active ? null : key);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-left transition',
                      active
                        ? 'border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)]'
                        : 'border-[var(--line)] bg-white hover:bg-slate-50',
                    )}
                  >
                    <span className="block text-xs font-semibold text-slate-500">
                      {RECEIVABLES_AGING_BUCKET_LABELS[key]}
                    </span>
                    <span className="mt-1 block text-lg font-bold text-slate-900">
                      <MoneyDisplay amount={total?.outstanding ?? '0'} />
                    </span>
                    <span className="block text-xs text-slate-500">
                      {total?.invoiceCount ?? 0} invoices ·{' '}
                      {total?.studentCount ?? 0} students
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-slate-600">
              <span>
                Total outstanding{' '}
                <strong>
                  <MoneyDisplay amount={data?.totals.totalOutstanding ?? '0'} />
                </strong>
              </span>
              <span>
                Overdue{' '}
                <strong>
                  <MoneyDisplay
                    amount={data?.totals.overdueOutstanding ?? '0'}
                  />
                </strong>
              </span>
              <span>
                Unapplied advances held{' '}
                <strong>
                  <MoneyDisplay amount={data?.advancesHeld ?? '0'} />
                </strong>{' '}
                (a credit, not netted against any invoice)
              </span>
            </div>
          </div>
        )}
      </Surface>

      <ReconciliationPanel query={reconciliationQuery} />

      <Surface title="By class">
        {(data?.byClass ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No outstanding balances.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Class</th>
                <th className="text-right">Invoices</th>
                <th className="text-right">Students</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.byClass ?? []).map((entry) => (
                <tr key={entry.classId ?? entry.className}>
                  <td className="py-2 font-semibold text-slate-900">
                    {entry.className}
                  </td>
                  <td className="text-right">{entry.invoiceCount}</td>
                  <td className="text-right">{entry.studentCount}</td>
                  <td className="text-right">
                    <MoneyDisplay amount={entry.overdueOutstanding} />
                  </td>
                  <td className="text-right">
                    <MoneyDisplay amount={entry.outstanding} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>

      <Surface
        title={
          bucket
            ? `Invoices: ${RECEIVABLES_AGING_BUCKET_LABELS[bucket]}`
            : 'Invoices with a balance'
        }
      >
        <div className="mb-3 md:w-80">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search student, ID or invoice"
          />
        </div>
        <PaginatedDataTable
          columns={columns}
          items={data?.rows ?? []}
          getRowId={(row) => row.invoiceId}
          status={
            agingQuery.isLoading
              ? 'loading'
              : agingQuery.isError
                ? 'error'
                : 'ready'
          }
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={data?.pagination.total ?? 0}
          onPageChange={setPage}
          hasActiveFilters={Boolean(bucket || search.trim())}
          emptyTitle="No outstanding balances"
          emptyDescription="Every invoice issued by this date is settled."
          onRetry={() => void agingQuery.refetch()}
        />
      </Surface>
    </div>
  );
}

function ReconciliationPanel({
  query,
}: {
  query: UseQueryResult<ReceivablesReconciliationResponse>;
}) {
  const recon = query.data;
  return (
    <Surface
      title="Receivables vs ledger"
      description="The fee subledger (invoices minus what was received) compared with the receivable control account in the general ledger."
      data-testid="receivables-reconciliation"
    >
      {query.isLoading ? (
        <p className="text-sm text-slate-500">Comparing with the ledger…</p>
      ) : query.isError || !recon ? (
        <p className="text-sm text-slate-600">
          The comparison could not be loaded.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            <StatusBadge
              tone={
                recon.isReconciled
                  ? 'approved'
                  : recon.isFullyExplained
                    ? 'pending'
                    : 'rejected'
              }
            >
              {recon.isReconciled
                ? 'Matches the ledger'
                : recon.isFullyExplained
                  ? 'Difference explained'
                  : 'Unexplained difference'}
            </StatusBadge>
            <span>
              Subledger <MoneyDisplay amount={recon.subledgerTotal} />
            </span>
            <span>
              Ledger ({recon.controlAccounts.map((a) => a.code).join(', ')}){' '}
              <MoneyDisplay amount={recon.ledgerBalance} />
            </span>
            <span>
              Difference <MoneyDisplay amount={recon.difference} />
            </span>
          </div>
          {recon.items.length > 0 ? (
            <ul className="divide-y divide-slate-100 rounded-xl border border-[var(--line)]">
              {recon.items.map((item) => (
                <li
                  key={item.cause}
                  className="flex flex-wrap justify-between gap-2 px-3 py-2"
                >
                  <span className="text-slate-700">
                    {item.label} ({item.count})
                  </span>
                  <MoneyDisplay amount={item.effect} />
                </li>
              ))}
            </ul>
          ) : null}
          {!recon.isFullyExplained ? (
            <p className="text-slate-600">
              Unexplained <MoneyDisplay amount={recon.unexplained} />. Review
              journals posted to the receivable account.
            </p>
          ) : null}
        </div>
      )}
    </Surface>
  );
}

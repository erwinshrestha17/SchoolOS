'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  formatBsDate,
  formatBsDateForInput,
  getNepalSchoolDay,
  parseBsDateInput,
  RECEIVABLES_AGING_BUCKET_LABELS,
  RECEIVABLES_AGING_BUCKETS,
  toGregorianDateFromBs,
  type FinanceVendorView,
  type PayablesSetup,
  type ReceivablesAgingBucket,
  type VendorBillView,
} from '@schoolos/core';
import { Surface } from '@/components/schoolos';
import { api } from '../../lib/api';
import { resourceAccess } from '../../lib/resource-authorization';
import { cn } from '../../lib/utils';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';
import { useSession } from '../session-provider';
import { BsDateField } from '../ui/bs-date-field';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { FormField, Input, Select } from '../ui/form-field';
import { MoneyDisplay } from '../ui/money-display';
import { PermissionDenied } from '../ui/permission-denied';
import { ReasonDialog } from '../ui/reason-dialog';
import { SearchInput } from '../ui/search-input';
import { StatusBadge } from '../ui/status-badge';
import { Toast } from '../ui/toast';

/**
 * Phase 7.11c (ASTRA M11): Expenses & Payables. Every figure, balance and
 * aging bucket comes from the server; actions follow each record's
 * authorization projection. Tax amounts are typed from the vendor bill: the
 * page never computes VAT, TDS or any total.
 */
const PAGE_SIZE = 25;
const MONEY = /^\d{1,13}(\.\d{1,2})?$/;
const TAX_NOTE =
  'Tax amounts come from the bill and are not computed by SchoolOS.';

type View = 'payables' | 'expenses' | 'vendors';
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'payables', label: 'Payables' },
  { id: 'expenses', label: 'Vendor bills' },
  { id: 'vendors', label: 'Vendors' },
];

function bsToGregorian(value: string): string {
  const date = toGregorianDateFromBs(parseBsDateInput(value.trim()));
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PayablesWorkspace() {
  const { hasPermissions } = useSession();
  const params = useSearchParams();
  const canPayables = hasPermissions(['accounting:payables:read']);
  const canBills = hasPermissions(['accounting:expenses:read']);
  const canVendors = hasPermissions(['accounting:vendors:read']);
  const requested = params.get('view');
  const initial: View =
    requested === 'expenses' || requested === 'vendors'
      ? requested
      : 'payables';
  const [view, setView] = useState<View>(initial);
  const [toast, setToast] = useState<{
    tone: 'success' | 'danger';
    title: string;
  } | null>(null);

  const setupQuery = useQuery({
    queryKey: ['payables-setup'],
    queryFn: api.getPayablesSetup,
    enabled: canPayables,
  });

  if (!canPayables && !canBills && !canVendors) {
    return (
      <PermissionDenied
        title="Payables are restricted"
        description="You need vendor, bill or payable access to use Expenses & Payables."
      />
    );
  }

  const allowed: Record<View, boolean> = {
    payables: canPayables,
    expenses: canBills,
    vendors: canVendors,
  };
  const current = allowed[view]
    ? view
    : (VIEWS.find((item) => allowed[item.id])?.id ?? 'payables');
  const notify = (tone: 'success' | 'danger', title: string) =>
    setToast({ tone, title });

  return (
    <div className="space-y-6" data-testid="payables-workspace">
      {toast ? (
        <Toast
          tone={toast.tone}
          title={toast.title}
          onDismiss={() => setToast(null)}
        />
      ) : null}
      <SetupPanel query={setupQuery} />
      <div
        role="tablist"
        aria-label="Payables views"
        className="flex flex-wrap gap-2"
      >
        {VIEWS.filter((item) => allowed[item.id]).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={current === item.id}
            onClick={() => setView(item.id)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition',
              current === item.id
                ? 'border-[var(--color-mod-accounting-border)] bg-[var(--color-mod-accounting-bg)] text-slate-900'
                : 'border-[var(--line)] bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {current === 'payables' ? (
        <PayablesView
          setup={setupQuery.data}
          focusPayableId={params.get('payableId')}
          notify={notify}
        />
      ) : null}
      {current === 'expenses' ? (
        <BillsView
          setup={setupQuery.data}
          focusBillId={params.get('expenseId')}
          notify={notify}
        />
      ) : null}
      {current === 'vendors' ? <VendorsView notify={notify} /> : null}
    </div>
  );
}

// ─── Setup ───────────────────────────────────────────────────────────

function SetupPanel({ query }: { query: UseQueryResult<PayablesSetup> }) {
  const setup = query.data;
  if (!setup || setup.ready) return null;
  const state = setup.accountsPayable.state;
  return (
    <Surface
      title="Accounts Payable is not set up"
      description="Bills cannot be approved until the school maps exactly one liability account as Accounts Payable. SchoolOS never creates this account for you."
      data-testid="payables-setup"
    >
      <p className="text-sm text-slate-600">
        {state === 'AMBIGUOUS'
          ? 'More than one account is mapped as Accounts Payable. Keep exactly one.'
          : state === 'INVALID'
            ? 'The mapped Accounts Payable account is inactive or is not a liability account.'
            : 'No account is mapped as Accounts Payable yet.'}{' '}
        An accounting administrator can map it below.
      </p>
      <AccountsPayableMappingForm />
    </Surface>
  );
}

function AccountsPayableMappingForm() {
  const { hasPermissions } = useSession();
  const canMap = hasPermissions([
    'accounting:settings:update',
    'accounting:accounts:read',
  ]);
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const accountsQuery = useQuery({
    queryKey: ['payables-liability-accounts'],
    queryFn: api.listChartAccounts,
    enabled: canMap,
  });
  const liabilities = (accountsQuery.data ?? []).filter(
    (account) => account.type === 'LIABILITY' && account.isActive !== false,
  );
  const mutation = useMutation({
    mutationFn: async () => {
      // The settings endpoint replaces the whole mapping set: keep the others.
      const existing = await api.getReportAccountMappings();
      const others = existing
        .filter((mapping) => mapping.mappingType !== 'ACCOUNTS_PAYABLE')
        .map(({ mappingType, accountId: id }) => ({
          mappingType,
          accountId: id,
        }));
      return api.updateReportAccountMappings([
        ...others,
        { mappingType: 'ACCOUNTS_PAYABLE', accountId },
      ]);
    },
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['payables-setup'] });
    },
    onError: (err) =>
      setError(errorText(err, 'The mapping could not be saved.')),
  });
  if (!canMap) return null;
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (accountId) mutation.mutate();
      }}
    >
      <FormField label="Accounts Payable account" className="min-w-64">
        <Select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          required
        >
          <option value="">Choose a liability account</option>
          {liabilities.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} · {account.name}
            </option>
          ))}
        </Select>
      </FormField>
      <Button type="submit" size="sm" isLoading={mutation.isPending}>
        Map Accounts Payable
      </Button>
      {error ? (
        <p className="w-full text-sm font-semibold text-rose-700">{error}</p>
      ) : null}
    </form>
  );
}

// ─── Payables (aging first) ──────────────────────────────────────────

function PayablesView({
  setup,
  focusPayableId,
  notify,
}: {
  setup: PayablesSetup | undefined;
  focusPayableId: string | null;
  notify: (tone: 'success' | 'danger', title: string) => void;
}) {
  const today = getNepalSchoolDay(new Date()).gregorianDate;
  const [asOfDate, setAsOfDate] = useState(today);
  const [bucket, setBucket] = useState<ReceivablesAgingBucket | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openPayableId, setOpenPayableId] = useState<string | null>(
    focusPayableId,
  );

  const agingQuery = useQuery({
    queryKey: ['payables-aging', asOfDate, bucket, search, page],
    queryFn: () =>
      api.getPayablesAging({
        asOfDate,
        ...(bucket ? { bucket } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        page,
        limit: PAGE_SIZE,
      }),
  });
  const data = agingQuery.data;
  type Row = NonNullable<typeof data>['rows'][number];
  const columns: PaginatedDataTableColumn<Row>[] = [
    {
      id: 'payable',
      header: 'Payable',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900">
            {row.payableNumber}
          </span>
          <div className="text-xs text-slate-500">
            {row.billNumber}
            {row.vendorBillNumber ? ` · bill ${row.vendorBillNumber}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'vendor',
      header: 'Vendor',
      cell: (row) => row.vendor?.displayName ?? '—',
    },
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
    <div className="space-y-6">
      <Surface
        title="Payables aging"
        description="What the school owes vendors, by how long it is overdue, as of a Nepal school day. Payments and reversals count from their accounting dates."
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
            Payables could not be loaded. Retry, or check your access.
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
                      {total?.payableCount ?? 0} payables ·{' '}
                      {total?.vendorCount ?? 0} vendors
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <span>
                Total owed{' '}
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
              {data?.ledger ? (
                <StatusBadge
                  tone={data.ledger.matches ? 'approved' : 'rejected'}
                >
                  {data.ledger.matches
                    ? `Matches ledger ${data.ledger.account.code}`
                    : `Differs from ledger ${data.ledger.account.code} by NPR ${data.ledger.difference}`}
                </StatusBadge>
              ) : null}
            </div>
          </div>
        )}
      </Surface>

      <Surface title="By vendor">
        {(data?.byVendor ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Nothing is owed.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Vendor</th>
                <th className="text-right">Payables</th>
                <th className="text-right">Overdue</th>
                <th className="text-right">Owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.byVendor ?? []).map((entry) => (
                <tr key={entry.vendor?.id ?? 'none'}>
                  <td className="py-2 font-semibold text-slate-900">
                    {entry.vendor?.displayName ?? 'No vendor'}
                    {entry.vendor?.panNumber ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        PAN {entry.vendor.panNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right">{entry.payableCount}</td>
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
            ? `Payables: ${RECEIVABLES_AGING_BUCKET_LABELS[bucket]}`
            : 'Payables with a balance'
        }
      >
        <div className="mb-3 md:w-80">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search vendor, payable or bill number"
          />
        </div>
        <PaginatedDataTable
          columns={columns}
          items={data?.rows ?? []}
          getRowId={(row) => row.payableId}
          onRowClick={(row) => setOpenPayableId(row.payableId)}
          getRowActionLabel={(row) => `Open payable ${row.payableNumber}`}
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
          emptyTitle="Nothing owed"
          emptyDescription="Every posted vendor bill is paid as of this day."
          onRetry={() => void agingQuery.refetch()}
        />
      </Surface>

      {openPayableId ? (
        <PayableDetailDialog
          payableId={openPayableId}
          setup={setup}
          onClose={() => setOpenPayableId(null)}
          notify={notify}
        />
      ) : null}
    </div>
  );
}

function PayableDetailDialog({
  payableId,
  setup,
  onClose,
  notify,
}: {
  payableId: string;
  setup: PayablesSetup | undefined;
  onClose: () => void;
  notify: (tone: 'success' | 'danger', title: string) => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['payable-detail', payableId],
    queryFn: () => api.getPayable(payableId),
  });
  const [reverseId, setReverseId] = useState<string | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['payable-detail'] });
    void queryClient.invalidateQueries({ queryKey: ['payables-aging'] });
    void queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
  };
  const reverseMutation = useMutation({
    mutationFn: (reason: string) =>
      api.reversePayableSettlement(reverseId ?? '', { reason }),
    onSuccess: () => {
      setReverseId(null);
      refresh();
      notify('success', 'Payment reversed. The balance is owed again.');
    },
    onError: (error) =>
      notify('danger', errorText(error, 'The payment could not be reversed.')),
  });
  const payable = detailQuery.data;
  const access = resourceAccess<'settle', 'settlements'>(
    payable?.authorization,
  );

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {payable ? `Payable ${payable.payableNumber}` : 'Payable'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-6 pb-6">
          {detailQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !payable ? (
            <p className="text-sm text-slate-600">
              This payable could not be loaded.
            </p>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Vendor</dt>
                  <dd className="font-semibold">
                    {payable.vendor?.displayName ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Bill</dt>
                  <dd>
                    {payable.bill.expenseNumber}
                    {payable.bill.vendorBillNumber
                      ? ` · ${payable.bill.vendorBillNumber}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Due (BS)</dt>
                  <dd>{formatBsDate(payable.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd>
                    <StatusBadge status={payable.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Original</dt>
                  <dd>
                    <MoneyDisplay amount={payable.originalAmount} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Outstanding</dt>
                  <dd className="font-semibold">
                    <MoneyDisplay amount={payable.outstandingAmount} />
                  </dd>
                </div>
              </dl>

              <section aria-label="Payments">
                <h3 className="mb-2 text-sm font-bold text-slate-900">
                  Payments
                </h3>
                {payable.settlements.length === 0 ? (
                  <p className="text-sm text-slate-500">No payments yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-[var(--line)]">
                    {payable.settlements.map((settlement) => {
                      const settlementAccess = resourceAccess<
                        'reverse',
                        'amounts'
                      >(settlement.authorization);
                      return (
                        <li
                          key={settlement.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <div>
                            <div className="font-semibold">
                              {settlement.reversalOfId ? 'Reversal' : 'Payment'}{' '}
                              · {formatBsDate(settlement.settledAt)} BS
                            </div>
                            <div className="text-xs text-slate-500">
                              {settlement.paymentAccount.code}{' '}
                              {settlement.paymentAccount.name}
                              {settlement.paymentReference
                                ? ` · ${settlement.paymentReference}`
                                : ''}
                              {settlement.paidBy
                                ? ` · by ${settlement.paidBy.name}`
                                : ''}
                              {settlement.reversalReason
                                ? ` · ${settlement.reversalReason}`
                                : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <div>
                              <MoneyDisplay amount={settlement.amount} />
                              {settlement.withheldTaxAmount !== '0.00' ? (
                                <div className="text-xs text-slate-500">
                                  Cash {settlement.cashAmount} · tax withheld{' '}
                                  {settlement.withheldTaxAmount}
                                </div>
                              ) : null}
                            </div>
                            {settlementAccess.can('reverse') ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setReverseId(settlement.id)}
                              >
                                Reverse
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {access.can('settle') ? (
                <SettleForm
                  payableId={payable.id}
                  outstanding={payable.outstandingAmount}
                  setup={setup}
                  onDone={() => {
                    refresh();
                    notify('success', 'Payment recorded and posted.');
                  }}
                  onError={(message) => notify('danger', message)}
                />
              ) : null}
            </>
          )}
        </div>
        <DialogFooter className="px-6 pb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
      <ReasonDialog
        isOpen={reverseId !== null}
        title="Reverse this payment?"
        description="The payment journal is reversed today and the amount is owed to the vendor again."
        confirmLabel="Reverse payment"
        isConfirming={reverseMutation.isPending}
        onConfirm={(reason) => reverseMutation.mutate(reason)}
        onClose={() => setReverseId(null)}
      />
    </Dialog>
  );
}

function SettleForm({
  payableId,
  outstanding,
  setup,
  onDone,
  onError,
}: {
  payableId: string;
  outstanding: string;
  setup: PayablesSetup | undefined;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState(outstanding);
  const [withheld, setWithheld] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [settledOnBs, setSettledOnBs] = useState(() =>
    formatBsDateForInput(new Date()),
  );
  const [reference, setReference] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  // One key per intended payment: a double click or retry cannot pay twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);
  const mutation = useMutation({
    mutationFn: (settledAt: string) =>
      api.settlePayable(payableId, {
        idempotencyKey,
        amount: amount.trim(),
        ...(withheld.trim() ? { withheldTaxAmount: withheld.trim() } : {}),
        paymentAccountId,
        settledAt,
        ...(reference.trim() ? { paymentReference: reference.trim() } : {}),
      }),
    onSuccess: () => {
      setIdempotencyKey(newKey());
      setWithheld('');
      setReference('');
      onDone();
    },
    onError: (error) =>
      onError(errorText(error, 'The payment could not be recorded.')),
  });
  const accounts = setup?.paymentAccounts ?? [];

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--line)] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setProblem(null);
        if (!MONEY.test(amount.trim()))
          return setProblem('Enter the amount in NPR, e.g. 1500.00');
        if (withheld.trim() && !MONEY.test(withheld.trim()))
          return setProblem('Enter the withheld tax in NPR, e.g. 22.50');
        if (!paymentAccountId)
          return setProblem('Choose a cash or bank account.');
        let settledAt: string;
        try {
          settledAt = bsToGregorian(settledOnBs);
        } catch {
          return setProblem('Enter the payment date as a BS date.');
        }
        mutation.mutate(settledAt);
      }}
    >
      <h3 className="text-sm font-bold text-slate-900">Record a payment</h3>
      <p className="text-xs text-slate-500">
        The amount clears the payable (cash paid plus tax withheld). {TAX_NOTE}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Amount cleared (NPR)">
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Tax withheld (TDS, NPR)">
          <Input
            inputMode="decimal"
            value={withheld}
            placeholder="0.00"
            onChange={(event) => setWithheld(event.target.value)}
          />
        </FormField>
        <FormField label="Paid from">
          <Select
            value={paymentAccountId}
            onChange={(event) => setPaymentAccountId(event.target.value)}
            required
          >
            <option value="">Choose a cash or bank account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} · {account.name} ({account.kind.toLowerCase()})
              </option>
            ))}
          </Select>
        </FormField>
        <BsDateField
          label="Payment date (BS)"
          value={settledOnBs}
          onChange={setSettledOnBs}
          required
        />
        <FormField label="Reference (cheque or transfer no.)">
          <Input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </FormField>
      </div>
      {problem ? (
        <p className="text-sm font-semibold text-rose-700">{problem}</p>
      ) : null}
      <Button type="submit" size="sm" isLoading={mutation.isPending}>
        Record payment
      </Button>
    </form>
  );
}

// ─── Vendor bills ────────────────────────────────────────────────────

function BillsView({
  setup,
  focusBillId,
  notify,
}: {
  setup: PayablesSetup | undefined;
  focusBillId: string | null;
  notify: (tone: 'success' | 'danger', title: string) => void;
}) {
  const { hasPermissions } = useSession();
  const canCreate = hasPermissions(['accounting:expenses:write']);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [openBillId, setOpenBillId] = useState<string | null>(focusBillId);

  const billsQuery = useQuery({
    queryKey: ['vendor-bills', status, search, page],
    queryFn: () =>
      api.listVendorBills({
        ...(status ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        page,
        limit: PAGE_SIZE,
      }),
  });
  const columns: PaginatedDataTableColumn<VendorBillView>[] = [
    {
      id: 'bill',
      header: 'Bill',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900">
            {row.expenseNumber}
          </span>
          <div className="text-xs text-slate-500">
            {row.vendor?.displayName ?? '—'}
            {row.vendorBillNumber ? ` · ${row.vendorBillNumber}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Bill date (BS)',
      cell: (row) => formatBsDate(row.expenseDate),
      hideBelow: 'md',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      cell: (row) => <MoneyDisplay amount={row.totalAmount} />,
    },
  ];

  return (
    <Surface
      title="Vendor bills"
      description={`Bills are prepared, approved by a different person, and posted to Accounts Payable on approval. ${TAX_NOTE}`}
      actions={
        canCreate ? (
          <Button
            type="button"
            size="sm"
            onClick={() => setCreating(true)}
            disabled={setup ? !setup.ready : false}
          >
            Record bill
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="md:w-80">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search bill, vendor or description"
          />
        </div>
        <Select
          aria-label="Bill status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className="w-48"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="POSTED">Posted</option>
          <option value="REVERSED">Reversed</option>
        </Select>
      </div>
      <PaginatedDataTable
        columns={columns}
        items={billsQuery.data?.items ?? []}
        getRowId={(row) => row.id}
        onRowClick={(row) => setOpenBillId(row.id)}
        getRowActionLabel={(row) => `Open bill ${row.expenseNumber}`}
        status={
          billsQuery.isLoading
            ? 'loading'
            : billsQuery.isError
              ? 'error'
              : 'ready'
        }
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={billsQuery.data?.pagination.total ?? 0}
        onPageChange={setPage}
        hasActiveFilters={Boolean(status || search.trim())}
        emptyTitle="No vendor bills"
        emptyDescription="Record a bill when the school receives one from a vendor."
        onRetry={() => void billsQuery.refetch()}
      />
      {creating ? (
        <CreateBillDialog
          setup={setup}
          onClose={() => setCreating(false)}
          onCreated={(bill) => {
            setCreating(false);
            setOpenBillId(bill.id);
            void queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
            notify('success', `Draft ${bill.expenseNumber} saved.`);
          }}
          onError={(message) => notify('danger', message)}
        />
      ) : null}
      {openBillId ? (
        <BillDetailDialog
          billId={openBillId}
          onClose={() => setOpenBillId(null)}
          notify={notify}
        />
      ) : null}
    </Surface>
  );
}

function CreateBillDialog({
  setup,
  onClose,
  onCreated,
  onError,
}: {
  setup: PayablesSetup | undefined;
  onClose: () => void;
  onCreated: (bill: VendorBillView) => void;
  onError: (message: string) => void;
}) {
  const vendorsQuery = useQuery({
    queryKey: ['payables-vendors-active'],
    queryFn: () => api.listVendors({ status: 'ACTIVE', limit: 200 }),
  });
  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDateBs, setBillDateBs] = useState(() =>
    formatBsDateForInput(new Date()),
  );
  const [dueDateBs, setDueDateBs] = useState('');
  const [description, setDescription] = useState('');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [idempotencyKey] = useState(newKey);
  const mutation = useMutation({
    mutationFn: (dates: { expenseDate: string; dueDate?: string }) =>
      api.createVendorBill({
        idempotencyKey,
        vendorId,
        ...(billNumber.trim() ? { vendorBillNumber: billNumber.trim() } : {}),
        ...dates,
        description: description.trim(),
        expenseAccountId,
        amount: amount.trim(),
        ...(taxAmount.trim() ? { taxAmount: taxAmount.trim() } : {}),
      }),
    onSuccess: onCreated,
    onError: (error) =>
      onError(errorText(error, 'The bill could not be saved.')),
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Record a vendor bill</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            setProblem(null);
            if (!vendorId) return setProblem('Choose the vendor.');
            if (!expenseAccountId)
              return setProblem('Choose the expense account.');
            if (!MONEY.test(amount.trim()))
              return setProblem('Enter the amount before VAT in NPR.');
            if (taxAmount.trim() && !MONEY.test(taxAmount.trim()))
              return setProblem('Enter the VAT shown on the bill in NPR.');
            if (description.trim().length < 3)
              return setProblem('Describe what was bought.');
            let expenseDate: string;
            let dueDate: string | undefined;
            try {
              expenseDate = bsToGregorian(billDateBs);
              dueDate = dueDateBs.trim() ? bsToGregorian(dueDateBs) : undefined;
            } catch {
              return setProblem('Enter dates as BS dates (YYYY-MM-DD).');
            }
            mutation.mutate({ expenseDate, ...(dueDate ? { dueDate } : {}) });
          }}
        >
          <p className="text-xs text-slate-500">{TAX_NOTE}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vendor">
              <Select
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                required
              >
                <option value="">Choose a vendor</option>
                {(vendorsQuery.data?.items ?? []).map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.displayName} ({vendor.vendorCode})
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Vendor's bill number">
              <Input
                value={billNumber}
                onChange={(event) => setBillNumber(event.target.value)}
              />
            </FormField>
            <BsDateField
              label="Bill date (BS)"
              value={billDateBs}
              onChange={setBillDateBs}
              required
            />
            <BsDateField
              label="Due date (BS, optional)"
              value={dueDateBs}
              onChange={setDueDateBs}
              placeholder=""
            />
            <FormField label="Expense account" className="sm:col-span-2">
              <Select
                value={expenseAccountId}
                onChange={(event) => setExpenseAccountId(event.target.value)}
                required
              >
                <option value="">Choose an expense account</option>
                {(setup?.expenseAccounts ?? []).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} · {account.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Amount before VAT (NPR)">
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </FormField>
            <FormField label="VAT on the bill (NPR)">
              <Input
                inputMode="decimal"
                value={taxAmount}
                placeholder="0.00"
                onChange={(event) => setTaxAmount(event.target.value)}
              />
            </FormField>
            <FormField label="Description" className="sm:col-span-2">
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </FormField>
          </div>
          {problem ? (
            <p className="text-sm font-semibold text-rose-700">{problem}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BillDetailDialog({
  billId,
  onClose,
  notify,
}: {
  billId: string;
  onClose: () => void;
  notify: (tone: 'success' | 'danger', title: string) => void;
}) {
  const queryClient = useQueryClient();
  const billQuery = useQuery({
    queryKey: ['vendor-bill', billId],
    queryFn: () => api.getVendorBill(billId),
  });
  const [dialog, setDialog] = useState<'reject' | 'reverse' | null>(null);
  const bill = billQuery.data;
  const access = resourceAccess<
    'update' | 'submit' | 'approve' | 'reject' | 'reverse',
    'amounts' | 'approvals'
  >(bill?.authorization);
  const after = (message: string) => {
    setDialog(null);
    void queryClient.invalidateQueries({ queryKey: ['vendor-bill', billId] });
    void queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
    void queryClient.invalidateQueries({ queryKey: ['payables-aging'] });
    notify('success', message);
  };
  const fail = (error: unknown) =>
    notify('danger', errorText(error, 'The bill could not be updated.'));
  const submit = useMutation({
    mutationFn: () => api.submitVendorBill(billId),
    onSuccess: () => after('Bill submitted for approval.'),
    onError: fail,
  });
  const approve = useMutation({
    // The approver signs exactly the content they are looking at.
    mutationFn: () =>
      api.approveVendorBill(billId, bill?.contentFingerprint ?? ''),
    onSuccess: () => after('Bill approved and posted to Accounts Payable.'),
    onError: fail,
  });
  const reject = useMutation({
    mutationFn: (reason: string) => api.rejectVendorBill(billId, reason),
    onSuccess: () => after('Bill returned to the preparer.'),
    onError: fail,
  });
  const reverse = useMutation({
    mutationFn: (reason: string) => api.reverseVendorBill(billId, { reason }),
    onSuccess: () => after('Bill reversed. Its payable is void.'),
    onError: fail,
  });

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>
            {bill ? `Vendor bill ${bill.expenseNumber}` : 'Vendor bill'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-6 pb-6">
          {billQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : !bill ? (
            <p className="text-sm text-slate-600">
              This bill could not be loaded.
            </p>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Vendor</dt>
                  <dd className="font-semibold">
                    {bill.vendor?.displayName ?? '—'}
                    {bill.vendor?.panNumber
                      ? ` · PAN ${bill.vendor.panNumber}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd>
                    <StatusBadge status={bill.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Bill date (BS)</dt>
                  <dd>{formatBsDate(bill.expenseDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Due (BS)</dt>
                  <dd>{bill.dueDate ? formatBsDate(bill.dueDate) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Expense account</dt>
                  <dd>
                    {bill.expenseAccount.code} {bill.expenseAccount.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Vendor bill number</dt>
                  <dd>{bill.vendorBillNumber ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Amount</dt>
                  <dd>
                    <MoneyDisplay amount={bill.amount} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">
                    VAT (from the bill)
                  </dt>
                  <dd>
                    <MoneyDisplay amount={bill.taxAmount} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Total</dt>
                  <dd className="text-base font-bold">
                    <MoneyDisplay amount={bill.totalAmount} />
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-slate-500">Description</dt>
                  <dd>{bill.description}</dd>
                </div>
              </dl>
              {bill.rejection ? (
                <p className="rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-sm text-warning-900">
                  Returned by {bill.rejection.actor?.name ?? 'an approver'}:{' '}
                  {bill.rejection.reason}
                </p>
              ) : null}
              <section aria-label="Approval evidence">
                <h3 className="mb-2 text-sm font-bold text-slate-900">
                  Approval evidence
                </h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  {bill.events.map((event) => (
                    <li key={`${event.duty}-${event.at ?? ''}`}>
                      <span className="font-semibold">{event.duty}</span> ·{' '}
                      {event.actor?.name ?? 'Unknown'}
                      {event.at ? ` · ${formatBsDate(event.at)} BS` : ''}
                    </li>
                  ))}
                </ul>
                {bill.journal ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Posted as journal {bill.journal.entryNumber}
                    {bill.payable
                      ? ` · payable ${bill.payable.payableNumber} (${bill.payable.status.toLowerCase().replace('_', ' ')})`
                      : ''}
                  </p>
                ) : null}
              </section>
            </>
          )}
        </div>
        <DialogFooter className="flex-wrap gap-2 px-6 pb-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {access.can('submit') ? (
            <Button
              type="button"
              isLoading={submit.isPending}
              onClick={() => submit.mutate()}
            >
              Submit for approval
            </Button>
          ) : null}
          {access.can('reject') ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog('reject')}
            >
              Return to preparer
            </Button>
          ) : null}
          {access.can('approve') ? (
            <Button
              type="button"
              isLoading={approve.isPending}
              onClick={() => approve.mutate()}
            >
              Approve and post
            </Button>
          ) : null}
          {access.can('reverse') ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setDialog('reverse')}
            >
              Reverse bill
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
      <ReasonDialog
        isOpen={dialog === 'reject'}
        title="Return this bill to the preparer?"
        description="The bill goes back to draft with your reason. Nothing is posted."
        confirmLabel="Return bill"
        destructive={false}
        isConfirming={reject.isPending}
        onConfirm={(reason) => reject.mutate(reason)}
        onClose={() => setDialog(null)}
      />
      <ReasonDialog
        isOpen={dialog === 'reverse'}
        title="Reverse this bill?"
        description="The bill journal is reversed today and its payable becomes void. A bill with payments must have them reversed first."
        confirmLabel="Reverse bill"
        isConfirming={reverse.isPending}
        onConfirm={(reason) => reverse.mutate(reason)}
        onClose={() => setDialog(null)}
      />
    </Dialog>
  );
}

// ─── Vendors ─────────────────────────────────────────────────────────

function VendorsView({
  notify,
}: {
  notify: (tone: 'success' | 'danger', title: string) => void;
}) {
  const { hasPermissions } = useSession();
  const canWrite = hasPermissions(['accounting:vendors:write']);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deactivating, setDeactivating] = useState<FinanceVendorView | null>(
    null,
  );
  const vendorsQuery = useQuery({
    queryKey: ['payables-vendors', search, page],
    queryFn: () =>
      api.listVendors({
        ...(search.trim() ? { search: search.trim() } : {}),
        page,
        limit: PAGE_SIZE,
      }),
  });
  const deactivate = useMutation({
    mutationFn: (reason: string) =>
      api.deactivateVendor(deactivating?.id ?? '', reason),
    onSuccess: () => {
      setDeactivating(null);
      void queryClient.invalidateQueries({ queryKey: ['payables-vendors'] });
      notify('success', 'Vendor deactivated.');
    },
    onError: (error) =>
      notify(
        'danger',
        errorText(error, 'The vendor could not be deactivated.'),
      ),
  });
  const columns: PaginatedDataTableColumn<FinanceVendorView>[] = useMemo(
    () => [
      {
        id: 'vendor',
        header: 'Vendor',
        cell: (row) => (
          <div>
            <span className="font-semibold text-slate-900">
              {row.displayName}
            </span>
            <div className="text-xs text-slate-500">
              {row.vendorCode}
              {row.panNumber ? ` · PAN ${row.panNumber}` : ''}
            </div>
          </div>
        ),
      },
      {
        id: 'contact',
        header: 'Contact',
        cell: (row) => row.phone ?? row.email ?? '—',
        hideBelow: 'md',
      },
      {
        id: 'status',
        header: 'Status',
        cell: (row) => <StatusBadge status={row.status} />,
      },
      {
        id: 'owed',
        header: 'Owed',
        align: 'right',
        cell: (row) => <MoneyDisplay amount={row.outstandingAmount} />,
      },
    ],
    [],
  );

  return (
    <Surface
      title="Vendors"
      description="Suppliers the school buys from. Vendors are deactivated, never deleted."
      actions={
        canWrite ? (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            Add vendor
          </Button>
        ) : undefined
      }
    >
      <div className="mb-3 md:w-80">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search name, code or PAN"
        />
      </div>
      <PaginatedDataTable
        columns={columns}
        items={vendorsQuery.data?.items ?? []}
        getRowId={(row) => row.id}
        rowActions={(row) =>
          resourceAccess<'update' | 'deactivate', 'contact'>(
            row.authorization,
          ).can('deactivate') ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDeactivating(row)}
            >
              Deactivate
            </Button>
          ) : null
        }
        status={
          vendorsQuery.isLoading
            ? 'loading'
            : vendorsQuery.isError
              ? 'error'
              : 'ready'
        }
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={vendorsQuery.data?.pagination.total ?? 0}
        onPageChange={setPage}
        hasActiveFilters={Boolean(search.trim())}
        emptyTitle="No vendors yet"
        emptyDescription="Add the suppliers the school receives bills from."
        onRetry={() => void vendorsQuery.refetch()}
      />
      {creating ? (
        <CreateVendorDialog
          onClose={() => setCreating(false)}
          onCreated={(vendor) => {
            setCreating(false);
            void queryClient.invalidateQueries({
              queryKey: ['payables-vendors'],
            });
            void queryClient.invalidateQueries({
              queryKey: ['payables-vendors-active'],
            });
            notify('success', `Vendor ${vendor.vendorCode} added.`);
          }}
          onError={(message) => notify('danger', message)}
        />
      ) : null}
      <ReasonDialog
        isOpen={deactivating !== null}
        title={`Deactivate ${deactivating?.displayName ?? 'vendor'}?`}
        description="No new bills can be recorded for an inactive vendor. Existing bills and payables are unchanged."
        confirmLabel="Deactivate"
        isConfirming={deactivate.isPending}
        onConfirm={(reason) => deactivate.mutate(reason)}
        onClose={() => setDeactivating(null)}
      />
    </Surface>
  );
}

function CreateVendorDialog({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (vendor: FinanceVendorView) => void;
  onError: (message: string) => void;
}) {
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () =>
      api.createVendor({
        legalName: legalName.trim(),
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        ...(panNumber.trim() ? { panNumber: panNumber.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      }),
    onSuccess: onCreated,
    onError: (error) =>
      onError(errorText(error, 'The vendor could not be added.')),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Add a vendor</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3 px-6 pb-6"
          onSubmit={(event) => {
            event.preventDefault();
            setProblem(null);
            if (legalName.trim().length < 2)
              return setProblem('Enter the vendor’s registered name.');
            if (panNumber.trim() && !/^\d{9}$/.test(panNumber.trim()))
              return setProblem('A PAN has 9 digits.');
            mutation.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Registered name" className="sm:col-span-2">
              <Input
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                required
              />
            </FormField>
            <FormField label="Display name (optional)">
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>
            <FormField label="PAN (9 digits, optional)">
              <Input
                inputMode="numeric"
                value={panNumber}
                onChange={(event) => setPanNumber(event.target.value)}
              />
            </FormField>
            <FormField label="Phone">
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
          </div>
          {problem ? (
            <p className="text-sm font-semibold text-rose-700">{problem}</p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={mutation.isPending}>
              Add vendor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

const currentYear = new Date().getFullYear();

export function AccountingForm() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState({
    name: `FY ${currentYear}-${currentYear + 1}`,
    startsOn: `${currentYear}-04-01`,
    endsOn: `${currentYear + 1}-03-31`,
  });

  const periodsQuery = useQuery({
    queryKey: ['accounting-periods'],
    queryFn: api.listAccountingPeriods,
  });
  const reportsQuery = useQuery({
    queryKey: ['accounting-reports'],
    queryFn: api.listAccountingReports,
  });
  const ledgerQuery = useQuery({
    queryKey: ['ledger-entries'],
    queryFn: api.listLedgerEntries,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['accounting-periods'] });
    void queryClient.invalidateQueries({ queryKey: ['accounting-reports'] });
  };
  const periodMutation = useMutation({
    mutationFn: api.createAccountingPeriod,
    onSuccess: invalidate,
  });
  const closeMutation = useMutation({
    mutationFn: api.closeAccountingPeriod,
    onSuccess: invalidate,
  });

  const report = reportsQuery.data;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Accounting Period</p>
          <div className="grid gap-3">
            <input
              value={period.name}
              onChange={(event) => setPeriod((current) => ({ ...current, name: event.target.value }))}
              placeholder="FY name"
            />
            <input
              type="date"
              value={period.startsOn}
              onChange={(event) => setPeriod((current) => ({ ...current, startsOn: event.target.value }))}
            />
            <input
              type="date"
              value={period.endsOn}
              onChange={(event) => setPeriod((current) => ({ ...current, endsOn: event.target.value }))}
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!period.name || periodMutation.isPending}
              onClick={() =>
                periodMutation.mutate({
                  ...period,
                  startsOn: new Date(period.startsOn).toISOString(),
                  endsOn: new Date(period.endsOn).toISOString(),
                })
              }
            >
              {periodMutation.isPending ? 'Creating...' : 'Create period'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Financial Snapshot</p>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Debit" value={`Rs ${report?.totals.debit ?? 0}`} />
            <Metric label="Credit" value={`Rs ${report?.totals.credit ?? 0}`} />
            <Metric label="Net Income" value={`Rs ${report?.incomeStatement.netIncome ?? 0}`} />
            <Metric label="Balanced" value={report?.balanced ? 'Yes' : 'No'} />
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Periods</p>
        <div className="grid gap-3">
          {(periodsQuery.data ?? []).slice(0, 6).map((item) => (
            <div key={item.id} className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white/55 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="font-semibold">
                  {item.name} / {item.status}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {new Date(item.startsOn).toLocaleDateString()} - {new Date(item.endsOn).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={item.status === 'CLOSED' || closeMutation.isPending}
                onClick={() => closeMutation.mutate(item.id)}
              >
                Close period
              </button>
            </div>
          ))}
          {periodsQuery.data?.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No periods yet.</p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SummaryList
          title="Trial Balance"
          items={(report?.trialBalance ?? []).slice(0, 8).map((item) => ({
            id: item.accountId,
            primary: `${item.code} / ${item.name}`,
            secondary: `Debit Rs ${item.debit} / Credit Rs ${item.credit}`,
          }))}
        />
        <SummaryList
          title="Recent Journal Entries"
          items={(ledgerQuery.data ?? []).slice(0, 8).map((item) => ({
            id: item.id,
            primary: `${item.entryNumber} / ${item.sourceType}`,
            secondary: item.narration,
          }))}
        />
      </div>

      {[periodMutation, closeMutation].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
      <p className="label mb-2">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">{title}</p>
      <div className="grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{item.primary}</p>
              <p className="text-sm text-[var(--muted)]">{item.secondary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No records yet.</p>
        )}
      </div>
    </section>
  );
}

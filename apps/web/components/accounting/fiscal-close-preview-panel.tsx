'use client';

import Link from 'next/link';
import type {
  FiscalCloseItem,
  FiscalPeriodClosePreview,
  FiscalYearClosePreview,
} from '@schoolos/core';
import { AlertTriangle, CheckCircle2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyDisplay } from '../ui/money-display';
import { cn } from '../../lib/utils';

/**
 * Phase 7.11d (ASTRA M11-H): the close preview, shared by the period and
 * year close dialogs. Every item, count, amount and closing line comes from
 * the server; a restricted item shows its severity but never a count. Each
 * warning must be ticked, and the close sends the preview fingerprint.
 */
export function FiscalClosePreviewPanel({
  preview,
  isLoading,
  isError,
  isFetching,
  acknowledged,
  onAcknowledge,
  onRecompute,
}: {
  preview: FiscalPeriodClosePreview | FiscalYearClosePreview | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  acknowledged: ReadonlySet<string>;
  onAcknowledge: (code: string, checked: boolean) => void;
  onRecompute: () => void;
}) {
  return (
    <div
      className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
      data-testid="fiscal-close-preview"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Close preview
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRecompute}
          disabled={isFetching}
          isLoading={isFetching}
          className="gap-1.5 text-[11px] font-bold"
        >
          <RefreshCcw size={12} />
          Recompute
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs font-semibold text-slate-500">
          Checking everything this close depends on…
        </p>
      ) : null}
      {isError ? (
        <p className="text-xs font-semibold text-rose-700">
          The close preview could not be loaded. Check your access and try
          again.
        </p>
      ) : null}
      {preview ? (
        <div className="space-y-3">
          <p
            className={cn(
              'flex items-center gap-1.5 text-xs font-bold',
              preview.readyToClose ? 'text-emerald-700' : 'text-rose-700',
            )}
          >
            {preview.readyToClose ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {preview.readyToClose
              ? 'Nothing blocks this close.'
              : `${preview.blockers.length} item(s) must be resolved before closing.`}
          </p>
          {preview.blockers.length > 0 ? (
            <ul className="space-y-1.5" aria-label="Blocking items">
              {preview.blockers.map((item) => (
                <PreviewItem key={item.code} item={item} />
              ))}
            </ul>
          ) : null}
          {preview.warnings.length > 0 ? (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-bold text-amber-800">
                Acknowledge each warning to close
              </legend>
              {preview.warnings.map((item) => (
                <label
                  key={item.code}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={acknowledged.has(item.code)}
                    onChange={(event) =>
                      onAcknowledge(item.code, event.target.checked)
                    }
                    aria-label={`Acknowledge: ${item.message}`}
                  />
                  <span>
                    <span className="font-semibold">{item.message}</span>{' '}
                    <ItemFigures item={item} />
                    <span className="block text-amber-800">
                      {item.consequence}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {preview.kind === 'YEAR' ? <ClosingLines preview={preview} /> : null}
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-600">
            {preview.consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ItemFigures({ item }: { item: FiscalCloseItem }) {
  if (item.restricted)
    return <span className="text-slate-500">(Restricted)</span>;
  return (
    <span>
      ({item.count}
      {item.amount ? (
        <>
          {' · '}
          <MoneyDisplay amount={item.amount} />
        </>
      ) : null}
      )
    </span>
  );
}

function PreviewItem({ item }: { item: FiscalCloseItem }) {
  return (
    <li className="rounded-lg border border-rose-100 bg-white p-2 text-xs text-rose-800">
      <span className="font-semibold">{item.message}</span>{' '}
      <ItemFigures item={item} />
      <span className="block text-slate-600">{item.consequence}</span>
      <Link
        href={item.resolutionRoute}
        className="font-semibold text-[var(--color-mod-accounting-accent)] hover:underline"
      >
        Resolve
      </Link>
    </li>
  );
}

function ClosingLines({ preview }: { preview: FiscalYearClosePreview }) {
  const { closing } = preview;
  return (
    <div className="space-y-1.5" data-testid="fiscal-close-lines">
      <p className="text-xs font-bold text-slate-700">
        {closing.supplementary
          ? `Supplementary closing entry (${closing.previousClosingEntries.length} earlier closing entr${closing.previousClosingEntries.length === 1 ? 'y' : 'ies'})`
          : 'Closing entry'}{' '}
        · {closing.bsEntryDate} BS ({closing.entryDate})
      </p>
      {closing.lines.length === 0 ? (
        <p className="text-xs text-slate-600">
          Income and expense are already closed; no new entry will be posted.
        </p>
      ) : (
        <table className="w-full text-[11px]">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-1">Account</th>
              <th className="text-right">Debit</th>
              <th className="text-right">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {closing.lines.map((line) => (
              <tr key={`${line.chartAccountId}-${line.debit}-${line.credit}`}>
                <td className="py-1">
                  {line.code} {line.name}
                </td>
                <td className="text-right">
                  {line.debit !== '0.00' ? (
                    <MoneyDisplay amount={line.debit} />
                  ) : null}
                </td>
                <td className="text-right">
                  {line.credit !== '0.00' ? (
                    <MoneyDisplay amount={line.credit} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-slate-700">
        {closing.resultType === 'SURPLUS'
          ? 'Net surplus'
          : closing.resultType === 'DEFICIT'
            ? 'Net deficit'
            : 'Net result'}{' '}
        <MoneyDisplay amount={closing.netResult} />
        {closing.retainedEarningsAccount
          ? ` → ${closing.retainedEarningsAccount.code} ${closing.retainedEarningsAccount.name}`
          : ''}
      </p>
    </div>
  );
}

/** Body of a close request built from the reviewed preview. */
export function closeRequestFromPreview(
  preview: { previewFingerprint: string; requiredAcknowledgements: string[] },
  reason: string,
  acknowledged: ReadonlySet<string>,
) {
  return {
    reason,
    expectedPreviewFingerprint: preview.previewFingerprint,
    acknowledgedWarningCodes: preview.requiredAcknowledgements.filter((code) =>
      acknowledged.has(code),
    ),
  };
}

export function allWarningsAcknowledged(
  preview: { requiredAcknowledgements: string[] } | undefined,
  acknowledged: ReadonlySet<string>,
): boolean {
  return Boolean(
    preview?.requiredAcknowledgements.every((code) => acknowledged.has(code)),
  );
}

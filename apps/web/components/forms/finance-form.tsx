'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api';

export function FinanceForm() {
  const [feeHead, setFeeHead] = useState({
    code: 'TUITION-P1',
    name: 'Class 1 Tuition',
    frequency: 'MONTHLY',
    defaultAmount: 3500,
    vatApplicable: true,
  });

  const feeHeadMutation = useMutation({
    mutationFn: api.createFeeHead,
  });

  const paymentMutation = useMutation({
    mutationFn: api.collectPayment,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Fee Head</p>
        <div className="grid gap-3">
          <input
            value={feeHead.code}
            onChange={(event) => setFeeHead((current) => ({ ...current, code: event.target.value }))}
            placeholder="Code"
          />
          <input
            value={feeHead.name}
            onChange={(event) => setFeeHead((current) => ({ ...current, name: event.target.value }))}
            placeholder="Name"
          />
          <input
            type="number"
            value={feeHead.defaultAmount}
            onChange={(event) =>
              setFeeHead((current) => ({
                ...current,
                defaultAmount: Number(event.target.value),
              }))
            }
            placeholder="Default amount"
          />
          <button
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
            onClick={() => feeHeadMutation.mutate(feeHead)}
          >
            {feeHeadMutation.isPending ? 'Saving...' : 'Create fee head'}
          </button>
        </div>
      </div>

      <div className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Payment Collection</p>
        <p className="mb-4 text-sm text-[var(--muted)]">
          The API auto-posts a journal entry after each payment. This is the accounting-led demo moment from the spec.
        </p>
        <button
          className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white"
          onClick={() =>
            paymentMutation.mutate({
              invoiceId: 'replace-me',
              amount: 1000,
              method: 'CASH',
              narration: 'Demo payment',
            })
          }
        >
          {paymentMutation.isPending ? 'Posting...' : 'Collect demo payment'}
        </button>
      </div>
    </div>
  );
}

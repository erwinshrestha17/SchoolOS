'use client';

import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

type ApprovalStep = {
  label: string;
  description?: string;
  status: 'done' | 'current' | 'rejected' | 'pending';
};

type ApprovalTimelineProps = {
  steps: ApprovalStep[];
};

export function ApprovalTimeline({ steps }: ApprovalTimelineProps) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const Icon =
          step.status === 'done'
            ? CheckCircle2
            : step.status === 'rejected'
              ? XCircle
              : Circle;

        return (
          <li key={`${step.label}-${index}`} className="flex gap-3">
            <Icon
              size={20}
              className={cn(
                'mt-0.5 shrink-0',
                step.status === 'done' && 'text-success-600',
                step.status === 'current' && 'text-[var(--primary)]',
                step.status === 'rejected' && 'text-danger-600',
                step.status === 'pending' && 'text-slate-300',
              )}
            />
            <div>
              <p className="text-sm font-bold text-slate-900">{step.label}</p>
              {step.description ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {step.description}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

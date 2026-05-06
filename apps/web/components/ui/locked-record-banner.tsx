'use client';

import { Lock } from 'lucide-react';
import { AuditInfo } from './audit-info';

type LockedRecordBannerProps = {
  label?: string;
  reason?: string;
};

export function LockedRecordBanner({
  label = 'Record locked',
  reason = 'This record is finalized. Corrections should be made through an approved reversal, adjustment, or correction workflow.',
}: LockedRecordBannerProps) {
  return (
    <AuditInfo tone="warning">
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 shrink-0" size={16} />
        <div>
          <p className="font-bold">{label}</p>
          <p className="mt-0.5 text-sm font-medium opacity-90">{reason}</p>
        </div>
      </div>
    </AuditInfo>
  );
}

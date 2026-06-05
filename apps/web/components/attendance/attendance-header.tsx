'use client';

import React from 'react';
import { StatCard } from '@/components/ui/stat-card';
import { Users } from 'lucide-react';

interface AttendanceHeaderProps {
  total: number;
  presentPercent: number;
  exceptions: number;
}

export function AttendanceHeader({ total, presentPercent, exceptions }: AttendanceHeaderProps) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <StatCard
        title="Total Students"
        value={String(total)}
        icon={<Users size={18} />}
        tone="neutral"
      />
      <StatCard
        title="Attendance Rate"
        value={`${presentPercent}%`}
        tone="success"
        trend={{
          value: presentPercent,
          label: 'Current rate',
          isUp: presentPercent >= 90
        }}
      />
      <StatCard
        title="Exceptions"
        value={String(exceptions)}
        tone={exceptions > 0 ? 'warning' : 'neutral'}
      />
    </div>
  );
}

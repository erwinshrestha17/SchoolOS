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
      />
      <StatCard
        title="Attendance Rate"
        value={`${presentPercent}%`}
        trend={{
          value: presentPercent,
          label: 'Current rate',
          isUp: presentPercent >= 90
        }}
      />
      <StatCard
        title="Exceptions"
        value={String(exceptions)}
      />
    </div>
  );
}

'use client';

import { Metric, MetricGroup } from '@/components/schoolos';
import React from 'react';
import { AlertTriangle, Percent, Users } from 'lucide-react';

interface AttendanceHeaderProps {
  total: number;
  presentPercent: number;
  exceptions: number;
}

export function AttendanceHeader({
  total,
  presentPercent,
  exceptions,
}: AttendanceHeaderProps) {
  return (
    <MetricGroup className="md:grid-cols-3 xl:grid-cols-3">
      <Metric
        label="Roster Students"
        value={String(total)}
        icon={<Users size={18} />}
        tone="neutral"
        description="Students loaded from the selected roster."
      />
      <Metric
        label="Roster Attendance Rate"
        value={`${presentPercent}%`}
        icon={<Percent size={18} />}
        tone="success"
        description="Calculated for this open roster before submission."
      />
      <Metric
        label="Exceptions"
        value={String(exceptions)}
        icon={<AlertTriangle size={18} />}
        tone={exceptions > 0 ? 'warning' : 'neutral'}
        description="Absent, late, and leave rows currently marked."
      />
    </MetricGroup>
  );
}

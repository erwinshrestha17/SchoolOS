/** Existing payroll day rules. Attendance contributes one day for PRESENT/LATE;
 * approved leave and employment caps remain authoritative inputs. */
export function payrollDayCounts(input: {
  workingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  employedDays: number;
  periodCalendarDays: number;
}) {
  const effective = Math.min(
    input.workingDays,
    input.presentDays + input.paidLeaveDays,
  );
  const unpaid = Math.max(
    0,
    input.workingDays - effective,
    input.unpaidLeaveDays,
  );
  const employedWorking =
    input.employedDays >= input.periodCalendarDays
      ? input.workingDays
      : Math.min(
          input.workingDays,
          Math.round(
            (input.workingDays * input.employedDays) / input.periodCalendarDays,
          ),
        );
  return {
    paidDays: Math.min(
      employedWorking,
      Math.max(0, input.workingDays - unpaid),
    ),
    unpaidDays: unpaid,
  };
}

export function attendancePaidContribution(status: string) {
  return status === 'PRESENT' || status === 'LATE' ? 1 : 0;
}

/** Same inclusive UTC calendar-day overlap used by payroll preparation. */
export function payrollLeaveOverlapDays(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): number {
  const start = new Date(Math.max(start1.getTime(), start2.getTime()));
  const end = new Date(Math.min(end1.getTime(), end2.getTime()));
  if (start > end) return 0;
  const first = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  );
  const last = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  return Math.round((last - first) / 86400000) + 1;
}

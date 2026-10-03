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

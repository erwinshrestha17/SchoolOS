import {
  attendancePaidContribution,
  payrollDayCounts,
} from './payroll-day-policy';
describe('Payroll day projection uses payroll rules', () => {
  const full = {
    workingDays: 30,
    presentDays: 20,
    paidLeaveDays: 2,
    unpaidLeaveDays: 0,
    employedDays: 31,
    periodCalendarDays: 31,
  };
  it('preserves paid leave and explicit unpaid leave caps', () => {
    expect(payrollDayCounts(full)).toEqual({ paidDays: 22, unpaidDays: 8 });
    expect(payrollDayCounts({ ...full, unpaidLeaveDays: 12 })).toEqual({
      paidDays: 18,
      unpaidDays: 12,
    });
  });
  it('caps days by verified employment and never treats a half day as full', () => {
    expect(payrollDayCounts({ ...full, employedDays: 10 }).paidDays).toBe(10);
    expect(attendancePaidContribution('HALF_DAY')).toBe(0);
    expect(attendancePaidContribution('LATE')).toBe(1);
  });
  it('does not add a paid day when leave has already saturated working days', () => {
    const before = payrollDayCounts({ ...full, paidLeaveDays: 30 });
    const after = payrollDayCounts({
      ...full,
      paidLeaveDays: 30,
      presentDays: 21,
    });
    expect(after).toEqual(before);
  });
});

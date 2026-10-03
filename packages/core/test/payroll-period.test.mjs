import assert from "node:assert/strict";
import test from "node:test";
import {
  PAYROLL_BS_MIN_YEAR,
  PayrollPeriodError,
  findPayrollPeriodContaining,
  formatPayrollPeriodLabel,
  nextPayrollPeriod,
  resolvePayrollPeriod,
  toBsDateFromGregorian,
} from "../dist/index.js";

test("a payroll period is one BS month with contiguous Gregorian bounds", () => {
  const ashwin = resolvePayrollPeriod(2083, 6);
  assert.equal(ashwin.label, "Ashwin 2083");
  assert.equal(ashwin.startsOnBs, "2083-06-01");
  assert.equal(ashwin.calendarDays, ashwin.endsOnBs.slice(-2) * 1);
  // Bounds round-trip through the one canonical converter.
  assert.deepEqual(toBsDateFromGregorian(ashwin.startsOn), {
    year: 2083,
    month: 6,
    day: 1,
  });
  assert.deepEqual(toBsDateFromGregorian(ashwin.endsOn), {
    year: 2083,
    month: 6,
    day: ashwin.calendarDays,
  });
});

test("consecutive periods never overlap and never leave a gap across month and year boundaries", () => {
  for (let year = 2082; year <= 2084; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const current = resolvePayrollPeriod(year, month);
      const next = nextPayrollPeriod(current);
      const expected =
        month === 12
          ? resolvePayrollPeriod(year + 1, 1)
          : resolvePayrollPeriod(year, month + 1);
      assert.equal(next.label, expected.label);
      assert.ok(next.startsOn > current.endsOn);
      const gap =
        (Date.parse(`${next.startsOn}T00:00:00Z`) -
          Date.parse(`${current.endsOn}T00:00:00Z`)) /
        86_400_000;
      assert.equal(gap, 1);
      assert.ok([29, 30, 31, 32].includes(current.calendarDays));
    }
  }
});

test("any Gregorian date resolves to exactly one containing period", () => {
  const period = resolvePayrollPeriod(2083, 6);
  assert.equal(
    findPayrollPeriodContaining(period.startsOn).label,
    period.label,
  );
  assert.equal(findPayrollPeriodContaining(period.endsOn).label, period.label);
  const before = findPayrollPeriodContaining("2026-10-03");
  assert.equal(before.bsYear, 2083);
  assert.ok(before.startsOn <= "2026-10-03" && "2026-10-03" <= before.endsOn);
});

test("invalid months and years are rejected with a machine-readable code", () => {
  for (const [year, month, code] of [
    [2083, 0, "PAYROLL_PERIOD_INVALID_MONTH"],
    [2083, 13, "PAYROLL_PERIOD_INVALID_MONTH"],
    [2083, 1.5, "PAYROLL_PERIOD_INVALID_MONTH"],
    [PAYROLL_BS_MIN_YEAR - 1, 1, "PAYROLL_PERIOD_YEAR_OUT_OF_RANGE"],
    [2091, 1, "PAYROLL_PERIOD_YEAR_OUT_OF_RANGE"],
  ]) {
    assert.throws(
      () => resolvePayrollPeriod(year, month),
      (error) => error instanceof PayrollPeriodError && error.code === code,
    );
  }
  assert.throws(
    () => findPayrollPeriodContaining("1900-01-01"),
    (error) => error.code === "PAYROLL_PERIOD_DATE_OUT_OF_RANGE",
  );
});

test("labels distinguish BS periods from legacy Gregorian labels", () => {
  assert.equal(formatPayrollPeriodLabel(2083, 6), "Ashwin 2083");
  assert.equal(formatPayrollPeriodLabel(2026, 9), "2026-09");
});

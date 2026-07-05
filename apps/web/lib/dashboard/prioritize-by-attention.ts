import type { OperationalModuleSummary } from "@schoolos/core";

/**
 * Reorders a dashboard section's module cards so whichever one has the most
 * urgent, real backend-reported attention items appears first — e.g. a
 * cashier's "Daily operations" section naturally leads with Fees when there
 * are overdue collections, a teacher's leads with Attendance when a register
 * is unsubmitted, without guessing anyone's role from permissions.
 *
 * Ties (including "nothing needs attention" — the common case) keep the
 * section's original module order, since Array.prototype.sort is a stable
 * sort in current JS engines.
 */
export function prioritizeByAttention(
  modules: OperationalModuleSummary[],
): OperationalModuleSummary[] {
  return [...modules].sort(
    (left, right) => attentionWeight(right) - attentionWeight(left),
  );
}

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/** Highest attentionItems severity dominates; total count only breaks ties. */
function attentionWeight(summary: OperationalModuleSummary): number {
  if (!summary.attentionItems.length) return 0;

  const worstSeverity = summary.attentionItems.reduce(
    (max, item) => Math.max(max, SEVERITY_WEIGHT[item.severity] ?? 0),
    0,
  );
  const totalCount = summary.attentionItems.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return worstSeverity * 1000 + totalCount;
}

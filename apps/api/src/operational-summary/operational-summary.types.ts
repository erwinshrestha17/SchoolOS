export const OPERATIONAL_SUMMARY_MODULES = [
  'm1_students',
  'm2_attendance',
  'm3_fees',
  'm4_academics',
  'm5_activity',
  'm6_homework_timetable',
  'm7_hr_payroll',
  'm8a_library',
  'm8b_transport',
  'm8c_canteen',
  'm9_accounting',
  'm10_communications',
  'm11_intelligence',
  'm12_learning',
] as const;

export type OperationalSummaryModule =
  (typeof OPERATIONAL_SUMMARY_MODULES)[number];

export type OperationalSummaryStatus =
  | 'ready'
  | 'empty'
  | 'partial'
  | 'locked'
  | 'permissionDenied';

export interface OperationalAttentionItem {
  key: string;
  label: string;
  count: number;
  severity: 'info' | 'warning' | 'critical';
  action: string;
}

export interface OperationalRecentItem {
  id: string;
  label: string;
  occurredAt: string;
}

export interface OperationalNextAction {
  key: string;
  label: string;
  route: string;
}

export interface OperationalModuleSummary {
  generatedAt: string;
  schoolDay: string;
  module: OperationalSummaryModule;
  status: OperationalSummaryStatus;
  permissions: {
    canView: boolean;
  };
  summary: Record<string, number | string | null>;
  attentionItems: OperationalAttentionItem[];
  recentItems: OperationalRecentItem[];
  nextActions: OperationalNextAction[];
  nextCursor: null;
}

export const OPERATIONAL_SUMMARY_MODULES = [
  'students',
  'attendance',
  'fees',
  'academics',
  'activity',
  'homework-timetable',
  'hr-payroll',
  'library',
  'transport',
  'canteen',
  'accounting',
  'communications',
  'intelligence',
  'learning',
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
  permissions: { canView: boolean };
  summary: Record<string, number | string | null>;
  attentionItems: OperationalAttentionItem[];
  recentItems: OperationalRecentItem[];
  nextActions: OperationalNextAction[];
  nextCursor: null;
}

/**
 * Phase 3C legacy consolidation map (SCHOOLOS_WEB_DESIGN_ASTRA §5.2).
 *
 * Each legacy/overlapping primitive names its canonical v2 replacement
 * (exported from components/schoolos). Legacy components stay until their
 * callers are migrated, but `maxImporters` ratchets usage: the guard test
 * fails when a legacy module gains importers, and the baseline should be
 * lowered whenever callers migrate. `0` means the module is dead and must
 * not gain its first importer.
 *
 * Plain data, no JSX, so node --test can import it directly.
 */
export type LegacyPrimitive = {
  /** Module path relative to apps/web, without extension. */
  module: string;
  replacement: string;
  maxImporters: number;
};

export const LEGACY_PRIMITIVES: readonly LegacyPrimitive[] = [
  {
    module: 'components/ui/card',
    replacement: 'Surface or Card',
    maxImporters: 19,
  },
  {
    module: 'components/ui/primitives/card',
    replacement: 'Surface or Card',
    maxImporters: 3,
  },
  {
    module: 'components/ui/section-card',
    replacement: 'Section / Surface',
    maxImporters: 0,
  },
  {
    module: 'components/ui/work-surface',
    replacement: 'DataWorkspace / Surface / Panel',
    maxImporters: 27,
  },
  { module: 'components/ui/stat-card', replacement: 'Metric', maxImporters: 0 },
  { module: 'components/ui/kpi-card', replacement: 'Metric', maxImporters: 0 },
  {
    module: 'components/marketing/metric-card',
    replacement: 'Metric',
    maxImporters: 1,
  },
  {
    module: 'components/ui/data-table',
    replacement: 'DataWorkspace',
    maxImporters: 12,
  },
  {
    module: 'components/ui/table',
    replacement: 'DataWorkspace / PaginatedDataTable',
    maxImporters: 10,
  },
  {
    module: 'components/ui/approval-timeline',
    replacement: 'Timeline',
    maxImporters: 0,
  },
  {
    module: 'components/dashboard/status-chip',
    replacement: 'StatusBadge',
    maxImporters: 0,
  },
  {
    module: 'components/ui/primitives/badge',
    replacement: 'StatusBadge',
    maxImporters: 5,
  },
  {
    module: 'components/ui/workspace-states',
    replacement: 'EmptyState / ErrorState / DataWorkspace refreshError',
    maxImporters: 2,
  },
  {
    module: 'components/ui/primitives/pagination',
    replacement: 'PaginatedDataTable',
    maxImporters: 0,
  },
  {
    module: 'components/ui/primitives/alert-dialog',
    replacement: 'ConfirmDialog',
    maxImporters: 0,
  },
  {
    module: 'components/ui/primitives/field',
    replacement: 'FormField / FormSection',
    maxImporters: 0,
  },
  {
    module: 'components/ui/report-toolbar',
    replacement: 'DataWorkspace',
    maxImporters: 0,
  },
];

/**
 * Files that still hand-roll a `fixed inset-0` overlay instead of Dialog /
 * ConfirmDialog / Inspector. The list may only shrink.
 */
export const AD_HOC_OVERLAY_BASELINE_MAX = 10;

/**
 * SchoolOS Web Design System v2 — the ONE canonical component layer
 * (SCHOOLOS_WEB_DESIGN_ASTRA §5; master plan Phase 3C–3G).
 *
 * New code imports shared primitives from here. Where an existing component
 * already fulfils a canonical role it is re-exported rather than rebuilt, so
 * there is no third generation of near-duplicates. Legacy overlaps and their
 * canonical replacements are listed in ./legacy-map.ts and ratcheted by
 * test/design-system-v2-contract.test.mjs.
 */

// Structure (3C)
export {
  Surface,
  Section,
  Panel,
  Card,
  type SurfaceProps,
  type SectionProps,
  type PanelProps,
  type CardProps,
} from './layout/structure';
export {
  Timeline,
  type TimelineEntry,
  type TimelineTone,
} from './layout/timeline';

// Metric: SummaryCard is the single compact-metric implementation.
export {
  SummaryCard as Metric,
  SummaryGrid as MetricGroup,
  type SummaryCardProps as MetricProps,
} from '../ui/summary-card';

// Status: StatusBadge is the single semantic status implementation.
export { StatusBadge, type StatusTone } from '../ui/status-badge';

// Workspaces (3C/3E/3F)
export {
  DataWorkspace,
  type DataWorkspaceProps,
} from './workspace/data-workspace';
export {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
  type PaginatedDataTableProps,
  type PaginatedDataTableSelection,
  type PaginatedDataTableSort,
} from './data/paginated-data-table';
export {
  Inspector,
  useInspectorState,
  type InspectorProps,
} from './workspace/inspector';
export {
  Entity360,
  authorizedEntityTabs,
  type Entity360Props,
  type Entity360Tab,
} from './workspace/entity-360';
export {
  QueueWorkspace,
  type QueueAgingBucket,
} from './workspace/queue-workspace';

// Forms (3G)
export {
  FormSection,
  FormSectionNav,
  StickyFormActions,
  useUnsavedChangesGuard,
  type FormSectionNavItem,
} from './form/form-system';
export { FormField } from '../ui/form-field';
export { ConfirmDialog } from '../ui/confirm-dialog';
export { RemoteCombobox as SearchableSelect } from '../ui/remote-combobox';

// Transient surfaces
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';

// Page states
export { EmptyState } from '../ui/empty-state';
export { ErrorState } from '../ui/error-state';
export { LoadingState } from '../ui/loading-state';
export { PermissionDenied } from '../ui/permission-denied';

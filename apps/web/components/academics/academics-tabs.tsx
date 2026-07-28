import {
  ClipboardList,
  Gauge,
  Eye,
  FileText,
  LayoutDashboard,
  Layers3,
  Megaphone,
  PencilLine,
  HeartHandshake,
} from 'lucide-react';
import type { TabItem } from '@/components/ui/module-tabs';

// Shared across the M4 overview and every academics sub-route so cross-module
// navigation is consistent and always reflects the real current route.
export const academicsWorkspaceTabs: TabItem[] = [
  { href: '/dashboard/academics', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/academics/exam-terms', label: 'Exam Terms', icon: ClipboardList },
  { href: '/dashboard/academics/marks', label: 'Marks Entry', icon: PencilLine },
  { href: '/dashboard/academics/cas', label: 'CAS', icon: Layers3 },
  {
    href: '/dashboard/academics/learning-improvement',
    label: 'Learning Support',
    icon: HeartHandshake,
  },
  { href: '/dashboard/academics/report-cards', label: 'Report Cards', icon: FileText },
  { href: '/dashboard/academics/results', label: 'Results', icon: Eye },
];

export const academicsWorkspaceOverflowTabs: TabItem[] = [
  { href: '/dashboard/academics/publishing', label: 'Publishing', icon: Megaphone },
  {
    href: '/dashboard/academics/board-readiness',
    label: 'Board Readiness',
    icon: Gauge,
  },
];

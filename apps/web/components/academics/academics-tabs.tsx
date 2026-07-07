import {
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileText,
  GraduationCap,
  Layers3,
  Lock,
  Megaphone,
  PencilLine,
  RotateCcw,
} from 'lucide-react';
import type { TabItem } from '@/components/ui/module-tabs';

// Shared across the M4 overview and every academics sub-route so cross-module
// navigation is consistent and always reflects the real current route.
export const academicsWorkspaceTabs: TabItem[] = [
  { href: '/dashboard/academics', label: 'Subjects', icon: ClipboardCheck },
  { href: '/dashboard/academics/exam-terms', label: 'Exam Terms', icon: ClipboardList },
  { href: '/dashboard/academics/marks', label: 'Marks Entry', icon: PencilLine },
  { href: '/dashboard/academics/retakes', label: 'Retests', icon: RotateCcw },
  { href: '/dashboard/academics/cas', label: 'CAS', icon: Layers3 },
  { href: '/dashboard/academics/locks', label: 'Locks', icon: Lock },
  { href: '/dashboard/academics/report-cards', label: 'Report Cards', icon: FileText },
  { href: '/dashboard/academics/promotion', label: 'Promotion', icon: GraduationCap },
  { href: '/dashboard/academics/publishing', label: 'Publishing', icon: Megaphone },
  { href: '/dashboard/academics/results', label: 'Results', icon: Eye },
];

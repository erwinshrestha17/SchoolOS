import {
  BookOpenCheck,
  Gauge,
  LayoutGrid,
  Library,
  MonitorPlay,
  PencilRuler,
  Radio,
  Wrench,
} from 'lucide-react';
import type { TabItem } from '@/components/ui/module-tabs';

// Shared across every /dashboard/learning/* route so the tab bar is
// identical and always reflects the real current route, with no duplicate
// or route-local copy that can drift out of sync.
export const learningWorkspaceTabs: TabItem[] = [
  { href: '/dashboard/learning', label: 'Overview', icon: LayoutGrid },
  { href: '/dashboard/learning/activities', label: 'Activities', icon: BookOpenCheck },
  { href: '/dashboard/learning/activities/new', label: 'Builder', icon: PencilRuler },
  { href: '/dashboard/learning/resources', label: 'Resources', icon: Library },
  { href: '/dashboard/learning/sessions', label: 'Sessions', icon: Radio },
  { href: '/dashboard/learning/smart-board/launch', label: 'Smart Board', icon: MonitorPlay },
  { href: '/dashboard/learning/lab', label: 'Computer Lab', icon: Wrench },
  { href: '/dashboard/learning/progress', label: 'Progress', icon: Gauge },
];

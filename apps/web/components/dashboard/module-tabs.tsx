'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../../lib/utils';
import { LucideIcon } from 'lucide-react';

export interface TabItem {
  href?: string;
  value?: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface ModuleTabsProps {
  items: TabItem[];
  activeValue?: string;
  onValueChange?: (value: string) => void;
  accentColor?: 'blue' | 'emerald' | 'indigo' | 'purple' | 'amber' | 'orange' | 'lime' | 'rose' | 'slate';
  variant?: 'dark' | 'light';
  className?: string;
}

const tabAccentStyles = {
  blue: {
    activeDark: "bg-blue-500 text-white shadow-lg shadow-blue-500/20",
    activeLight: "bg-blue-600 text-white shadow-md border-blue-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  emerald: {
    activeDark: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20",
    activeLight: "bg-emerald-600 text-white shadow-md border-emerald-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  indigo: {
    activeDark: "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20",
    activeLight: "bg-indigo-600 text-white shadow-md border-indigo-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  purple: {
    activeDark: "bg-purple-500 text-white shadow-lg shadow-purple-500/20",
    activeLight: "bg-purple-600 text-white shadow-md border-purple-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  amber: {
    activeDark: "bg-amber-500 text-white shadow-lg shadow-amber-500/20",
    activeLight: "bg-amber-600 text-white shadow-md border-amber-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  orange: {
    activeDark: "bg-orange-500 text-white shadow-lg shadow-orange-500/20",
    activeLight: "bg-orange-600 text-white shadow-md border-orange-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  lime: {
    activeDark: "bg-lime-600 text-white shadow-lg shadow-lime-600/20",
    activeLight: "bg-lime-700 text-white shadow-md border-lime-700",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  rose: {
    activeDark: "bg-rose-500 text-white shadow-lg shadow-rose-500/20",
    activeLight: "bg-rose-600 text-white shadow-md border-rose-600",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  },
  slate: {
    activeDark: "bg-slate-700 text-white shadow-lg shadow-slate-700/20",
    activeLight: "bg-slate-700 text-white shadow-md border-slate-700",
    badgeActiveDark: "bg-white/20 text-white",
    badgeInactiveDark: "bg-white/10 text-white/50",
    badgeActiveLight: "bg-white/20 text-white",
    badgeInactiveLight: "bg-slate-100 text-slate-500",
  }
};

export function ModuleTabs({
  items,
  activeValue,
  onValueChange,
  accentColor = 'blue',
  variant = 'dark',
  className,
}: ModuleTabsProps) {
  const pathname = usePathname();
  const styles = tabAccentStyles[accentColor];
  const hasExactHref = items.some((item) => item.href === pathname);

  const getIsActive = (item: TabItem) => {
    if (onValueChange && item.value !== undefined) {
      return activeValue === item.value;
    }
    if (item.href) {
      return (
        pathname === item.href ||
        (!hasExactHref &&
          item.href !== '/dashboard' &&
          pathname?.startsWith(item.href))
      );
    }
    return false;
  };

  const containerClasses = cn(
    "flex overflow-x-auto pb-1 max-w-full scrollbar-none gap-2 -mb-px",
    className
  );

  return (
    <div className={containerClasses} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {items.map((item, index) => {
        const isActive = getIsActive(item);
        const Icon = item.icon;

        const buttonClasses = cn(
          "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap active:scale-[0.98]",
          variant === 'dark'
            ? isActive
              ? styles.activeDark
              : "text-white/60 hover:bg-white/5 hover:text-white"
            : isActive
              ? styles.activeLight
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
        );

        const countBadge = item.count !== undefined && item.count > 0 && (
          <span className={cn(
            "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
            variant === 'dark'
              ? isActive ? styles.badgeActiveDark : styles.badgeInactiveDark
              : isActive ? styles.badgeActiveLight : styles.badgeInactiveLight
          )}>
            {item.count}
          </span>
        );

        if (item.href) {
          return (
            <Link key={item.href || index} href={item.href} className={buttonClasses}>
              {Icon && <Icon size={16} />}
              <span>{item.label}</span>
              {countBadge}
            </Link>
          );
        }

        return (
          <button
            key={item.value || index}
            type="button"
            onClick={() => item.value !== undefined && onValueChange?.(item.value)}
            className={buttonClasses}
          >
            {Icon && <Icon size={16} />}
            <span>{item.label}</span>
            {countBadge}
          </button>
        );
      })}
    </div>
  );
}

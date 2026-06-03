'use client';

import Link from 'next/link';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuickActionCardProps {
  label: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  accentColor?: 'blue' | 'emerald' | 'indigo' | 'purple' | 'amber' | 'rose' | 'slate';
  className?: string;
}

const colorStyles = {
  blue: {
    icon: "text-blue-600 bg-blue-50 border border-blue-100",
    hover: "hover:border-blue-200 hover:bg-blue-50/30",
    arrow: "group-hover:text-blue-600",
  },
  emerald: {
    icon: "text-emerald-600 bg-emerald-50 border border-emerald-100",
    hover: "hover:border-emerald-200 hover:bg-emerald-50/30",
    arrow: "group-hover:text-emerald-600",
  },
  indigo: {
    icon: "text-indigo-600 bg-indigo-50 border border-indigo-100",
    hover: "hover:border-indigo-200 hover:bg-indigo-50/30",
    arrow: "group-hover:text-indigo-600",
  },
  purple: {
    icon: "text-purple-600 bg-purple-50 border border-purple-100",
    hover: "hover:border-purple-200 hover:bg-purple-50/30",
    arrow: "group-hover:text-purple-600",
  },
  amber: {
    icon: "text-amber-600 bg-amber-50 border border-amber-100",
    hover: "hover:border-amber-200 hover:bg-amber-50/30",
    arrow: "group-hover:text-amber-600",
  },
  rose: {
    icon: "text-rose-600 bg-rose-50 border border-rose-100",
    hover: "hover:border-rose-200 hover:bg-rose-50/30",
    arrow: "group-hover:text-rose-600",
  },
  slate: {
    icon: "text-slate-600 bg-slate-50 border border-slate-100",
    hover: "hover:border-slate-200 hover:bg-slate-50/30",
    arrow: "group-hover:text-slate-600",
  }
};

export function QuickActionCard({
  label,
  description,
  href,
  icon: Icon,
  accentColor = 'blue',
  className,
}: QuickActionCardProps) {
  const styles = colorStyles[accentColor];

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:shadow-sm transition-all duration-200 active:scale-[0.99]",
        styles.hover,
        className
      )}
    >
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105", styles.icon)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-slate-900 leading-snug truncate">{label}</p>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{description}</p>
        )}
      </div>
      <ArrowRight size={16} className={cn("text-slate-300 transition-all duration-200 group-hover:translate-x-0.5", styles.arrow)} />
    </Link>
  );
}

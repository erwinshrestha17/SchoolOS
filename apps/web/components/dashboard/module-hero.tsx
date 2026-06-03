'use client';

import { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

interface ModuleHeroProps {
  title: string;
  subtitle?: string;
  badge?: string;
  category?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  variant?: 'dark' | 'light';
  accentColor?: 'blue' | 'emerald' | 'indigo' | 'purple' | 'amber' | 'rose' | 'slate';
  className?: string;
}

const accentStyles = {
  blue: {
    bgGradient: "from-blue-500/15",
    badge: "bg-blue-500/20 text-blue-400 border-blue-500/20",
    textAccent: "text-blue-400",
    icon: "text-blue-400 bg-white/10 border-white/10",
  },
  emerald: {
    bgGradient: "from-emerald-500/15",
    badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
    textAccent: "text-emerald-400",
    icon: "text-emerald-400 bg-white/10 border-white/10",
  },
  indigo: {
    bgGradient: "from-indigo-500/15",
    badge: "bg-indigo-500/20 text-indigo-400 border-indigo-500/20",
    textAccent: "text-indigo-400",
    icon: "text-indigo-400 bg-white/10 border-white/10",
  },
  purple: {
    bgGradient: "from-purple-500/15",
    badge: "bg-purple-500/20 text-purple-400 border-purple-500/20",
    textAccent: "text-purple-400",
    icon: "text-purple-400 bg-white/10 border-white/10",
  },
  amber: {
    bgGradient: "from-amber-500/15",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/20",
    textAccent: "text-amber-400",
    icon: "text-amber-400 bg-white/10 border-white/10",
  },
  rose: {
    bgGradient: "from-rose-500/15",
    badge: "bg-rose-500/20 text-rose-400 border-rose-500/20",
    textAccent: "text-rose-400",
    icon: "text-rose-400 bg-white/10 border-white/10",
  },
  slate: {
    bgGradient: "from-slate-500/15",
    badge: "bg-slate-500/20 text-slate-400 border-slate-500/20",
    textAccent: "text-slate-400",
    icon: "text-slate-400 bg-white/10 border-white/10",
  }
};

export function ModuleHero({
  title,
  subtitle,
  badge,
  category,
  icon,
  actions,
  tabs,
  variant = 'dark',
  accentColor = 'blue',
  className,
}: ModuleHeroProps) {
  const styles = accentStyles[accentColor];

  if (variant === 'light') {
    return (
      <header className={cn(
        "relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-8 text-slate-900 shadow-sm md:px-10 lg:px-12",
        className
      )}>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              {badge && (
                <Badge variant="neutral" className="bg-slate-100 text-slate-700 border-slate-200">
                  {badge}
                </Badge>
              )}
              {badge && category && <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              {category && (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {category}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {actions}
            {icon && (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 shadow-sm">
                {icon}
              </div>
            )}
          </div>
        </div>

        {tabs && (
          <div className="mt-8 border-t border-slate-100 pt-6">
            {tabs}
          </div>
        )}
      </header>
    );
  }

  // Dark variant (Navy bg)
  return (
    <header className={cn(
      "relative overflow-hidden rounded-[2rem] bg-slate-900 px-6 py-10 text-white shadow-2xl md:px-10 lg:px-12",
      className
    )}>
      {/* Background gradients */}
      <div className={cn("absolute right-0 top-0 h-64 w-64 rounded-full bg-gradient-to-br blur-3xl opacity-50", styles.bgGradient)} />
      <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-slate-800/10 blur-3xl" />
      
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center flex-wrap gap-2">
            {badge && (
              <Badge variant="neutral" className={cn("border-transparent font-bold", styles.badge)}>
                {badge}
              </Badge>
            )}
            {badge && category && <div className="h-1.5 w-1.5 rounded-full bg-white/20" />}
            {category && (
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                {category}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="text-base text-slate-300 leading-relaxed max-w-xl">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {actions}
          {icon && (
            <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-xl shadow-inner", styles.icon)}>
              {icon}
            </div>
          )}
        </div>
      </div>

      {tabs && (
        <nav className="relative mt-8 flex flex-wrap gap-2 border-t border-white/10 pt-6">
          {tabs}
        </nav>
      )}
    </header>
  );
}

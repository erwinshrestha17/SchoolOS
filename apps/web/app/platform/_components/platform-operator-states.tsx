import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PlatformSectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export function PlatformEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
        <Icon size={28} />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function PlatformInlineError({
  title = 'Platform data unavailable',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
      <div className="flex items-center gap-3 font-black">
        <AlertTriangle size={20} />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6">{message}</p>
      {onRetry ? (
        <Button className="mt-4 rounded-2xl" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PlatformBoundaryNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-cyan-900">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-cyan-700">{title}</p>
      <div className="mt-2 text-sm leading-6 text-cyan-800">{children}</div>
    </div>
  );
}

'use client';

import { ArrowLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from './button';
import { PageState } from './page-state';

interface PermissionDeniedProps {
  title?: string;
  description?: string;
  resource?: string;
  action?: string;
  className?: string;
  /**
   * Route-level permission walls (the dashboard/platform layouts) show Go
   * Back / Return Home since they replace the whole page. Inline
   * section-level restrictions (e.g. one tab of a module page) render
   * alongside content the user can still act on, so navigation actions
   * don't apply there.
   */
  showNavigation?: boolean;
}

export function PermissionDenied({
  title = 'Access restricted',
  description = "You do not have permission to open this page or perform this action. Contact your school administrator if you need access.",
  resource,
  action,
  className,
  showNavigation = true,
}: PermissionDeniedProps) {
  const router = useRouter();

  return (
    <PageState
      tone="permission"
      title={title}
      description={description}
      className={className}
      secondaryAction={
        showNavigation ? (
          <>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
            <Button type="button" onClick={() => router.push('/dashboard')}>
              <Home className="h-4 w-4" />
              Return Home
            </Button>
          </>
        ) : undefined
      }
    >
      {(resource || action) && (
        <div className="flex flex-wrap justify-center gap-2">
          {resource && (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Resource: <span className="ml-1 text-slate-950">{resource}</span>
            </span>
          )}
          {action && (
            <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Action: <span className="ml-1 text-slate-950">{action}</span>
            </span>
          )}
        </div>
      )}
    </PageState>
  );
}

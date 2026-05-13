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
}

export function PermissionDenied({
  title = 'Access Restricted',
  description = "You don't have the necessary permissions to access this resource or perform this action.",
  resource,
  action,
}: PermissionDeniedProps) {
  const router = useRouter();

  return (
    <PageState
      tone="permission"
      title={title}
      description={description}
      secondaryAction={
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

'use client';

import { ShieldAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';

interface PermissionStateProps {
  title?: string;
  description?: string;
  className?: string;
  onBack?: () => void;
}

export function PermissionState({
  title = 'Access Denied',
  description = "You don't have the required permissions to view this section. Please contact your school administrator if you believe this is an error.",
  className,
  onBack,
}: PermissionStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm',
        className
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <ShieldAlert size={32} />
      </div>
      <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-slate-500 leading-relaxed">
        {description}
      </p>
      {onBack && (
        <Button onClick={onBack} className="mt-8" variant="outline">
          Go Back
        </Button>
      )}
    </div>
  );
}

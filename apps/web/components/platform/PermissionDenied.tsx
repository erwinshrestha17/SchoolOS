'use client';

import { ArrowLeft, Home, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PermissionDeniedProps {
  title?: string;
  description?: string;
  showBack?: boolean;
  showHome?: boolean;
}

export function PermissionDenied({
  title = 'Access Restricted',
  description = "You don't have the necessary permissions to access this platform control plane. Please contact your system administrator if you believe this is an error.",
  showBack = true,
  showHome = true,
}: PermissionDeniedProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-[20px] bg-danger-50 text-danger-600 shadow-sm">
        <ShieldAlert size={40} />
      </div>

      <h1 className="text-[30px] font-extrabold leading-[38px] text-slate-900">
        {title}
      </h1>

      <p className="mt-4 max-w-lg text-base leading-[26px] text-slate-500">
        {description}
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        {showBack && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.history.back()}
            className="rounded-2xl border-slate-200 px-8 font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft size={18} className="mr-2" />
            Go Back
          </Button>
        )}

        {showHome && (
          <Link href="/">
            <Button
              size="lg"
              className="rounded-2xl bg-slate-900 px-8 font-bold text-white shadow-xl shadow-slate-200 hover:bg-slate-800"
            >
              <Home size={18} className="mr-2" />
              Return Home
            </Button>
          </Link>
        )}
      </div>

      <div className="mt-12 text-sm font-medium text-slate-400">
        Reference: <span className="font-semibold text-slate-500">Platform access denied</span>
      </div>
    </div>
  );
}

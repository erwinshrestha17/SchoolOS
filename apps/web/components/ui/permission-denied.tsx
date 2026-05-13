'use client';

import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20">
        {/* Background Glow */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-red-500/10 blur-[80px]" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-[80px]" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 ring-8 ring-red-500/5">
            <Lock className="h-10 w-10 text-red-400" />
          </div>

          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          
          <p className="mb-8 text-lg leading-relaxed text-slate-400">
            {description}
          </p>

          {(resource || action) && (
            <div className="mb-8 flex flex-wrap justify-center gap-2">
              {resource && (
                <span className="inline-flex items-center rounded-lg border border-white/5 bg-white/5 px-3 py-1 text-sm font-medium text-slate-300">
                  Resource: <span className="ml-1.5 text-cyan-400">{resource}</span>
                </span>
              )}
              {action && (
                <span className="inline-flex items-center rounded-lg border border-white/5 bg-white/5 px-3 py-1 text-sm font-medium text-slate-300">
                  Action: <span className="ml-1.5 text-amber-400">{action}</span>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.back()}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white transition-all hover:bg-white/10 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-500 active:scale-95"
            >
              <Home className="h-4 w-4" />
              Return Home
            </button>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-sm text-slate-500">
          <p className="flex items-center justify-center gap-2 italic">
            <ShieldAlert className="h-4 w-4" />
            Security enforced by SchoolOS Identity Core
          </p>
        </div>
      </div>
    </div>
  );
}

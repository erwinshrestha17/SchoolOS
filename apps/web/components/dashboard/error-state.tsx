'use client';

import { useState } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  error?: Error | { message: string; stack?: string } | null;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  onRetry,
  className,
}: ErrorStateProps) {
  const [showStack, setShowStack] = useState(false);
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-[2rem] border border-rose-100 bg-rose-50/10 p-8 text-center animate-in fade-in duration-300",
      className
    )}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shadow-sm">
        <AlertOctagon size={28} />
      </div>
      <h3 className="text-lg font-bold text-slate-900 leading-snug">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500 leading-relaxed">{message}</p>
      
      {isDev && error && (
        <div className="mt-4 w-full max-w-lg text-left">
          <button 
            type="button" 
            onClick={() => setShowStack(!showStack)}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 underline focus:outline-none"
          >
            {showStack ? "Hide technical details" : "Show technical details"}
          </button>
          {showStack && (
            <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-950 p-3 text-[10px] font-mono text-rose-400 border border-slate-800">
              {error.stack || error.message || JSON.stringify(error, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
            <RotateCcw size={14} />
            Retry
          </Button>
        )}
        <Button onClick={() => window.location.reload()} size="sm">
          Reload Page
        </Button>
      </div>
    </div>
  );
}

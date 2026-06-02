'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import { QrCode, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

type QrResolverPurpose =
  | 'LIBRARY'
  | 'CANTEEN'
  | 'CANTEEN_POS'
  | 'CANTEEN_SERVE';

type QRResolverProps = {
  purpose: QrResolverPurpose;
  onResolved: (data: any) => void;
  className?: string;
  autoFocus?: boolean;
  helperText?: string;
  placeholder?: string;
  submitLabel?: string;
};

export function QRResolver({
  purpose,
  onResolved,
  className,
  autoFocus = false,
  helperText = 'Scanner input stays ready after every successful scan.',
  placeholder = 'Scan student QR or paste token...',
  submitLabel = 'Resolve',
}: QRResolverProps) {
  const [token, setToken] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  async function handleResolve(submittedToken: string) {
    if (!submittedToken.trim()) return;
    
    setIsResolving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await api.resolveStudentQr({
        token: submittedToken.trim(),
        purpose: normalizeQrPurpose(purpose),
      });
      const normalizedData = {
        ...data,
        id: data.id ?? data.studentId,
      };

      setSuccess(true);
      onResolved(normalizedData);
      setToken('');
      window.setTimeout(() => inputRef.current?.focus(), 0);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve QR token');
      window.setTimeout(() => inputRef.current?.select(), 0);
    } finally {
      setIsResolving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleResolve(token);
  }

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <div className="relative">
        <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          ref={inputRef}
          type="text"
          autoComplete="off"
          aria-label="Student QR token"
          placeholder={placeholder}
          className={cn(
            'h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-28 text-sm font-bold shadow-sm transition outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            success && 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
          )}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={isResolving}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {isResolving ? (
            <Loader2 className="animate-spin text-primary-500" size={20} />
          ) : success ? (
            <CheckCircle2 className="text-emerald-500" size={20} />
          ) : null}
          <button
            type="submit"
            disabled={isResolving || !token.trim()}
            className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            {submitLabel}
          </button>
        </div>
      </div>
      {helperText && !error && !success ? (
        <p className="px-2 text-xs font-semibold text-slate-500">{helperText}</p>
      ) : null}
      {error && (
        <div className="flex items-center gap-2 px-2 text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}

function normalizeQrPurpose(purpose: QrResolverPurpose) {
  if (purpose === 'CANTEEN_POS' || purpose === 'CANTEEN_SERVE') {
    return 'CANTEEN';
  }

  return purpose;
}

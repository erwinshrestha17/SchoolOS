'use client';

import { useState } from 'react';
import { QrCode, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

type QRResolverProps = {
  purpose: 'LIBRARY' | 'CANTEEN_POS' | 'CANTEEN_SERVE';
  onResolved: (data: any) => void;
  className?: string;
};

export function QRResolver({ purpose, onResolved, className }: QRResolverProps) {
  const [token, setToken] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleResolve(submittedToken: string) {
    if (!submittedToken.trim()) return;
    
    setIsResolving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await api.resolveStudentQr({ token: submittedToken.trim(), purpose });
      setSuccess(true);
      onResolved(data);
      setToken('');
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve QR token');
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Scan Student QR or paste token..."
          className={cn(
            'h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-12 text-sm font-bold shadow-sm transition outline-none focus:border-primary-300 focus:ring-4 focus:ring-primary-100',
            error && 'border-red-300 focus:border-red-400 focus:ring-red-100',
            success && 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
          )}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleResolve(token);
          }}
          disabled={isResolving}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isResolving ? (
            <Loader2 className="animate-spin text-primary-500" size={20} />
          ) : success ? (
            <CheckCircle2 className="text-emerald-500" size={20} />
          ) : null}
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 px-2 text-xs font-bold text-red-600 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

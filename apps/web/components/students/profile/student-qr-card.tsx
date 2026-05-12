'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { QrCode, RefreshCw, XCircle, Download, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StudentQrCardProps = {
  studentId: string;
  studentSystemId: string;
  initialStatus?: string;
};

export function StudentQrCard({ studentId, studentSystemId, initialStatus }: StudentQrCardProps) {
  const queryClient = useQueryClient();
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [showConfirmRotate, setShowConfirmRotate] = useState(false);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);
  const [rotateReason, setRotateReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');

  const generateMutation = useMutation({
    mutationFn: () => api.generateStudentQr(studentId),
    onSuccess: (data) => {
      setRawToken(data.rawToken);
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => api.rotateStudentQr(studentId, { reason: rotateReason }),
    onSuccess: (data) => {
      setRawToken(data.rawToken);
      setShowConfirmRotate(false);
      setRotateReason('');
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeStudentQr(studentId, { reason: revokeReason }),
    onSuccess: () => {
      setRawToken(null);
      setShowConfirmRevoke(false);
      setRevokeReason('');
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
    },
  });

  const status = initialStatus || 'NOT_GENERATED';
  const isActive = status === 'ACTIVE';

  return (
    <SectionCard 
      title="Student Identity QR" 
      description="Secure token-based identity for library, canteen, and attendance."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              isActive ? "bg-success-50 text-success-600" : "bg-slate-200 text-slate-500"
            )}>
              <QrCode size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">QR Status</p>
              <StatusBadge status={status} className="mt-0.5" />
            </div>
          </div>
          
          {!isActive && !generateMutation.isPending && (
            <button
              onClick={() => generateMutation.mutate()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800"
            >
              Generate Identity
            </button>
          )}
          {generateMutation.isPending && (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </div>
          )}
        </div>

        {rawToken && (
          <div className="rounded-[2rem] border-2 border-primary-100 bg-primary-50/30 p-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex h-48 w-48 items-center justify-center rounded-3xl bg-white p-4 shadow-xl ring-8 ring-primary-50">
              {/* eslint-disable-next-line @next/next/no-img-element -- Data URL generated for QR code does not benefit from next/image optimization */}
              <img 
                src={api.getStudentQrImageUrl(studentId, rawToken)} 
                alt="Student QR Code"
                className="h-full w-full object-contain"
              />
            </div>
            <p className="text-sm font-bold text-slate-900">New QR Identity Generated</p>
            <p className="mt-1 text-xs text-slate-500 max-w-[240px] mx-auto">
              This token is not stored server-side. Please print or save the ID card now.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
               <button 
                className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => window.print()}
               >
                 <Download size={14} />
                 Print Code
               </button>
               <button 
                className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800"
                onClick={() => setRawToken(null)}
               >
                 Done
               </button>
            </div>
          </div>
        )}

        {isActive && !rawToken && (
          <div className="grid grid-cols-2 gap-3">
             <button
              onClick={() => setShowConfirmRotate(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw size={16} className="text-primary-500" />
              Rotate (Lost Card)
            </button>
            <button
              onClick={() => setShowConfirmRevoke(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <XCircle size={16} className="text-danger-500" />
              Revoke Access
            </button>
          </div>
        )}

        {showConfirmRotate && (
          <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-primary-700">
              <RefreshCw size={16} />
              <p className="text-xs font-bold uppercase">Confirm QR Rotation</p>
            </div>
            <p className="text-xs text-primary-600">
              The existing QR code will be immediately invalidated. Provide a reason for this rotation.
            </p>
            <input 
              className="premium-input text-xs" 
              placeholder="e.g. Card lost by student" 
              value={rotateReason}
              onChange={(e) => setRotateReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button 
                className="flex-1 rounded-xl bg-primary-500 py-2 text-xs font-bold text-white transition hover:bg-primary-600 disabled:opacity-50"
                disabled={!rotateReason || rotateMutation.isPending}
                onClick={() => rotateMutation.mutate()}
              >
                {rotateMutation.isPending ? 'Rotating...' : 'Rotate Now'}
              </button>
              <button 
                className="flex-1 rounded-xl bg-white border border-primary-200 py-2 text-xs font-bold text-primary-600"
                onClick={() => setShowConfirmRotate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {showConfirmRevoke && (
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-danger-700">
              <AlertCircle size={16} />
              <p className="text-xs font-bold uppercase">Revoke QR Identity</p>
            </div>
            <p className="text-xs text-danger-600">
              This will disable all school services (Library, Canteen) for this student until a new QR is generated.
            </p>
            <input 
              className="premium-input text-xs" 
              placeholder="e.g. Disciplinary suspension" 
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button 
                className="flex-1 rounded-xl bg-danger-500 py-2 text-xs font-bold text-white transition hover:bg-danger-600 disabled:opacity-50"
                disabled={!revokeReason || revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke Access'}
              </button>
              <button 
                className="flex-1 rounded-xl bg-white border border-danger-200 py-2 text-xs font-bold text-danger-600"
                onClick={() => setShowConfirmRevoke(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
           <div className="flex items-center gap-2 text-slate-400 mb-2">
             <ShieldCheck size={14} />
             <p className="text-[0.6rem] font-bold uppercase tracking-wider">Audit Security Policy</p>
           </div>
           <p className="text-[0.65rem] text-slate-500 leading-relaxed">
             QR Identity uses cryptographic hashes. Raw tokens are never stored on SchoolOS servers. Rotation generates a fresh audit trail and invalidates the previous physical card.
           </p>
        </div>
      </div>
    </SectionCard>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatBsDate, type StudentProfile } from '@schoolos/core';
import { api } from '@/lib/api';
import type { StudentQrScanAudit } from '@/lib/api/students';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProtectedFileButton } from '@/components/ui/protected-file';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StudentQrCardProps = {
  studentId: string;
  studentSystemId: string;
  qrCredential?: StudentProfile['qrCredential'];
};

export function StudentQrCard({ studentId, studentSystemId, qrCredential }: StudentQrCardProps) {
  const queryClient = useQueryClient();
  const [generatedArtifact, setGeneratedArtifact] = useState<{
    fileAssetId: string;
    fileName: string;
  } | null>(null);
  const [showConfirmRotate, setShowConfirmRotate] = useState(false);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);
  const [rotateReason, setRotateReason] = useState('');
  const [revokeReason, setRevokeReason] = useState('');
  const qrStatusQuery = useQuery({
    queryKey: ['student-qr-status', studentId],
    queryFn: () => api.getStudentQrStatus(studentId),
  });
  const qrScansQuery = useQuery({
    queryKey: ['student-qr-scans', studentId],
    queryFn: () => api.listStudentQrScans(studentId),
  });
  const currentCredential = qrStatusQuery.data?.activeCredential ?? qrCredential ?? null;
  const credentialHistory = qrStatusQuery.data?.history ?? [];
  const scanHistory = qrScansQuery.data ?? [];

  const generateMutation = useMutation({
    mutationFn: () => api.generateStudentQr(studentId),
    onSuccess: (data) => {
      setGeneratedArtifact(
        data.fileAssetId && data.fileName
          ? { fileAssetId: data.fileAssetId, fileName: data.fileName }
          : null,
      );
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-status', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-scans', studentId] });
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () => api.rotateStudentQr(studentId, { reason: rotateReason }),
    onSuccess: (data) => {
      setGeneratedArtifact(
        data.fileAssetId && data.fileName
          ? { fileAssetId: data.fileAssetId, fileName: data.fileName }
          : null,
      );
      setShowConfirmRotate(false);
      setRotateReason('');
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-status', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-scans', studentId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.revokeStudentQr(studentId, { reason: revokeReason }),
    onSuccess: () => {
      setGeneratedArtifact(null);
      setShowConfirmRevoke(false);
      setRevokeReason('');
      void queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-status', studentId] });
      void queryClient.invalidateQueries({ queryKey: ['student-qr-scans', studentId] });
    },
  });

  const status = currentCredential?.status || 'NOT_GENERATED';
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
              className="rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)]"
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

        {generatedArtifact && (
          <div className="rounded-2xl border-2 border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-soft)] p-6 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-sm ring-8 ring-white/70">
              <FileText className="h-9 w-9 text-[var(--color-mod-admissions-accent)]" />
            </div>
            <p className="text-sm font-bold text-slate-900">Protected ID card generated</p>
            <p className="mt-1 text-xs text-slate-500 max-w-[240px] mx-auto">
              The QR credential is embedded by the backend. Its secret is never returned to this browser.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <ProtectedFileButton
                fileAssetId={generatedArtifact.fileAssetId}
                fileName={generatedArtifact.fileName}
                action="preview"
                label="Preview ID card"
              />
              <ProtectedFileButton
                fileAssetId={generatedArtifact.fileAssetId}
                fileName={generatedArtifact.fileName}
                action="download"
                label="Download ID card"
              />
               <button 
                className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)]"
                onClick={() => {
                  setGeneratedArtifact(null);
                }}
               >
                 Done
               </button>
            </div>
          </div>
        )}

        {isActive && !generatedArtifact && (
          <div className="space-y-3">
            {currentCredential?.lastScannedAt && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/30 px-4 py-2.5 text-xs text-slate-500">
                <ShieldCheck size={14} className="text-success-500" />
                <span>Last scanned {formatBsDate(currentCredential.lastScannedAt)}</span>
              </div>
            )}
            {currentCredential?.fileAssetId ? (
              <div className="flex flex-wrap gap-2">
                <ProtectedFileButton
                  fileAssetId={currentCredential.fileAssetId}
                  fileName={`${studentSystemId}-student-id-card.pdf`}
                  action="preview"
                  label="Preview protected ID card"
                />
                <ProtectedFileButton
                  fileAssetId={currentCredential.fileAssetId}
                  fileName={`${studentSystemId}-student-id-card.pdf`}
                  action="download"
                  label="Download ID card"
                />
              </div>
            ) : (
              <p className="rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-700">
                The protected ID-card file is unavailable. Rotate the credential to create a replacement.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
               <button
                onClick={() => setShowConfirmRotate(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw size={16} className="text-[var(--color-mod-admissions-accent)]" />
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
          </div>
        )}

        {showConfirmRotate && (
          <div className="rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-soft)] p-4 space-y-3 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-[var(--color-mod-admissions-text)]">
              <RefreshCw size={16} />
              <p className="text-xs font-bold uppercase">Confirm QR Rotation</p>
            </div>
            <p className="text-xs text-[var(--color-mod-admissions-text)]">
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
                className="flex-1 rounded-xl bg-[var(--color-mod-admissions-accent)] py-2 text-xs font-bold text-white transition hover:bg-[var(--color-mod-admissions-text)] disabled:opacity-50"
                disabled={!rotateReason || rotateMutation.isPending}
                onClick={() => rotateMutation.mutate()}
              >
                {rotateMutation.isPending ? 'Rotating...' : 'Rotate Now'}
              </button>
              <button 
                className="flex-1 rounded-xl bg-white border border-[var(--color-mod-admissions-border)] py-2 text-xs font-bold text-[var(--color-mod-admissions-text)]"
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

        {(generateMutation.error || rotateMutation.error || revokeMutation.error) && (
          <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs font-bold text-danger-600 animate-in fade-in">
            {(generateMutation.error || rotateMutation.error || revokeMutation.error)?.message || 'An error occurred'}
          </div>
        )}

        {credentialHistory.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Credential history</p>
            <div className="mt-3 space-y-2">
              {credentialHistory.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div>
                    <StatusBadge status={item.status} />
                    <p className="mt-1 text-[0.65rem] text-slate-500">
                      Issued {formatBsDate(item.createdAt)}
                    </p>
                  </div>
                  {(item.rotateReason || item.revokeReason) && (
                    <span className="max-w-[12rem] truncate text-[0.65rem] font-semibold text-slate-500">
                      {item.rotateReason ?? item.revokeReason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Scan audit history</p>
              <p className="mt-1 text-[0.65rem] font-medium text-slate-500">
                Recent QR lifecycle and resolve attempts recorded by the backend audit log.
              </p>
            </div>
            {qrScansQuery.isLoading ? (
              <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />
            ) : (
              <Clock3 size={16} className="shrink-0 text-slate-400" />
            )}
          </div>

          {qrScansQuery.isError ? (
            <div className="mt-3 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-[0.65rem] font-bold text-danger-600">
              {qrScansQuery.error instanceof Error
                ? qrScansQuery.error.message
                : 'QR scan audit history could not be loaded.'}
            </div>
          ) : scanHistory.length > 0 ? (
            <div className="mt-3 space-y-2">
              {scanHistory.slice(0, 6).map((entry) => (
                <QrScanAuditRow key={entry.id} entry={entry} />
              ))}
            </div>
          ) : !qrScansQuery.isLoading ? (
            <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-center text-[0.65rem] font-semibold text-slate-500">
              No QR scan audit events recorded yet.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
           <div className="flex items-center gap-2 text-slate-400 mb-2">
             <ShieldCheck size={14} />
             <p className="text-[0.6rem] font-bold uppercase tracking-wider">Audit Security Policy</p>
           </div>
           <p className="text-[0.65rem] text-slate-500 leading-relaxed">
             QR Identity uses protected token hashes. Credential secrets are held only in backend memory while the protected ID-card artifact is generated. Rotation invalidates the previous card and file.
           </p>
        </div>
      </div>
    </SectionCard>
  );
}

function QrScanAuditRow({ entry }: { entry: StudentQrScanAudit }) {
  const success = entry.success !== false;
  const actor = entry.performedByEmail ?? entry.scannedByEmail ?? entry.performedBy ?? 'System';
  const detail = [
    formatQrAction(entry.action),
    entry.purpose ? entry.purpose.replaceAll('_', ' ').toLowerCase() : null,
    entry.reason ?? entry.failureCode,
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {success ? (
            <CheckCircle2 size={13} className="shrink-0 text-success-600" />
          ) : (
            <AlertCircle size={13} className="shrink-0 text-danger-600" />
          )}
          <p className="truncate text-[0.7rem] font-bold text-slate-700">
            {detail || formatQrAction(entry.action)}
          </p>
        </div>
        <p className="mt-1 truncate text-[0.65rem] font-medium text-slate-500">
          {actor}
        </p>
      </div>
      <span className="shrink-0 text-[0.62rem] font-bold text-slate-400">
        {formatBsDate(entry.timestamp)}
      </span>
    </div>
  );
}

function formatQrAction(action: string) {
  return action
    .replace(/^QR_/, '')
    .replaceAll('_', ' ')
    .toLowerCase();
}

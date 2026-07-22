'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDate,
  STUDENT_QR_REASON_MAX_LENGTH,
  STUDENT_QR_REASON_MIN_LENGTH,
  type StudentProfile,
} from '@schoolos/core';
import { api } from '@/lib/api';
import type { StudentQrScanAudit } from '@/lib/api/students';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { ProtectedFileButton } from '@/components/ui/protected-file';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { schoolFacingErrorMessage } from '@/lib/school-facing-error';

type StudentQrCardProps = {
  studentId: string;
  studentSystemId: string;
  qrCredential?: StudentProfile['qrCredential'];
};

const QR_WORKSPACE_QUERY_KEYS = [
  ['student-qr-workspace-summary'],
  ['students', 'qr-workspace'],
] as const;

export function StudentQrCard({
  studentId,
  studentSystemId,
  qrCredential,
}: StudentQrCardProps) {
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
  const currentCredential =
    qrStatusQuery.data !== undefined
      ? qrStatusQuery.data.activeCredential
      : (qrCredential ?? null);
  const credentialHistory = qrStatusQuery.data?.history ?? [];
  const scanHistory = qrScansQuery.data ?? [];

  function refreshQrWorkspace() {
    for (const queryKey of QR_WORKSPACE_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
  }

  const generateMutation = useMutation({
    mutationFn: () => api.generateStudentQr(studentId),
    onSuccess: (data) => {
      setGeneratedArtifact(
        data.fileAssetId && data.fileName
          ? { fileAssetId: data.fileAssetId, fileName: data.fileName }
          : null,
      );
      void queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-status', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-scans', studentId],
      });
      refreshQrWorkspace();
    },
  });

  const rotateMutation = useMutation({
    mutationFn: () =>
      api.rotateStudentQr(studentId, { reason: rotateReason.trim() }),
    onSuccess: (data) => {
      setGeneratedArtifact(
        data.fileAssetId && data.fileName
          ? { fileAssetId: data.fileAssetId, fileName: data.fileName }
          : null,
      );
      setShowConfirmRotate(false);
      setRotateReason('');
      void queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-status', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-scans', studentId],
      });
      refreshQrWorkspace();
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () =>
      api.revokeStudentQr(studentId, { reason: revokeReason.trim() }),
    onSuccess: () => {
      setGeneratedArtifact(null);
      setShowConfirmRevoke(false);
      setRevokeReason('');
      void queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-status', studentId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['student-qr-scans', studentId],
      });
      refreshQrWorkspace();
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
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl',
                isActive
                  ? 'bg-success-50 text-success-600'
                  : 'bg-slate-200 text-slate-500',
              )}
            >
              <QrCode size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                QR Status
              </p>
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
            <p className="text-sm font-bold text-slate-900">
              Protected ID card generated
            </p>
            <p className="mt-1 text-xs text-slate-500 max-w-[240px] mx-auto">
              The QR credential is embedded by the backend. Its secret is never
              returned to this browser.
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
                <span>
                  Last scanned {formatBsDate(currentCredential.lastScannedAt)}
                </span>
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
                The protected ID-card file is unavailable. Rotate the credential
                to create a replacement.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  rotateMutation.reset();
                  setRotateReason('');
                  setShowConfirmRotate(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw
                  size={16}
                  className="text-[var(--color-mod-admissions-accent)]"
                />
                Rotate (Lost Card)
              </button>
              <button
                onClick={() => {
                  revokeMutation.reset();
                  setRevokeReason('');
                  setShowConfirmRevoke(true);
                }}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
              >
                <XCircle size={16} className="text-danger-500" />
                Revoke Access
              </button>
            </div>
          </div>
        )}

        <ConfirmDialog
          isOpen={showConfirmRotate}
          title="Rotate student QR credential?"
          description="The current QR and protected ID-card file will stop working immediately. A replacement credential and file will be generated."
          confirmLabel="Rotate credential"
          isConfirming={rotateMutation.isPending}
          preventCloseWhileConfirming
          confirmDisabled={
            rotateReason.trim().length < STUDENT_QR_REASON_MIN_LENGTH
          }
          onConfirm={() => rotateMutation.mutate()}
          onClose={() => {
            rotateMutation.reset();
            setRotateReason('');
            setShowConfirmRotate(false);
          }}
        >
          <QrReasonField
            id="student-qr-rotate-reason"
            label="Rotation reason"
            value={rotateReason}
            onChange={setRotateReason}
          />
          <QrActionError
            error={rotateMutation.error}
            fallback="The QR credential could not be rotated. The current credential may have changed; refresh and try again."
          />
        </ConfirmDialog>

        <ConfirmDialog
          isOpen={showConfirmRevoke}
          title="Revoke student QR credential?"
          description="This disables the current QR and its protected ID-card file for school services until a new credential is generated."
          confirmLabel="Revoke credential"
          destructive
          isConfirming={revokeMutation.isPending}
          preventCloseWhileConfirming
          confirmDisabled={
            revokeReason.trim().length < STUDENT_QR_REASON_MIN_LENGTH
          }
          onConfirm={() => revokeMutation.mutate()}
          onClose={() => {
            revokeMutation.reset();
            setRevokeReason('');
            setShowConfirmRevoke(false);
          }}
        >
          <QrReasonField
            id="student-qr-revoke-reason"
            label="Revocation reason"
            value={revokeReason}
            onChange={setRevokeReason}
          />
          <QrActionError
            error={revokeMutation.error}
            fallback="The QR credential could not be revoked. The current credential may have changed; refresh and try again."
          />
        </ConfirmDialog>

        {generateMutation.error && (
          <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs font-bold text-danger-600 animate-in fade-in">
            {schoolFacingErrorMessage(generateMutation.error, {
              fallback:
                'The QR credential action could not be completed. The current credential was not changed.',
              invalid:
                'Review the required reason before changing this QR credential.',
              forbidden:
                'You do not have permission to manage this student QR credential.',
              notFound: 'This student or QR credential is no longer available.',
              conflict:
                'This QR credential changed while you were working. Refresh and try again.',
            })}
          </div>
        )}

        {credentialHistory.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Credential history
            </p>
            <div className="mt-3 space-y-2">
              {credentialHistory.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                >
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
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Scan audit history
              </p>
              <p className="mt-1 text-[0.65rem] font-medium text-slate-500">
                Recent QR lifecycle and resolve attempts recorded by the backend
                audit log.
              </p>
            </div>
            {qrScansQuery.isLoading ? (
              <Loader2
                size={16}
                className="shrink-0 animate-spin text-slate-400"
              />
            ) : (
              <Clock3 size={16} className="shrink-0 text-slate-400" />
            )}
          </div>

          {qrScansQuery.isError ? (
            <div className="mt-3 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-[0.65rem] font-bold text-danger-600">
              {schoolFacingErrorMessage(qrScansQuery.error, {
                fallback:
                  'QR scan audit history could not be loaded. Try again after refreshing the student profile.',
                forbidden:
                  'You do not have permission to view QR scan audit history.',
                notFound:
                  'QR scan audit history is not available for this student.',
              })}
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
            <p className="text-[0.6rem] font-bold uppercase tracking-wider">
              Audit Security Policy
            </p>
          </div>
          <p className="text-[0.65rem] text-slate-500 leading-relaxed">
            QR Identity uses protected token hashes. Credential secrets are held
            only in backend memory while the protected ID-card artifact is
            generated. Rotation invalidates the previous card and file.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

function QrScanAuditRow({ entry }: { entry: StudentQrScanAudit }) {
  const success = entry.success !== false;
  const actor =
    entry.performedByEmail ??
    entry.scannedByEmail ??
    entry.performedBy ??
    'System';
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

function QrReasonField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
      {label}
      <textarea
        id={id}
        rows={3}
        maxLength={STUDENT_QR_REASON_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Record a clear school-office reason."
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
      />
      <span className="mt-1 flex justify-between text-xs font-normal text-slate-500">
        <span>
          Required · {STUDENT_QR_REASON_MIN_LENGTH}–
          {STUDENT_QR_REASON_MAX_LENGTH} characters
        </span>
        <span>
          {value.length}/{STUDENT_QR_REASON_MAX_LENGTH}
        </span>
      </span>
    </label>
  );
}

function QrActionError({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  if (!error) return null;
  return (
    <p
      className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs font-semibold text-danger-700"
      role="alert"
    >
      {schoolFacingErrorMessage(error, {
        fallback,
        invalid: `Enter a reason between ${STUDENT_QR_REASON_MIN_LENGTH} and ${STUDENT_QR_REASON_MAX_LENGTH} characters.`,
        forbidden:
          'You do not have permission to manage this student QR credential.',
        notFound: 'This student or QR credential is no longer available.',
        conflict:
          'This QR credential changed while you were working. Refresh and try again.',
      })}
    </p>
  );
}

function formatQrAction(action: string) {
  return action.replace(/^QR_/, '').replaceAll('_', ' ').toLowerCase();
}

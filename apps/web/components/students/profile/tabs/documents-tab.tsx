'use client';

import { GeneratedStudentDocumentMeta, StudentDocument } from '@schoolos/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { SectionCard } from '@/components/ui/section-card';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  FileType,
  History,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { openProtectedFile } from '@/lib/api/client';

type DocumentsTabProps = {
  studentId: string;
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  onOpenPdf: (kind: string) => void;
};

const generatedTypes = [
  ['id-card', 'Student ID Card', 'Generate ID card'],
  ['transfer-certificate', 'Transfer Certificate', 'Generate transfer certificate'],
  ['leaving-certificate', 'Leaving Certificate', 'Generate leaving certificate'],
  ['character-certificate', 'Character Certificate', 'Generate character certificate'],
] as const;

const requiredDocuments = [
  { kind: 'BIRTH_CERTIFICATE', label: 'Birth Certificate', required: true },
  { kind: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate', required: false },
  { kind: 'PHOTO', label: 'Student Photo', required: true },
  { kind: 'ID_CARD', label: 'Guardian ID Card', required: true },
] as const;

export function DocumentsTab({
  studentId,
  documents,
  generatedDocuments,
  onOpenPdf,
}: DocumentsTabProps) {
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(
    null,
  );
  const [documentAccessError, setDocumentAccessError] = useState('');
  const historyQuery = useQuery({
    queryKey: ['student-document-history', studentId],
    queryFn: () => api.listStudentDocumentHistory(studentId),
    enabled: Boolean(studentId),
  });
  const documentChecklist = buildDocumentChecklist(documents);
  const documentRiskCounts = documentChecklist.reduce(
    (counts, item) => {
      if (item.state === 'missing') counts.missing += 1;
      if (item.state === 'rejected') counts.rejected += 1;
      if (item.state === 'expired') counts.expired += 1;
      if (item.state === 'expiring') counts.expiring += 1;
      if (item.state === 'unverified') counts.unverified += 1;
      return counts;
    },
    { missing: 0, rejected: 0, expired: 0, expiring: 0, unverified: 0 },
  );

  async function openUploadedDocument(documentId: string) {
    setDocumentAccessError('');
    setOpeningDocumentId(documentId);
    try {
      const access = await api.downloadStudentDocument(studentId, documentId);
      await openProtectedFile(access.fileAssetId, { fileName: access.fileName });
    } catch (error: unknown) {
      setDocumentAccessError(
        error instanceof Error
          ? error.message
          : 'Student document could not be opened.',
      );
    } finally {
      setOpeningDocumentId(null);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      <SectionCard
        title="System Generated Docs"
        description="Official school documents available for this student."
      >
        <div className="grid gap-3">
          {generatedTypes.map(([kind, label, actionLabel]) => {
            const isGenerated = generatedDocuments.some(
              (doc) => doc.kind === kind,
            );
            return (
              <div
                key={kind}
                className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-[var(--color-mod-admissions-border)] hover:bg-[var(--color-mod-admissions-bg)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition',
                      isGenerated
                        ? 'bg-success-500 text-white'
                        : 'bg-white text-slate-400 group-hover:text-[var(--color-mod-admissions-accent)]',
                    )}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{label}</p>
                    <p className="text-[0.7rem] text-slate-500 font-medium">
                      {isGenerated
                        ? 'Protected PDF can be regenerated or opened'
                        : 'Available when backend document rules pass'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPdf(kind)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm transition hover:bg-[var(--color-mod-admissions-accent)] hover:text-white"
                >
                  <ExternalLink size={16} />
                  {actionLabel}
                </button>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Uploaded Documents"
        description="Scanned copies and attachments provided during enrollment."
      >
        <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                Required Checklist
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {formatChecklistSummary(documentRiskCounts)}
              </p>
            </div>
            <Link
              href={`/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}`}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-mod-admissions-border)] bg-white px-4 text-xs font-black uppercase tracking-widest text-[var(--color-mod-admissions-text)] shadow-sm transition hover:bg-slate-50"
            >
              Upload required documents
            </Link>
            <Badge
              variant={
                documentRiskCounts.missing ||
                documentRiskCounts.rejected ||
                documentRiskCounts.expired
                  ? 'destructive'
                  : documentRiskCounts.expiring || documentRiskCounts.unverified
                    ? 'warning'
                    : 'success'
              }
              className="w-fit uppercase tracking-wide"
            >
              {documentRiskCounts.missing ||
              documentRiskCounts.rejected ||
              documentRiskCounts.expired
                ? 'Action needed'
                : documentRiskCounts.expiring || documentRiskCounts.unverified
                  ? 'Review needed'
                  : 'No visible issues'}
            </Badge>
          </div>
          <div className="mt-4 grid gap-2">
            {documentChecklist.map((item) => {
              const Icon = checklistIcon(item.state);
              return (
                <div
                  key={item.kind}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white bg-white/80 p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        checklistIconClass(item.state),
                      )}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {item.label}
                        {item.required ? (
                          <span className="ml-1 text-danger-500">*</span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">
                        {item.message}
                      </p>
                    </div>
                  </div>
                  {item.document ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant={documentStatusVariant(item.document.status)}
                        className="uppercase tracking-wide"
                      >
                        {formatDocumentStatus(item.document.status)}
                      </Badge>
                      <Link
                        href={`/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}&documentId=${encodeURIComponent(item.document.id)}`}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-slate-600 transition hover:border-[var(--color-mod-admissions-border)] hover:text-[var(--color-mod-admissions-text)]"
                      >
                        Replace
                      </Link>
                    </div>
                  ) : (
                    <Link
                      href={`/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}&kind=${encodeURIComponent(item.kind)}`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-widest text-slate-600 transition hover:border-[var(--color-mod-admissions-border)] hover:text-[var(--color-mod-admissions-text)]"
                    >
                      Upload
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {documentAccessError ? (
          <div className="mb-4 rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-semibold text-danger-700">
            {documentAccessError}
          </div>
        ) : null}
        {documents.length > 0 ? (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                    <FileType size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 truncate max-w-[150px]">
                      {doc.title || doc.kind}
                    </p>
                    <p className="text-[0.7rem] text-slate-500 font-medium">
                      {doc.kind.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={documentStatusVariant(doc.status)}
                    className="uppercase tracking-wide"
                  >
                    {formatDocumentStatus(doc.status)}
                  </Badge>
                  <button
                    type="button"
                    disabled={openingDocumentId === doc.id}
                    onClick={() => void openUploadedDocument(doc.id)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm transition hover:text-[var(--color-mod-admissions-accent)] disabled:cursor-wait disabled:opacity-60"
                  >
                    <Download size={16} />
                    Open
                  </button>
                  <Link
                    href={`/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}&documentId=${encodeURIComponent(doc.id)}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3 text-xs font-black text-slate-600 shadow-sm transition hover:text-[var(--color-mod-admissions-accent)]"
                  >
                    Replace
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
              <ShieldCheck size={32} />
            </div>
            <p className="text-sm font-bold text-slate-900">No uploads found</p>
            <p className="mt-1 text-xs text-slate-400">
              Supporting documents will appear here.
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Document Audit Trail"
        description="Tenant-scoped upload, view, verification, archive, and delete history for this student."
      >
        {historyQuery.isLoading ? (
          <div className="grid gap-3">
            <div className="h-16 animate-pulse rounded-2xl bg-slate-50" />
            <div className="h-16 animate-pulse rounded-2xl bg-slate-50" />
          </div>
        ) : historyQuery.isError ? (
          <div className="rounded-2xl border border-danger-100 bg-danger-50 p-4 text-sm font-semibold text-danger-700">
            Document history could not load. Please retry from the documents workspace.
          </div>
        ) : (historyQuery.data ?? []).length > 0 ? (
          <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
            {(historyQuery.data ?? []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                      <History size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {formatHistoryAction(entry.action)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {entry.documentTitle ??
                          entry.documentKind ??
                          'Student document'}
                      </p>
                      {entry.reason ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {entry.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="shrink-0 text-right text-[0.65rem] font-bold uppercase tracking-widest text-slate-400">
                    {formatDateTime(entry.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
              <History size={32} />
            </div>
            <p className="text-sm font-bold text-slate-900">
              No audit records yet
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Document actions will appear here after upload, view,
              verification, or archive events.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function formatHistoryAction(action: string) {
  return action
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDocumentStatus(status?: string) {
  return (status ?? 'PENDING').replace(/_/g, ' ');
}

function documentStatusVariant(
  status?: string,
): 'success' | 'warning' | 'destructive' | 'neutral' {
  if (status === 'VERIFIED') return 'success';
  if (status === 'REJECTED' || status === 'ARCHIVED') return 'destructive';
  if (status === 'PENDING' || status === 'UPLOADED') return 'warning';
  return 'neutral';
}

type ChecklistState =
  | 'ready'
  | 'missing'
  | 'rejected'
  | 'expired'
  | 'expiring'
  | 'unverified'
  | 'optional';

function buildDocumentChecklist(documents: StudentDocument[]) {
  return requiredDocuments.map((spec) => {
    const document = documents.find((item) => item.kind === spec.kind);
    if (!document) {
      return {
        ...spec,
        document: null,
        state: spec.required ? 'missing' : 'optional',
        message: spec.required ? 'Missing required document.' : 'Optional document not uploaded.',
      } as const;
    }

    if (document.status === 'REJECTED') {
      return {
        ...spec,
        document,
        state: 'rejected',
        message: 'Rejected document needs replacement.',
      } as const;
    }

    const expiry = getExpiryState(document.expiryDate);
    if (expiry.state === 'expired') {
      return {
        ...spec,
        document,
        state: 'expired',
        message: `Expired on ${formatDateOnly(document.expiryDate)}.`,
      } as const;
    }

    if (expiry.state === 'expiring') {
      return {
        ...spec,
        document,
        state: 'expiring',
        message: `Expires in ${expiry.daysUntilExpiry} day${expiry.daysUntilExpiry === 1 ? '' : 's'}.`,
      } as const;
    }

    if (document.status !== 'VERIFIED') {
      return {
        ...spec,
        document,
        state: 'unverified',
        message: 'Uploaded and awaiting verification.',
      } as const;
    }

    return {
      ...spec,
      document,
      state: 'ready',
      message: document.expiryDate
        ? `Verified until ${formatDateOnly(document.expiryDate)}.`
        : 'Verified document on file.',
    } as const;
  });
}

function getExpiryState(value?: string | null) {
  if (!value) {
    return { state: 'none' as const, daysUntilExpiry: null };
  }

  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) {
    return { state: 'none' as const, daysUntilExpiry: null };
  }

  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilExpiry < 0) {
    return { state: 'expired' as const, daysUntilExpiry };
  }

  if (daysUntilExpiry <= 30) {
    return { state: 'expiring' as const, daysUntilExpiry };
  }

  return { state: 'valid' as const, daysUntilExpiry };
}

function formatChecklistSummary(counts: {
  missing: number;
  rejected: number;
  expired: number;
  expiring: number;
  unverified: number;
}) {
  const blocking = counts.missing + counts.rejected + counts.expired;
  if (blocking > 0) {
    return `${blocking} required document issue${blocking === 1 ? '' : 's'} need staff action.`;
  }

  const review = counts.expiring + counts.unverified;
  if (review > 0) {
    return `${review} document${review === 1 ? '' : 's'} should be reviewed before clearance.`;
  }

  return 'No required document issues are visible from uploaded records.';
}

function checklistIcon(state: ChecklistState) {
  if (state === 'ready') return CheckCircle2;
  if (state === 'missing' || state === 'rejected' || state === 'expired') {
    return XCircle;
  }
  if (state === 'expiring') return Clock;
  if (state === 'unverified') return AlertTriangle;
  return FileText;
}

function checklistIconClass(state: ChecklistState) {
  if (state === 'ready') return 'bg-success-50 text-success-600';
  if (state === 'missing' || state === 'rejected' || state === 'expired') {
    return 'bg-danger-50 text-danger-600';
  }
  if (state === 'expiring' || state === 'unverified') {
    return 'bg-warning-50 text-warning-700';
  }
  return 'bg-slate-100 text-slate-500';
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return 'not recorded';
  }

  try {
    return new Intl.DateTimeFormat('en-NP', {
      dateStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return 'date not recorded';
  }
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('en-NP', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return 'Audit date not recorded';
  }
}

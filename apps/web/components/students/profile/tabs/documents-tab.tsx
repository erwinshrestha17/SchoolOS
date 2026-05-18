'use client';

import { GeneratedStudentDocumentMeta, StudentDocument } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { SectionCard } from '@/components/ui/section-card';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  FileType,
  History,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

type DocumentsTabProps = {
  studentId: string;
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  onOpenPdf: (kind: string) => void;
};

const generatedTypes = [
  ['id-card', 'Student ID Card'],
  ['transfer-certificate', 'Transfer Certificate'],
  ['leaving-certificate', 'Leaving Certificate'],
  ['character-certificate', 'Character Certificate'],
] as const;

export function DocumentsTab({
  studentId,
  documents,
  generatedDocuments,
  onOpenPdf,
}: DocumentsTabProps) {
  const historyQuery = useQuery({
    queryKey: ['student-document-history', studentId],
    queryFn: () => api.listStudentDocumentHistory(studentId),
    enabled: Boolean(studentId),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      <SectionCard
        title="System Generated Docs"
        description="Official school documents available for this student."
      >
        <div className="grid gap-3">
          {generatedTypes.map(([kind, label]) => {
            const isGenerated = generatedDocuments.some(
              (doc) => doc.kind === kind,
            );
            return (
              <div
                key={kind}
                className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-primary-200 hover:bg-primary-50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition',
                      isGenerated
                        ? 'bg-success-500 text-white'
                        : 'bg-white text-slate-400 group-hover:text-primary-500',
                    )}
                  >
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{label}</p>
                    <p className="text-[0.7rem] text-slate-500 font-medium">
                      {isGenerated
                        ? 'Ready for Download'
                        : 'Generation Required'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPdf(kind)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition hover:bg-primary-500 hover:text-white"
                >
                  <ExternalLink size={18} />
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
        {documents.length > 0 ? (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm">
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
                    variant="phase2"
                    className="bg-success-50 text-success-600 border-success-100"
                  >
                    Verified
                  </Badge>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm hover:text-primary-500"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[2rem] bg-slate-50 text-slate-300">
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
            {historyQuery.error.message}
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm">
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
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[2rem] bg-slate-50 text-slate-300">
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

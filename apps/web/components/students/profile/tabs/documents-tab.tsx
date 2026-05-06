'use client';

import { GeneratedStudentDocumentMeta, StudentDocument } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { FileText, Download, ExternalLink, ShieldCheck, FileType } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  return (
    <div className="grid gap-8 lg:grid-cols-2 animate-fade-in">
      <SectionCard title="System Generated Docs" description="Official school documents available for this student.">
        <div className="grid gap-3">
          {generatedTypes.map(([kind, label]) => {
            const isGenerated = generatedDocuments.some((doc) => doc.kind === kind);
            return (
              <div key={kind} className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-primary-200 hover:bg-primary-50">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition",
                    isGenerated ? "bg-success-500 text-white" : "bg-white text-slate-400 group-hover:text-primary-500"
                  )}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{label}</p>
                    <p className="text-[0.7rem] text-slate-500 font-medium">
                      {isGenerated ? 'Ready for Download' : 'Generation Required'}
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

      <SectionCard title="Uploaded Documents" description="Scanned copies and attachments provided during enrollment.">
        {documents.length > 0 ? (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm">
                    <FileType size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 truncate max-w-[150px]">{doc.title || doc.kind}</p>
                    <p className="text-[0.7rem] text-slate-500 font-medium">{doc.kind.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Badge variant="phase2" className="bg-success-50 text-success-600 border-success-100">Verified</Badge>
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
            <p className="mt-1 text-xs text-slate-400">Supporting documents will appear here.</p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

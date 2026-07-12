'use client';

import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { FileText, Download, Award, Calendar, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type AcademicsTabProps = {
  profile: StudentProfileDetail;
  onOpenPdf: (kind: string) => void;
};

export function AcademicsTab({ profile, onOpenPdf }: AcademicsTabProps) {
  const reportCards = (profile.generatedDocuments || []).filter(
    (doc) => doc.kind.toLowerCase() === 'report-card' || doc.kind.toLowerCase() === 'report_card'
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid gap-8 lg:grid-cols-2">
        <SectionCard
          title="Enrollment History"
          description="Historic and current academic placements for this student."
        >
          {profile.enrollments && profile.enrollments.length > 0 ? (
            <div className="space-y-4">
              {profile.enrollments.map((enrollment) => (
                <div
                  key={enrollment.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
                      <Calendar size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">
                        Class {enrollment.className}
                        {enrollment.sectionName ? ` • Section ${enrollment.sectionName}` : ''}
                      </p>
                      <p className="text-[0.7rem] text-slate-500 font-medium">
                        Academic Year: {enrollment.academicYear}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {enrollment.rollNumber && (
                      <Badge variant="neutral" className="bg-slate-100 text-slate-700">
                        Roll: {enrollment.rollNumber}
                      </Badge>
                    )}
                    <Badge
                      variant={enrollment.status.toUpperCase() === 'ACTIVE' ? 'success' : 'neutral'}
                    >
                      {enrollment.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <Calendar size={32} />
              </div>
              <p className="text-sm font-bold text-slate-900">No enrollment records</p>
              <p className="mt-1 text-xs text-slate-400">
                Enrollment history will appear here.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Generated Report Cards"
          description="Download official term results and continuous assessments."
        >
          {reportCards.length > 0 ? (
            <div className="space-y-3">
              {reportCards.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 hover:border-[var(--color-mod-admissions-border)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-500 shadow-sm">
                      <Award size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 truncate max-w-[200px]">
                        {doc.title || 'Report Card'}
                      </p>
                      <p className="text-[0.7rem] text-slate-500 font-medium">
                        Version {doc.version} • {doc.contentType || 'PDF'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.revokedAt ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenPdf(doc.kind)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm transition hover:bg-[var(--color-mod-admissions-accent)] hover:text-white"
                        aria-label="Download Report Card"
                      >
                        <Download size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
                <FileText size={32} />
              </div>
              <p className="text-sm font-bold text-slate-900">No report cards generated yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Generate report cards in the Academics module to make them available here.
              </p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

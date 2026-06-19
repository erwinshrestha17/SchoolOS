'use client';

import type { StudentDocument, StudentProfile } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileCheck2, FileClock, FileWarning, Search, ShieldCheck, Upload } from 'lucide-react';
import { useDeferredValue, useRef, useState } from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { KpiCard, KpiGrid } from '../ui/kpi-card';
import { LoadingState } from '../ui/loading-state';
import { ProtectedFileButton } from '../ui/protected-file';
import { StatusBadge } from '../ui/status-badge';
import { Toast } from '../ui/toast';

export function StudentDocumentsWorkspace() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<StudentDocument | null>(null);
  const [documentKind, setDocumentKind] = useState('BIRTH_CERTIFICATE');
  const [toast, setToast] = useState<{ tone: 'success' | 'danger'; title: string; description: string } | null>(null);
  const searchParams = useSearchParams();

  const studentsQuery = useQuery({
    queryKey: ['students', 'documents-workspace', deferredSearch],
    queryFn: () => api.listStudents({ search: deferredSearch || undefined, page: 1, limit: 30 }),
  });
  const profileQuery = useQuery({
    queryKey: ['student-profile', selectedStudent?.id],
    queryFn: () => api.getStudentProfile(selectedStudent!.id),
    enabled: Boolean(selectedStudent),
  });
  const historyQuery = useQuery({
    queryKey: ['student-document-history', selectedStudent?.id],
    queryFn: () => api.listStudentDocumentHistory(selectedStudent!.id),
    enabled: Boolean(selectedStudent),
  });

  useEffect(() => {
    const requestedId = searchParams.get('student');
    if (!requestedId || selectedStudent?.id === requestedId) return;
    const requestedStudent = studentsQuery.data?.items.find((student) => student.id === requestedId);
    if (requestedStudent) setSelectedStudent(requestedStudent);
  }, [searchParams, selectedStudent?.id, studentsQuery.data]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedStudent) throw new Error('Select a student before uploading.');
      const payload = await fileToBase64Payload(file);
      return api.uploadStudentDocument({
        studentId: selectedStudent.id,
        kind: documentKind,
        title: file.name,
        fileName: payload.fileName,
        contentType: payload.contentType,
        base64Content: payload.base64Content,
      });
    },
    onSuccess: () => {
      setToast({ tone: 'success', title: 'Document uploaded', description: 'The file was stored through the protected student document flow.' });
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) => setToast({ tone: 'danger', title: 'Upload failed', description: error instanceof Error ? error.message : 'The document could not be uploaded.' }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ documentId, status }: { documentId: string; status: 'VERIFIED' | 'REJECTED' }) => api.verifyStudentDocument(documentId, { status, notes: status === 'VERIFIED' ? 'Verified from M1 document workspace' : 'Rejected during document review' }),
    onSuccess: () => {
      setToast({ tone: 'success', title: 'Verification updated', description: 'The backend recorded the document review and audit metadata.' });
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) => setToast({ tone: 'danger', title: 'Verification failed', description: error instanceof Error ? error.message : 'The review could not be saved.' }),
  });

  if (studentsQuery.isLoading) return <LoadingState variant="page" label="Loading student documents…" />;
  if (studentsQuery.isError) return <ErrorState title="Student records could not load" message="No files were changed." onRetry={() => void studentsQuery.refetch()} />;

  const documents = profileQuery.data?.documents ?? [];
  const verified = documents.filter((document) => document.status === 'VERIFIED').length;
  const pending = documents.filter((document) => !document.status || document.status === 'PENDING' || document.status === 'UPLOADED').length;
  const rejected = documents.filter((document) => document.status === 'REJECTED').length;
  const expiring = documents.filter((document) => document.expiryDate && new Date(document.expiryDate).getTime() < Date.now() + 30 * 86400000).length;

  return (
    <div className="space-y-6">
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}
      <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMutation.mutate(file); event.currentTarget.value = ''; }} />

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-sm font-black text-slate-950">Select Student</h2>
          <label className="relative mt-3 block"><span className="sr-only">Search students</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or admission no." className="pl-9" /></label>
          <div className="mt-3 max-h-[620px] space-y-1 overflow-y-auto">
            {(studentsQuery.data?.items ?? []).map((student) => {
              const name = student.fullNameEn || [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') || 'Unnamed student';
              return <button key={student.id} type="button" onClick={() => { setSelectedStudent(student); setSelectedDocument(null); }} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${selectedStudent?.id === student.id ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-slate-50'}`}><Avatar src={student.photoUrl} initials={name.slice(0, 2)} size="sm" /><span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{name}</strong><span className="block truncate text-[0.68rem] text-slate-500">{student.studentSystemId}</span></span></button>;
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedStudent ? <EmptyState title="Select a student" description="Choose a student to review guardians, document checklist, protected files, and verification history." /> : profileQuery.isLoading ? <LoadingState variant="skeleton" label="Loading protected student record…" /> : profileQuery.isError || !profileQuery.data ? <ErrorState title="Student documents could not load" message="No files were changed." onRetry={() => void profileQuery.refetch()} /> : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4"><Avatar src={profileQuery.data.student.photoUrl} initials={(profileQuery.data.student.fullNameEn ?? 'ST').slice(0, 2)} size="lg" /><div><div className="flex items-center gap-2"><h2 className="text-lg font-black text-slate-950">{profileQuery.data.student.fullNameEn}</h2><StatusBadge status={profileQuery.data.student.lifecycleStatus ?? 'ACTIVE'} /></div><p className="mt-1 text-xs font-semibold text-slate-500">{profileQuery.data.student.studentSystemId} · {profileQuery.data.student.className ?? 'No class'} / {profileQuery.data.student.sectionName ?? 'No section'}</p></div></div>
                  <div className="flex flex-wrap gap-2"><select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)} className="w-48"><option value="BIRTH_CERTIFICATE">Birth Certificate</option><option value="CITIZENSHIP">Citizenship</option><option value="TRANSFER_CERTIFICATE">Transfer Certificate</option><option value="MEDICAL_REPORT">Medical Report</option><option value="PHOTO">Photo</option><option value="OTHER">Other</option></select><Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}><Upload className="h-4 w-4" />{uploadMutation.isPending ? 'Uploading…' : 'Upload Document'}</Button></div>
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <KpiCard title="Total" value={documents.length} icon={<FileCheck2 size={18} />} tone="info" />
                <KpiCard title="Verified" value={verified} icon={<CheckCircle2 size={18} />} tone="success" />
                <KpiCard title="Pending" value={pending} icon={<FileClock size={18} />} tone="warning" />
                <KpiCard title="Missing" value="Unavailable" icon={<FileWarning size={18} />} tone="neutral" />
                <KpiCard title="Expiring" value={expiring} icon={<FileClock size={18} />} tone={expiring ? 'warning' : 'success'} />
                <KpiCard title="Rejected" value={rejected} icon={<FileWarning size={18} />} tone={rejected ? 'danger' : 'success'} />
              </div>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4"><h2 className="text-base font-black text-slate-950">Document Vault</h2><p className="mt-1 text-xs text-slate-500">Protected files linked to this student through File Registry.</p></div>
                {documents.length === 0 ? <EmptyState title="No documents uploaded" description="Upload the first protected document for this student." /> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Document Type</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Uploaded On</th><th className="px-4 py-3">Expiry Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{documents.map((document) => <tr key={document.id} onClick={() => setSelectedDocument(document)} className={`cursor-pointer ${selectedDocument?.id === document.id ? 'bg-primary-50' : 'hover:bg-slate-50'}`}><td className="px-4 py-3 font-bold text-slate-900">{document.kind.replace(/_/g, ' ')}</td><td className="max-w-52 truncate px-4 py-3 text-slate-600">{document.fileName}</td><td className="px-4 py-3 text-slate-600">{new Date(document.uploadedAt).toLocaleDateString()}</td><td className="px-4 py-3 text-slate-600">{document.expiryDate ? new Date(document.expiryDate).toLocaleDateString() : '—'}</td><td className="px-4 py-3"><StatusBadge status={document.status ?? 'PENDING'} /></td><td className="px-4 py-3"><ProtectedFileButton fileAssetId={document.fileId} fileName={document.fileName} action="preview" size="sm" showStatus={false}>Preview</ProtectedFileButton></td></tr>)}</tbody></table></div>}
              </section>
            </>
          )}
        </main>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24" aria-label="Document inspector">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4"><ShieldCheck className="h-5 w-5 text-primary-600" /><h2 className="text-base font-black text-slate-950">Document Inspector</h2></div>
          {!selectedDocument ? <p className="py-10 text-center text-sm text-slate-500">Select a document to view protected file controls, metadata, verification, and audit history.</p> : <div className="space-y-4 pt-4">
            <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{selectedDocument.kind.replace(/_/g, ' ')}</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{selectedDocument.fileName}</p></div>
            <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={selectedDocument.status ?? 'PENDING'} /></dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Size</dt><dd className="font-bold">{Math.ceil(selectedDocument.sizeBytes / 1024)} KB</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Uploaded</dt><dd className="font-bold">{new Date(selectedDocument.uploadedAt).toLocaleString()}</dd></div></dl>
            <div className="grid gap-2"><ProtectedFileButton fileAssetId={selectedDocument.fileId} fileName={selectedDocument.fileName} action="preview" className="w-full">Open protected preview</ProtectedFileButton><ProtectedFileButton fileAssetId={selectedDocument.fileId} fileName={selectedDocument.fileName} action="download" className="w-full">Download protected file</ProtectedFileButton><Button type="button" variant="outline" onClick={() => verifyMutation.mutate({ documentId: selectedDocument.id, status: 'VERIFIED' })} disabled={verifyMutation.isPending}>Verify document</Button><Button type="button" variant="outline" onClick={() => verifyMutation.mutate({ documentId: selectedDocument.id, status: 'REJECTED' })} disabled={verifyMutation.isPending}>Reject document</Button></div>
            <div className="border-t border-slate-100 pt-4"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Audit history</h3><div className="mt-3 space-y-3">{(historyQuery.data ?? []).filter((entry) => !entry.documentId || entry.documentId === selectedDocument.id).slice(0, 6).map((entry) => <div key={entry.id} className="border-l-2 border-primary-200 pl-3 text-xs"><p className="font-bold text-slate-800">{entry.action.replace(/_/g, ' ')}</p><p className="mt-0.5 text-slate-500">{new Date(entry.createdAt).toLocaleString()} · {entry.performedBy}</p></div>)}{historyQuery.data?.length === 0 ? <p className="text-xs text-slate-500">No audit events returned.</p> : null}</div></div>
          </div>}
        </aside>
      </div>
    </div>
  );
}

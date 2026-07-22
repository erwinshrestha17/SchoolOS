'use client';

import { formatBsDate, formatBsDateTime, parseBsDateInput, toGregorianDateFromBs, type StudentDocument, type StudentProfile } from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, Download, ExternalLink, FileCheck2, FileClock, FileWarning, Loader2, Search, ShieldCheck, Upload } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../lib/api';
import { ApiRequestError, downloadProtectedFile, openProtectedFile } from '../../lib/api/client';
import { fileToBase64Payload } from '../../lib/files';
import { schoolFacingErrorMessage } from '../../lib/school-facing-error';
import { Avatar } from '../ui/avatar';
import { Button, type ButtonProps } from '../ui/button';
import { BsDateField } from '../ui/bs-date-field';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { EmptyState } from '../ui/empty-state';
import { KpiCard } from '../ui/kpi-card';
import { LoadingState } from '../ui/loading-state';
import { ModuleLockedState } from '../ui/module-locked-state';
import { PageState } from '../ui/page-state';
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
  const [guardianToRemove, setGuardianToRemove] = useState<{ id: string; name: string; isPrimary: boolean } | null>(null);
  const [guardianRemovalReason, setGuardianRemovalReason] = useState('');
  const [guardianRemovalReplacementId, setGuardianRemovalReplacementId] = useState('');
  const [guardianRemovalAccessReviewed, setGuardianRemovalAccessReviewed] = useState(false);
  const [documentToArchive, setDocumentToArchive] = useState<StudentDocument | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [reviewReason, setReviewReason] = useState('');
  const [uploadReason, setUploadReason] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadExpiryDateBs, setUploadExpiryDateBs] = useState('');
  const [uploadMetadataError, setUploadMetadataError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const requestedStudentId = searchParams.get('studentId') ?? searchParams.get('student');
  const requestedDocumentId = searchParams.get('documentId');
  const requestedKind = searchParams.get('kind');

  const studentsQuery = useQuery({
    queryKey: ['students', 'documents-workspace', deferredSearch],
    queryFn: () => api.listStudents({ search: deferredSearch || undefined, page: 1, limit: 30 }),
  });
  const requestedProfileQuery = useQuery({
    queryKey: ['student-profile', requestedStudentId],
    queryFn: () => api.getStudentProfile(requestedStudentId!),
    enabled: Boolean(requestedStudentId) && selectedStudent?.id !== requestedStudentId,
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
  const expiryTemplatesQuery = useQuery({
    queryKey: ['student-document-expiry-templates'],
    queryFn: api.listDocumentExpiryTemplates,
  });

  useEffect(() => {
    if (requestedKind) setDocumentKind(requestedKind);
  }, [requestedKind]);

  useEffect(() => {
    if (!requestedStudentId || selectedStudent?.id === requestedStudentId) return;
    const requestedStudent = studentsQuery.data?.items.find((student) => student.id === requestedStudentId);
    if (requestedStudent) {
      setSelectedStudent(requestedStudent);
      setSelectedDocument(null);
    }
  }, [requestedStudentId, selectedStudent?.id, studentsQuery.data]);

  useEffect(() => {
    if (!requestedStudentId || selectedStudent?.id === requestedStudentId) return;
    if (requestedProfileQuery.data?.student) {
      setSelectedStudent(requestedProfileQuery.data.student);
      setSelectedDocument(null);
    }
  }, [requestedProfileQuery.data, requestedStudentId, selectedStudent?.id]);

  useEffect(() => {
    if (!requestedDocumentId || selectedDocument?.id === requestedDocumentId) return;
    const requestedDocument = profileQuery.data?.documents.find((document) => document.id === requestedDocumentId);
    if (requestedDocument) setSelectedDocument(requestedDocument);
  }, [profileQuery.data, requestedDocumentId, selectedDocument?.id]);

  useEffect(() => {
    if (!selectedDocument) return;
    setDocumentKind(selectedDocument.kind);
    setUploadMetadataError(null);
  }, [selectedDocument]);

  function buildUploadMetadata() {
    const trimmedReason = uploadReason.trim();
    if (selectedDocument && trimmedReason.length < 5) {
      throw new Error('Enter a replacement reason before uploading this document.');
    }

    let expiryDate: string | null = null;
    if (uploadExpiryDateBs.trim()) {
      const gregorian = toGregorianDateFromBs(parseBsDateInput(uploadExpiryDateBs));
      expiryDate = `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
    }

    return {
      expiryDate,
      notes: uploadNotes.trim() || null,
      reason: trimmedReason || null,
    };
  }

  function handleUploadFile(file: File) {
    try {
      buildUploadMetadata();
      setUploadMetadataError(null);
      uploadMutation.mutate(file);
    } catch {
      setUploadMetadataError(
        'Review the replacement reason and expiry date before sending this file.',
      );
    }
  }

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedStudent) throw new Error('Select a student before uploading.');
      const metadata = buildUploadMetadata();
      const payload = await fileToBase64Payload(file);
      return api.uploadStudentDocument({
        studentId: selectedStudent.id,
        kind: documentKind,
        title: file.name,
        fileName: payload.fileName,
        contentType: payload.contentType,
        base64Content: payload.base64Content,
        expiryDate: metadata.expiryDate,
        notes: metadata.notes,
        reason: metadata.reason,
      });
    },
    onSuccess: () => {
      setToast({ tone: 'success', title: 'Document uploaded', description: 'The file is pending school review and is not complete until verified.' });
      setUploadReason('');
      setUploadNotes('');
      setUploadExpiryDateBs('');
      setUploadMetadataError(null);
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) =>
      setToast({
        tone: 'danger',
        title: 'Upload failed',
        description: schoolFacingErrorMessage(error, {
          fallback:
            'The document could not be uploaded. No existing document was replaced.',
          invalid:
            'Review the file type, size, replacement reason, and expiry date before uploading.',
          forbidden:
            'You do not have permission to upload documents for this student.',
          notFound: 'This student record is no longer available.',
          conflict:
            'This document record changed while the upload was prepared. Refresh and try again.',
          payloadTooLarge:
            'The selected document is too large. Choose a smaller PDF or image and try again.',
        }),
      }),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ documentId, status, notes }: { documentId: string; status: 'VERIFIED' | 'REJECTED'; notes: string }) => api.verifyStudentDocument(documentId, { status, notes }),
    onSuccess: () => {
      setReviewReason('');
      setToast({ tone: 'success', title: 'Verification updated', description: 'The backend recorded the document review and audit metadata.' });
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) =>
      setToast({
        tone: 'danger',
        title: 'Verification failed',
        description: schoolFacingErrorMessage(error, {
          fallback:
            'The document review could not be saved. Its verification status was not changed.',
          invalid:
            'Select a valid review result and record the required review note.',
          forbidden:
            'You do not have permission to verify this student document.',
          notFound: 'This student document is no longer available.',
          conflict:
            'This document changed during review. Refresh the student record and try again.',
        }),
      }),
  });
  const archiveMutation = useMutation({
    mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
      api.archiveStudentDocument(documentId, { reason }),
    onSuccess: () => {
      setToast({ tone: 'success', title: 'Document archived', description: 'The backend archived the document and recorded the audit reason.' });
      setDocumentToArchive(null);
      setArchiveReason('');
      setSelectedDocument(null);
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) =>
      setToast({
        tone: 'danger',
        title: 'Archive failed',
        description: schoolFacingErrorMessage(error, {
          fallback:
            'The document could not be archived. It remains available under its current status.',
          invalid:
            'Record the required archive reason before continuing.',
          forbidden:
            'You do not have permission to archive this student document.',
          notFound: 'This student document is no longer available.',
          conflict:
            'This document changed before it could be archived. Refresh and try again.',
        }),
      }),
  });
  const removeGuardianMutation = useMutation({
    mutationFn: () => {
      if (!selectedStudent || !guardianToRemove) throw new Error('Select a guardian link to remove.');
      if (!guardianRemovalAccessReviewed) throw new Error('Confirm guardian portal and protected-file access review before revoking access.');
      if (guardianToRemove.isPrimary && !guardianRemovalReplacementId) throw new Error('Choose another primary guardian before removing this one.');
      return api.removeStudentGuardianAccess(selectedStudent.id, guardianToRemove.id, {
        reason: guardianRemovalReason,
        confirmFileAccessReview: guardianRemovalAccessReviewed,
        newPrimaryGuardianId: guardianToRemove.isPrimary ? guardianRemovalReplacementId : null,
      });
    },
    onSuccess: () => {
      setToast({ tone: 'success', title: 'Guardian access revoked', description: 'The relationship was removed and protected-file access review was recorded.' });
      setGuardianToRemove(null);
      setGuardianRemovalReason('');
      setGuardianRemovalReplacementId('');
      setGuardianRemovalAccessReviewed(false);
      void queryClient.invalidateQueries({ queryKey: ['student-profile', selectedStudent?.id] });
      void queryClient.invalidateQueries({ queryKey: ['student-document-history', selectedStudent?.id] });
    },
    onError: (error) =>
      setToast({
        tone: 'danger',
        title: 'Guardian access was not changed',
        description: schoolFacingErrorMessage(error, {
          fallback:
            'Guardian access was not changed. Review the relationship and try again.',
          invalid:
            'Review the removal reason, protected-file access confirmation, and replacement primary guardian.',
          forbidden:
            'You do not have permission to remove this guardian relationship.',
          notFound:
            'This student or guardian relationship is no longer available.',
          conflict:
            'This guardian relationship changed while you were working. Refresh and try again.',
        }),
      }),
  });

  if (studentsQuery.isLoading && !requestedStudentId) return <LoadingState variant="page" label="Loading student documents…" />;
  if (studentsQuery.isError && !requestedStudentId) {
    return <DocumentWorkspaceFailure error={studentsQuery.error} onRetry={() => void studentsQuery.refetch()} />;
  }

  const documents = profileQuery.data?.documents ?? [];
  const verified = documents.filter((document) => document.status === 'VERIFIED').length;
  const pending = documents.filter((document) => !document.status || document.status === 'ACTIVE' || document.status === 'PENDING' || document.status === 'UPLOADED').length;
  const rejected = documents.filter((document) => document.status === 'REJECTED').length;
  const expiring = documents.filter((document) => document.expiryDate && new Date(document.expiryDate).getTime() < Date.now() + 30 * 86400000).length;

  return (
    <div className="space-y-6">
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}
      <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleUploadFile(file); event.currentTarget.value = ''; }} />

      <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-sm font-black text-slate-950">Select Student</h2>
          <label className="relative mt-3 block"><span className="sr-only">Search students</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or admission no." className="pl-9" /></label>
          <div className="mt-3 max-h-[620px] space-y-1 overflow-y-auto">
            {studentsQuery.isLoading ? <p className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-500">Loading student list…</p> : null}
            {studentsQuery.isError ? <p className="rounded-xl border border-warning-100 bg-warning-50 p-3 text-xs font-semibold text-warning-800">Student list is unavailable. The linked student record can still load from the protected profile route.</p> : null}
            {(studentsQuery.data?.items ?? []).map((student) => {
              const name = student.fullNameEn || [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' ') || 'Unnamed student';
              return <button key={student.id} type="button" onClick={() => { setSelectedStudent(student); setSelectedDocument(null); }} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left transition ${selectedStudent?.id === student.id ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-slate-50'}`}><Avatar initials={name.slice(0, 2)} size="sm" /><span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{name}</strong><span className="block truncate text-[0.68rem] text-slate-500">{student.studentSystemId}</span></span></button>;
            })}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedStudent ? (
            requestedStudentId && requestedProfileQuery.isError ? (
              <DocumentWorkspaceFailure error={requestedProfileQuery.error} onRetry={() => void requestedProfileQuery.refetch()} />
            ) : requestedStudentId ? (
              <LoadingState variant="skeleton" label="Loading linked student documents…" />
            ) : (
              <EmptyState title="Select a student" description="Choose a student to review guardians, document checklist, protected files, and verification history." />
            )
          ) : profileQuery.isLoading ? <LoadingState variant="skeleton" label="Loading protected student record…" /> : profileQuery.isError || !profileQuery.data ? <DocumentWorkspaceFailure error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /> : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-center gap-4"><Avatar initials={(profileQuery.data.student.fullNameEn ?? 'ST').slice(0, 2)} size="lg" /><div><div className="flex items-center gap-2"><h2 className="text-lg font-black text-slate-950">{profileQuery.data.student.fullNameEn}</h2><StatusBadge status={profileQuery.data.student.lifecycleStatus ?? 'ACTIVE'} /></div><p className="mt-1 text-xs font-semibold text-slate-500">{profileQuery.data.student.studentSystemId} · {profileQuery.data.student.className ?? 'No class'} / {profileQuery.data.student.sectionName ?? 'No section'}</p>{selectedDocument ? <p className="mt-2 rounded-xl border border-warning-100 bg-warning-50 px-3 py-2 text-xs font-semibold text-warning-800">Uploading now will create a replacement record for {selectedDocument.fileName}. The existing record is not silently changed.</p> : null}</div></div>
                  <div className="grid w-full gap-3 md:max-w-xl">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700">Document type<select value={documentKind} onChange={(event) => setDocumentKind(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"><option value="BIRTH_CERTIFICATE">Birth Certificate</option><option value="CITIZENSHIP">Citizenship</option><option value="TRANSFER_CERTIFICATE">Transfer Certificate</option><option value="MEDICAL_REPORT">Medical Report</option><option value="PHOTO">Photo</option><option value="OTHER">Other</option></select></label>
                      <BsDateField label="Expiry date (BS)" value={uploadExpiryDateBs} onChange={(value) => { setUploadExpiryDateBs(value); setUploadMetadataError(null); }} error={uploadMetadataError?.toLowerCase().includes('date') ? uploadMetadataError : null} placeholder="2083-01-01" />
                    </div>
                    <label className="block text-sm font-semibold text-slate-700">{selectedDocument ? 'Replacement reason' : 'Upload reason'}<input value={uploadReason} onChange={(event) => { setUploadReason(event.target.value); setUploadMetadataError(null); }} placeholder={selectedDocument ? 'Why is this document being replaced?' : 'Optional upload reason'} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5" /></label>
                    <label className="block text-sm font-semibold text-slate-700">Review note<textarea rows={2} value={uploadNotes} onChange={(event) => setUploadNotes(event.target.value)} placeholder="Optional note for school review" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5" /></label>
                    {uploadMetadataError && !uploadMetadataError.toLowerCase().includes('date') ? <p className="text-xs font-semibold text-danger-700">{uploadMetadataError}</p> : null}
                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedDocument ? <Button type="button" variant="outline" onClick={() => { setSelectedDocument(null); setUploadReason(''); setUploadNotes(''); setUploadMetadataError(null); }}>Clear replacement context</Button> : null}
                      <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending || (Boolean(selectedDocument) && uploadReason.trim().length < 5)}><Upload className="h-4 w-4" />{uploadMutation.isPending ? 'Uploading…' : selectedDocument ? 'Upload replacement' : 'Upload document'}</Button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-black text-slate-950">Linked Guardians</h2><p className="mt-1 text-xs text-slate-500">Removing a guardian immediately revokes the student relationship and triggers a protected-file access review.</p></div><StatusBadge status={`${profileQuery.data.guardians.length} LINKED`} tone="info" /></div>
                {profileQuery.data.guardians.length === 0 ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No guardians are linked.</p> : <div className="mt-4 grid gap-3 md:grid-cols-2">{profileQuery.data.guardians.map((guardian) => {
                  const isOnlyGuardian = profileQuery.data.guardians.length <= 1;
                  return <article key={guardian.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black text-slate-900">{guardian.fullName}</h3>{guardian.isPrimary ? <StatusBadge status="PRIMARY" tone="info" /> : null}</div><p className="mt-1 text-xs font-semibold text-slate-500">{guardian.relation} · {guardian.primaryPhone}</p><p className="mt-1 text-xs text-slate-500">{guardian.email ?? 'Email not recorded'}</p></div><Button type="button" size="sm" variant="outline" disabled={isOnlyGuardian} title={isOnlyGuardian ? 'A student must have at least one guardian.' : undefined} onClick={() => { setGuardianToRemove({ id: guardian.id, name: guardian.fullName, isPrimary: guardian.isPrimary }); setGuardianRemovalReplacementId(''); setGuardianRemovalAccessReviewed(false); }}>Revoke access</Button></div></article>;
                })}</div>}
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard title="Total" value={documents.length} icon={<FileCheck2 size={18} />} tone="info" />
                <KpiCard title="Verified" value={verified} icon={<CheckCircle2 size={18} />} tone="success" />
                <KpiCard title="Pending" value={pending} icon={<FileClock size={18} />} tone="warning" />
                <KpiCard title="Expiring" value={expiring} icon={<FileClock size={18} />} tone={expiring ? 'warning' : 'success'} />
                <KpiCard title="Rejected" value={rejected} icon={<FileWarning size={18} />} tone={rejected ? 'danger' : 'success'} />
              </div>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4"><h2 className="text-base font-black text-slate-950">Document Vault</h2><p className="mt-1 text-xs text-slate-500">Protected files linked to this student through File Registry.</p></div>
                {documents.length === 0 ? <EmptyState title="No documents uploaded" description="Upload the first protected document for this student." /> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Document Type</th><th className="px-4 py-3">File</th><th className="px-4 py-3">Uploaded On</th><th className="px-4 py-3">Expiry Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{documents.map((document) => <tr key={document.id} onClick={() => setSelectedDocument(document)} className={`cursor-pointer ${selectedDocument?.id === document.id ? 'bg-primary-50' : 'hover:bg-slate-50'}`}><td className="px-4 py-3 font-bold text-slate-900">{document.kind.replace(/_/g, ' ')}</td><td className="max-w-52 truncate px-4 py-3 text-slate-600">{document.fileName}</td><td className="px-4 py-3 text-slate-600">{formatBsDate(document.uploadedAt)}</td><td className="px-4 py-3 text-slate-600">{document.expiryDate ? formatBsDate(document.expiryDate) : '—'}</td><td className="px-4 py-3"><StatusBadge status={formatDocumentStatus(document.status)} /></td><td className="px-4 py-3"><StudentDocumentAccessButton studentId={profileQuery.data.student.id} document={document} action="preview" size="sm" showStatus={false}>View protected file</StudentDocumentAccessButton></td></tr>)}</tbody></table></div>}
              </section>
            </>
          )}
        </main>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-24" aria-label="Document inspector">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4"><ShieldCheck className="h-5 w-5 text-primary-600" /><h2 className="text-base font-black text-slate-950">Document Inspector</h2></div>
          <div className="border-b border-slate-100 py-4"><div className="flex items-center justify-between"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Expiry reminders</h3><StatusBadge status={`${expiryTemplatesQuery.data?.filter((item) => item.isActive).length ?? 0} ACTIVE`} tone="info" /></div>{expiryTemplatesQuery.isError ? <p className="mt-2 text-xs font-bold text-danger-700">Expiry policies could not load.</p> : (expiryTemplatesQuery.data?.length ?? 0) === 0 ? <p className="mt-2 text-xs text-slate-500">No document-expiry reminder templates configured.</p> : <div className="mt-2 space-y-2">{expiryTemplatesQuery.data?.slice(0, 4).map((template) => <div key={template.id} className="rounded-lg bg-slate-50 p-2 text-xs"><p className="font-bold text-slate-800">{template.reminderStatus} · {template.channel}</p><p className="mt-0.5 text-slate-500">{template.daysBeforeExpiry ? `${template.daysBeforeExpiry} days before expiry` : 'At expiry'} · {template.isActive ? 'Active' : 'Inactive'}</p></div>)}</div>}</div>
          {!selectedDocument ? <p className="py-10 text-center text-sm text-slate-500">Select a document to view protected file controls, metadata, verification, and audit history.</p> : <div className="space-y-4 pt-4">
            <div><p className="text-xs font-black uppercase tracking-wide text-slate-500">{selectedDocument.kind.replace(/_/g, ' ')}</p><p className="mt-1 break-all text-sm font-bold text-slate-900">{selectedDocument.fileName}</p></div>
            <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><StatusBadge status={formatDocumentStatus(selectedDocument.status)} /></dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Size</dt><dd className="font-bold">{Math.ceil(selectedDocument.sizeBytes / 1024)} KB</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Uploaded</dt><dd className="font-bold">{formatBsDateTime(selectedDocument.uploadedAt)}</dd></div></dl>
            {selectedDocument.status === 'REJECTED' && selectedDocument.notes ? <p className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-xs font-semibold text-danger-700">Reviewer note: {latestReviewNote(selectedDocument.notes)}</p> : null}
            <label className="block text-xs font-bold text-slate-700">Review note / rejection reason<textarea rows={3} value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} placeholder="Record review notes. Required when rejecting." className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal" /></label>
            <div className="grid gap-2"><StudentDocumentAccessButton studentId={selectedDocument.studentId} document={selectedDocument} action="preview" className="w-full">Open protected preview</StudentDocumentAccessButton><StudentDocumentAccessButton studentId={selectedDocument.studentId} document={selectedDocument} action="download" className="w-full">Download protected file</StudentDocumentAccessButton><Button type="button" variant="outline" onClick={() => verifyMutation.mutate({ documentId: selectedDocument.id, status: 'VERIFIED', notes: reviewReason.trim() || 'Verified from M1 document workspace' })} disabled={verifyMutation.isPending}>Verify document</Button><Button type="button" variant="outline" onClick={() => verifyMutation.mutate({ documentId: selectedDocument.id, status: 'REJECTED', notes: reviewReason.trim() })} disabled={verifyMutation.isPending || reviewReason.trim().length < 5}>Reject document</Button><Button type="button" variant="destructive" onClick={() => { setDocumentToArchive(selectedDocument); setArchiveReason(''); }} disabled={archiveMutation.isPending || selectedDocument.status === 'ARCHIVED' || selectedDocument.status === 'REPLACED'}><Archive className="h-4 w-4" /> Archive document</Button></div>
            <div className="border-t border-slate-100 pt-4"><h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Audit history</h3>{historyQuery.isError ? <p className="mt-3 rounded-lg border border-warning-100 bg-warning-50 p-2 text-xs font-semibold text-warning-800">Document history could not load. The protected file and admission record were not changed.</p> : <div className="mt-3 space-y-3">{(historyQuery.data ?? []).filter((entry) => !entry.documentId || entry.documentId === selectedDocument.id).slice(0, 6).map((entry) => <div key={entry.id} className="border-l-2 border-primary-200 pl-3 text-xs"><p className="font-bold text-slate-800">{entry.action.replace(/_/g, ' ')}</p><p className="mt-0.5 text-slate-500">{formatBsDateTime(entry.createdAt)} · {entry.performedBy}</p></div>)}{historyQuery.data?.length === 0 ? <p className="text-xs text-slate-500">No audit events returned.</p> : null}</div>}</div>
          </div>}
        </aside>
      </div>

      <ConfirmDialog
        isOpen={Boolean(guardianToRemove)}
        title="Revoke guardian access?"
        description={`Remove ${guardianToRemove?.name ?? 'this guardian'} from the selected student and record the required protected-file access review.`}
        confirmLabel="Revoke guardian access"
        destructive
        isConfirming={removeGuardianMutation.isPending}
        confirmDisabled={guardianRemovalReason.trim().length < 5 || !guardianRemovalAccessReviewed || Boolean(guardianToRemove?.isPrimary && !guardianRemovalReplacementId)}
        onClose={() => { setGuardianToRemove(null); setGuardianRemovalReason(''); setGuardianRemovalReplacementId(''); setGuardianRemovalAccessReviewed(false); }}
        onConfirm={() => removeGuardianMutation.mutate()}
      >
        {guardianToRemove?.isPrimary ? (
          <label className="mb-4 block text-sm font-bold text-slate-700">New primary guardian<select value={guardianRemovalReplacementId} onChange={(event) => setGuardianRemovalReplacementId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"><option value="">Select replacement primary</option>{(profileQuery.data?.guardians ?? []).filter((guardian) => guardian.id !== guardianToRemove.id).map((guardian) => <option key={guardian.id} value={guardian.id}>{guardian.fullName} · {guardian.relation}</option>)}</select></label>
        ) : null}
        <label className="block text-sm font-bold text-slate-700">Audit reason<textarea rows={3} value={guardianRemovalReason} onChange={(event) => setGuardianRemovalReason(event.target.value)} placeholder="Why should this guardian relationship and access be removed?" className="mt-2 font-normal" /></label>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={guardianRemovalAccessReviewed} onChange={(event) => setGuardianRemovalAccessReviewed(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />I reviewed guardian portal and protected-file access before unlinking this guardian.</label>
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={Boolean(documentToArchive)}
        title="Archive student document?"
        description={`Archive ${documentToArchive?.fileName ?? 'this document'} and keep the audit history attached to the student record.`}
        confirmLabel="Archive document"
        destructive
        isConfirming={archiveMutation.isPending}
        confirmDisabled={archiveReason.trim().length < 5}
        onClose={() => { setDocumentToArchive(null); setArchiveReason(''); }}
        onConfirm={() => {
          if (!documentToArchive) return;
          archiveMutation.mutate({ documentId: documentToArchive.id, reason: archiveReason.trim() });
        }}
      >
        <label className="block text-sm font-bold text-slate-700">Archive reason<textarea rows={3} value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} placeholder="Why should this student document be archived?" className="mt-2 font-normal" /></label>
      </ConfirmDialog>
    </div>
  );
}

function StudentDocumentAccessButton({
  studentId,
  document,
  action,
  children,
  showStatus = true,
  ...buttonProps
}: {
  studentId: string;
  document: StudentDocument;
  action: 'preview' | 'download';
  children: ReactNode;
  showStatus?: boolean;
} & Omit<ButtonProps, 'children' | 'onClick' | 'type' | 'isLoading'>) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const isInactiveDocument = document.status === 'ARCHIVED' || document.status === 'REPLACED';
  const Icon = action === 'download' ? Download : ExternalLink;

  async function openDocument() {
    if (isInactiveDocument) {
      setStatus('error');
      setMessage('This document is no longer active.');
      return;
    }

    setStatus('loading');
    setMessage(action === 'download' ? 'Preparing protected download...' : 'Preparing protected preview...');

    try {
      const access =
        action === 'download'
          ? await api.downloadStudentDocument(studentId, document.id)
          : await api.previewStudentDocument(studentId, document.id);

      if (action === 'download') {
        await downloadProtectedFile(access.fileAssetId, access.fileName || document.fileName);
      } else {
        await openProtectedFile(access.fileAssetId, { fileName: access.fileName || document.fileName });
      }

      setStatus('success');
      setMessage(action === 'download' ? 'Protected download started.' : 'Protected preview opened.');
    } catch (error: unknown) {
      setStatus('error');
      setMessage(
        schoolFacingErrorMessage(error, {
          fallback:
            'This protected document is unavailable right now. No document record was changed.',
          forbidden:
            'You do not have permission to open this protected document.',
          notFound:
            'This protected document is missing, expired, or no longer available.',
        }),
      );
    }
  }

  return (
    <span className="inline-flex flex-col">
      <Button
        {...buttonProps}
        type="button"
        disabled={buttonProps.disabled || isInactiveDocument}
        isLoading={status === 'loading'}
        title={isInactiveDocument ? 'This document is no longer active.' : buttonProps.title}
        onClick={(event) => {
          event.stopPropagation();
          void openDocument();
        }}
      >
        {status === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {action === 'download' ? 'Preparing download...' : 'Opening preview...'}
          </>
        ) : (
          <>
            <Icon className="h-4 w-4" />
            {children}
          </>
        )}
      </Button>
      {showStatus && message ? (
        <p
          className={`mt-2 text-xs font-semibold ${status === 'error' ? 'text-danger-700' : 'text-slate-500'}`}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live={status === 'error' ? 'assertive' : 'polite'}
        >
          {message}
        </p>
      ) : null}
    </span>
  );
}

function formatDocumentStatus(status?: string | null) {
  if (!status || status === 'ACTIVE') return 'Pending school review';
  return status.replace(/_/g, ' ');
}

function latestReviewNote(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/^Verification Note:\s*/i, '').trim())
    .filter(Boolean)
    .at(-1) ?? value;
}

function DocumentWorkspaceFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const returnAction = (
    <Link
      href="/dashboard/admissions"
      className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
    >
      Return to admissions
    </Link>
  );

  if (isModuleLockedError(error)) {
    return (
      <ModuleLockedState
        moduleName="Admissions"
        description="Admissions is not enabled for this school. No admission or document records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  if (error instanceof ApiRequestError && error.statusCode === 403) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to view admission documents."
        description="Ask a school administrator for student document access. No admission or document records were changed."
        secondaryAction={returnAction}
      />
    );
  }

  return (
    <PageState
      tone="danger"
      title="We could not load admission documents right now."
      description="Your admission records have not been changed. Try again, or return to the admission queue."
      actionLabel="Try again"
      onAction={onRetry}
      secondaryAction={returnAction}
    />
  );
}

function isModuleLockedError(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.statusCode !== 403) return false;
  const message = error.message.toLowerCase();
  return message.includes('subscription plan') || message.includes('not enabled') || message.includes('module.students');
}

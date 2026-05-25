'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fileToBase64Payload } from '../../lib/files';
import { SectionCard } from '../ui/section-card';
import { Badge } from '../ui/badge';
import { EmptyState } from '../ui/empty-state';
import { StatusBadge } from '../ui/status-badge';
import { cn } from '../../lib/utils';
import { 
  Search, 
  Filter, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  ExternalLink, 
  Trash2, 
  Phone, 
  Calendar, 
  ChevronRight, 
  UserCheck, 
  CreditCard, 
  ShieldAlert,
  Loader2,
  Check
} from 'lucide-react';
import Link from 'next/link';

// Pipeline Stages
const STAGES = [
  { key: 'Inquiry', label: 'Inquiry', desc: 'Basic info registered' },
  { key: 'Applied', label: 'Applied', desc: 'Guardians registered' },
  { key: 'DocumentReview', label: 'Doc Review', desc: 'Reviewing certificates' },
  { key: 'Admitted', label: 'Admitted', desc: 'Active student record' }
] as const;

// Documents to verify
const REQUIRED_DOCS = [
  { kind: 'BIRTH_CERTIFICATE', label: 'Birth Certificate', required: true },
  { kind: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate', required: false },
  { kind: 'PHOTO', label: 'Student Photo', required: true },
  { kind: 'ID_CARD', label: 'Guardian ID Card', required: true }
] as const;

export function AdmissionsPipeline() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);
  
  // File upload state per document kind
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const admissionsQuery = useQuery({ 
    queryKey: ['admissions', search, selectedClassId], 
    queryFn: () => api.listAdmissions({ 
      search: search || undefined, 
      limit: 100 
    }) 
  });

  const selectedAdmission = admissionsQuery.data?.items.find(
    (item) => item.id === selectedAdmissionId
  ) || null;

  // Documents of selected admission
  const documentsQuery = useQuery({
    queryKey: ['student-documents', selectedAdmissionId],
    queryFn: () => api.listStudentDocuments(selectedAdmissionId!),
    enabled: !!selectedAdmissionId
  });

  // Mutations
  const uploadDocMutation = useMutation({
    mutationFn: (payload: any) => api.uploadStudentDocument(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-documents', selectedAdmissionId] });
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      setUploadingKind(null);
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to upload document');
    }
  });

  const verifyDocMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'VERIFIED' | 'REJECTED'; notes: string }) => 
      api.verifyStudentDocument(id, { status, notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-documents', selectedAdmissionId] });
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
      setVerificationNotes('');
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to verify document');
    }
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => api.deleteStudentDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['student-documents', selectedAdmissionId] });
      void queryClient.invalidateQueries({ queryKey: ['admissions'] });
    },
    onError: (err: any) => {
      setActionError(err.message || 'Failed to delete document');
    }
  });

  // Calculate current stage helper
  const getAdmissionStage = (admission: any) => {
    if (admission.latestEnrollment?.status === 'ACTIVE') {
      return 'Admitted';
    } else if (admission.documentCount > 0) {
      return 'DocumentReview';
    } else if (admission.guardians && admission.guardians.length > 0) {
      return 'Applied';
    } else {
      return 'Inquiry';
    }
  };

  // Calculate stage index
  const getStageIndex = (stage: string) => {
    return STAGES.findIndex((s) => s.key === stage);
  };

  // Filter admissions by search, class, and stage tab
  const filteredAdmissions = (admissionsQuery.data?.items ?? []).filter((item) => {
    const classMatch = !selectedClassId || item.className === classesQuery.data?.find(c => c.id === selectedClassId)?.name;
    const stage = getAdmissionStage(item);
    const stageMatch = selectedStage === 'all' || stage === selectedStage;
    return classMatch && stageMatch;
  });

  // Handle document upload
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>, kind: string) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAdmissionId) return;

    setActionError(null);
    setUploadingKind(kind);

    try {
      const payload = await fileToBase64Payload(file);
      uploadDocMutation.mutate({
        studentId: selectedAdmissionId,
        kind,
        title: `${REQUIRED_DOCS.find(d => d.kind === kind)?.label ?? kind} - ${file.name}`,
        fileName: file.name,
        contentType: payload.contentType,
        base64Content: payload.base64Content
      });
    } catch (err: any) {
      setActionError(err.message || 'Error processing file');
      setUploadingKind(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)] min-h-[500px]">
      
      {/* LEFT COLUMN: Pipeline List & Search */}
      <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm h-full">
        {/* Filters Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
              />
            </div>
            
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm border border-slate-200 rounded-2xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">All Classes</option>
              {classesQuery.data?.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          {/* Pipeline Stage Quick Tabs */}
          <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              onClick={() => setSelectedStage('all')}
              className={cn(
                "flex-1 py-1.5 rounded-lg transition-all",
                selectedStage === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              All ({admissionsQuery.data?.items.length ?? 0})
            </button>
            {STAGES.map((stg) => {
              const count = (admissionsQuery.data?.items ?? []).filter(
                (item) => getAdmissionStage(item) === stg.key
              ).length;
              return (
                <button
                  key={stg.key}
                  onClick={() => setSelectedStage(stg.key)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg transition-all",
                    selectedStage === stg.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {stg.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Candidate List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {admissionsQuery.isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 text-primary-500 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">Loading admissions...</p>
            </div>
          ) : filteredAdmissions.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                title="No applicants found"
                description={search || selectedClassId !== '' ? "Try adjustments to search or filters." : "Admit student to populate files."}
              />
            </div>
          ) : (
            filteredAdmissions.map((admission) => {
              const stage = getAdmissionStage(admission);
              const isSelected = selectedAdmissionId === admission.id;
              
              return (
                <div
                  key={admission.id}
                  onClick={() => {
                    setSelectedAdmissionId(admission.id);
                    setActionError(null);
                  }}
                  className={cn(
                    "p-5 cursor-pointer flex items-center justify-between transition-all hover:bg-slate-50",
                    isSelected ? "bg-primary-50/50 hover:bg-primary-50/50 border-l-4 border-primary-500 pl-4" : ""
                  )}
                >
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-slate-900">{admission.fullNameEn}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                      <span>{admission.studentSystemId}</span>
                      <span>•</span>
                      <span>Class {admission.className}</span>
                    </div>
                    {admission.guardians && admission.guardians[0] && (
                      <p className="text-[0.7rem] text-slate-400 font-medium">
                        Guardian: {admission.guardians[0].fullName} ({admission.guardians[0].relation})
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={stage === 'Admitted' ? 'success' : stage === 'DocumentReview' ? 'phase2' : 'info'}>
                      {STAGES.find((s) => s.key === stage)?.label ?? stage}
                    </Badge>
                    <span className="text-[0.65rem] text-slate-400 font-medium">
                      {admission.documentCount} docs
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Stepper & Checklist Workspace */}
      <div className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm h-full">
        {selectedAdmission ? (
          <div className="flex flex-col h-full">
            
            {/* Candidate Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-[0.65rem] font-extrabold uppercase tracking-widest text-primary-500">Pipeline Workspace</span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-1">{selectedAdmission.fullNameEn}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Class {selectedAdmission.className} {selectedAdmission.sectionName ? `• Section ${selectedAdmission.sectionName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/students/${selectedAdmission.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Full Profile
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Visual Stepper */}
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex justify-between items-center relative">
                {/* Background connector line */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-slate-100 -z-10" />
                
                {STAGES.map((stg, idx) => {
                  const currentStage = getAdmissionStage(selectedAdmission);
                  const currentIdx = getStageIndex(currentStage);
                  const isCompleted = idx < currentIdx;
                  const isActive = idx === currentIdx;

                  return (
                    <div key={stg.key} className="flex flex-col items-center gap-1 z-10">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300",
                          isCompleted ? "bg-success-500 border-success-500 text-white shadow-md shadow-success-500/20" :
                          isActive ? "bg-primary-500 border-primary-500 text-white shadow-xl shadow-primary-500/30 scale-110 ring-4 ring-primary-50" :
                          "bg-white border-slate-200 text-slate-400"
                        )}
                      >
                        {isCompleted ? <Check className="h-4 w-4 stroke-[3px]" /> : idx + 1}
                      </div>
                      <span className={cn(
                        "text-[0.68rem] font-bold mt-1",
                        isActive ? "text-slate-900 font-extrabold" : "text-slate-400"
                      )}>
                        {stg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Details and Checklist Tabs */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {actionError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {actionError}
                </div>
              )}

              {/* Grid split of details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Personal & Guardian details */}
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Guardian Contacts</h4>
                    {selectedAdmission.guardians && selectedAdmission.guardians.length > 0 ? (
                      <div className="space-y-4">
                        {selectedAdmission.guardians.map((guar) => (
                          <div key={guar.id} className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-800">{guar.fullName}</p>
                              <p className="text-xs text-slate-500 font-medium capitalize">{guar.relation} {guar.isPrimary && '• Primary'}</p>
                            </div>
                            {guar.primaryPhone && (
                              <a
                                href={`tel:${guar.primaryPhone}`}
                                className="h-8 w-8 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-600 flex items-center justify-center transition-all"
                                title="Call Guardian"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No guardians registered.</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-5 space-y-4">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Academic Placement</h4>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                      <div>
                        <span className="text-[0.65rem] text-slate-400 uppercase">Roll Number</span>
                        <p className="text-slate-800 mt-0.5">{selectedAdmission.rollNumber ?? 'Not assigned'}</p>
                      </div>
                      <div>
                        <span className="text-[0.65rem] text-slate-400 uppercase">Academic Year</span>
                        <p className="text-slate-800 mt-0.5">{selectedAdmission.latestEnrollment?.academicYear ?? 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-[0.65rem] text-slate-400 uppercase">Admission Date</span>
                        <p className="text-slate-800 mt-0.5">
                          {selectedAdmission.latestEnrollment ? new Date(selectedAdmission.latestEnrollment.id).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[0.65rem] text-slate-400 uppercase">Invoice Status</span>
                        <p className="mt-0.5">
                          {selectedAdmission.latestInvoice ? (
                            <span className={cn(
                              "underline",
                              selectedAdmission.latestInvoice.status === 'PAID' ? "text-success-600" : "text-danger-600"
                            )}>
                              {selectedAdmission.latestInvoice.invoiceNumber} ({selectedAdmission.latestInvoice.status})
                            </span>
                          ) : 'No Invoices'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Verification Checklist */}
                <div className="space-y-4 rounded-2xl border border-slate-200 p-5">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Document Checklist</h4>
                  
                  {documentsQuery.isLoading ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-5 w-5 text-primary-500 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {REQUIRED_DOCS.map((docSpec) => {
                        // Find matching document of this kind
                        const match = (documentsQuery.data ?? []).find(
                          (d: any) => d.kind === docSpec.kind
                        );

                        return (
                          <div key={docSpec.kind} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "h-4 w-4 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white",
                                  match?.status === 'VERIFIED' ? "bg-success-500" : 
                                  match ? "bg-amber-500" : "bg-slate-200"
                                )}>
                                  {match?.status === 'VERIFIED' ? <Check className="h-2.5 w-2.5" /> : '!'}
                                </div>
                                <span className="text-xs font-bold text-slate-800">
                                  {docSpec.label} {docSpec.required && <span className="text-danger-500">*</span>}
                                </span>
                              </div>
                              
                              {/* Action Trigger / Status */}
                              {match ? (
                                <div className="flex items-center gap-1">
                                  <a
                                    href={`${api.getStudentQrImageUrl ? api.getStudentQrImageUrl(selectedAdmission.id, match.fileId) : '#'}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      try {
                                        const res = await api.previewStudentDocument(match.id);
                                        window.open(res.url, '_blank');
                                      } catch (err) {
                                        alert('Could not preview document');
                                      }
                                    }}
                                    className="p-1 text-slate-400 hover:text-primary-600 transition-colors"
                                    title="Preview"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                  <button
                                    onClick={() => deleteDocMutation.mutate(match.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <label className="cursor-pointer text-[0.68rem] font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                                  <Upload className="h-3 w-3" />
                                  {uploadingKind === docSpec.kind ? 'Uploading...' : 'Upload'}
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleUpload(e, docSpec.kind)}
                                    disabled={uploadingKind !== null}
                                  />
                                </label>
                              )}
                            </div>

                            {/* Document details / Verification workflow */}
                            {match && (
                              <div className="text-[0.68rem] border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                                <div className="flex justify-between text-slate-500">
                                  <span>{match.fileName}</span>
                                  <span className="font-bold uppercase tracking-wider text-[0.55rem]">
                                    {match.status}
                                  </span>
                                </div>
                                {match.status !== 'VERIFIED' && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <input
                                      type="text"
                                      placeholder="Quick verification note..."
                                      value={verificationNotes}
                                      onChange={(e) => setVerificationNotes(e.target.value)}
                                      className="flex-1 px-2.5 py-1 text-[0.65rem] border border-slate-200 rounded-lg focus:outline-none"
                                    />
                                    <button
                                      onClick={() => verifyDocMutation.mutate({ id: match.id, status: 'VERIFIED', notes: verificationNotes })}
                                      className="px-2.5 py-1 bg-success-500 text-white rounded-lg font-bold hover:bg-success-600 transition-all text-[0.65rem] whitespace-nowrap"
                                    >
                                      Approve
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Bottom Actions Workspace Panel */}
            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-500 font-medium">
                {getAdmissionStage(selectedAdmission) === 'Admitted' ? (
                  <span className="flex items-center gap-1.5 text-success-700 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-success-500" />
                    Enrolled successfully.
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-amber-700 font-bold">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Complete document review before enrollment verification.
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {getAdmissionStage(selectedAdmission) === 'Admitted' ? (
                  <>
                    {selectedAdmission.latestInvoice && (
                      <Link
                        href={`/dashboard/finance?studentId=${selectedAdmission.id}`}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-md shadow-primary-500/25 transition-all"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Collect Fee
                      </Link>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          await api.openStudentDocumentPdf(selectedAdmission.id, 'ID_CARD');
                        } catch (err) {
                          alert('Failed to generate or view student ID PDF');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Print ID Card
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      // Mark complete review
                      alert('Enrollment checklist is cleared! Proceed to verify enrollment details on student directory.');
                    }}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40"
                    disabled={selectedAdmission.documentCount === 0}
                  >
                    Verify & Enroll
                  </button>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-center bg-slate-50/50">
            <EmptyState
              title="No Applicant Selected"
              description="Click on an applicant from the list on the left to load their pipeline workspace and document checklist."
            />
          </div>
        )}
      </div>

    </div>
  );
}

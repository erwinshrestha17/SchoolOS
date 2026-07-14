'use client';

import {
  formatBsDate,
  formatBsDateTime,
  type GeneratedStudentDocumentMeta,
  type StudentDocument,
  type StudentDocumentHistory,
} from '@schoolos/core';
import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  CheckCircle2,
  Clock3,
  Download,
  History,
  LockKeyhole,
  MoreHorizontal,
  RefreshCw,
  ShieldCheck,
  Upload,
  XCircle,
} from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleLockedState } from '@/components/ui/module-locked-state';
import { PageState } from '@/components/ui/page-state';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/primitives/sheet';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/primitives/tabs';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useSession } from '@/components/session-provider';
import { api } from '@/lib/api';
import {
  ApiRequestError,
  downloadProtectedFile,
  openProtectedFile,
} from '@/lib/api/client';
import { cn } from '@/lib/utils';

type DocumentsTabProps = {
  studentId: string;
  documents: StudentDocument[];
  generatedDocuments: GeneratedStudentDocumentMeta[];
  onOpenPdf: (kind: string) => Promise<void>;
  generationError?: string;
};

const documentWorkspaceTabs = [
  { value: 'checklist', label: 'Checklist' },
  { value: 'all-files', label: 'All files' },
  { value: 'school-issued', label: 'School-issued' },
  { value: 'requests', label: 'Requests' },
  { value: 'activity', label: 'Activity' },
] as const;

type DocumentWorkspaceTab = (typeof documentWorkspaceTabs)[number]['value'];

const schoolIssuedTypes = [
  { kind: 'id-card', label: 'Student ID Card' },
  { kind: 'transfer-certificate', label: 'Transfer Certificate' },
  { kind: 'leaving-certificate', label: 'Leaving Certificate' },
  { kind: 'character-certificate', label: 'Character Certificate' },
] as const;

const summaryItems = [
  'Required',
  'Complete',
  'Awaiting review',
  'Missing',
  'Expiring soon',
] as const;

export function DocumentsTab({
  studentId,
  documents,
  generatedDocuments,
  onOpenPdf,
  generationError,
}: DocumentsTabProps) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const [activeTab, setActiveTab] =
    useState<DocumentWorkspaceTab>('all-files');
  const [selectedDocument, setSelectedDocument] =
    useState<StudentDocument | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<string | null>(null);
  const [generatedDocumentToRevoke, setGeneratedDocumentToRevoke] =
    useState<GeneratedStudentDocumentMeta | null>(null);
  const [generatedDocumentRevokeReason, setGeneratedDocumentRevokeReason] =
    useState('');
  const [documentToArchive, setDocumentToArchive] =
    useState<StudentDocument | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');

  const canManageDocuments = hasPermissions(['student_documents:manage']);
  const canReadDocumentRequests = hasPermissions([
    'enrollments:read',
    'students:read',
    'guardians:read',
  ]);

  const historyQuery = useQuery({
    queryKey: ['student-document-history', studentId],
    queryFn: () => api.listStudentDocumentHistory(studentId),
    enabled: activeTab === 'activity' || Boolean(selectedDocument),
  });

  const revokeGeneratedDocumentMutation = useMutation({
    mutationFn: ({
      documentId,
      reason,
    }: {
      documentId: string;
      reason: string;
    }) => api.revokeGeneratedStudentDocument(studentId, documentId, { reason }),
    onSuccess: async () => {
      setGeneratedDocumentToRevoke(null);
      setGeneratedDocumentRevokeReason('');
      await queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['student-document-history', studentId],
      });
    },
  });

  const verifyDocumentMutation = useMutation({
    mutationFn: ({
      documentId,
      status,
      notes,
    }: {
      documentId: string;
      status: 'VERIFIED' | 'REJECTED';
      notes: string;
    }) => api.verifyStudentDocument(documentId, { status, notes }),
    onSuccess: async () => {
      setReviewNote('');
      await queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['student-document-history', studentId],
      });
    },
  });

  const archiveDocumentMutation = useMutation({
    mutationFn: ({ documentId, reason }: { documentId: string; reason: string }) =>
      api.archiveStudentDocument(documentId, { reason }),
    onSuccess: async () => {
      setDocumentToArchive(null);
      setArchiveReason('');
      setSelectedDocument(null);
      setIsDetailDrawerOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ['student-profile', studentId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['student-document-history', studentId],
      });
    },
  });

  useEffect(() => {
    if (!selectedDocument) return;
    const refreshedDocument = documents.find(
      (document) => document.id === selectedDocument.id,
    );
    if (refreshedDocument) setSelectedDocument(refreshedDocument);
  }, [documents, selectedDocument]);

  function selectDocument(document: StudentDocument) {
    setSelectedDocument(document);
    setReviewNote('');
    if (window.matchMedia('(max-width: 1279px)').matches) {
      setIsDetailDrawerOpen(true);
    }
  }

  async function generateSchoolIssuedDocument(kind: string) {
    setGeneratingKind(kind);
    try {
      await onOpenPdf(kind);
    } finally {
      setGeneratingKind(null);
    }
  }

  const selectedDocumentHistory = selectedDocument
    ? (historyQuery.data ?? []).filter(
        (entry) => entry.documentId === selectedDocument.id,
      )
    : [];

  const detailContent = selectedDocument ? (
    <DocumentDetail
      studentId={studentId}
      document={selectedDocument}
      history={selectedDocumentHistory}
      isHistoryLoading={historyQuery.isLoading}
      historyError={historyQuery.error}
      canManage={canManageDocuments}
      reviewNote={reviewNote}
      isReviewing={verifyDocumentMutation.isPending}
      reviewError={verifyDocumentMutation.error}
      onReviewNoteChange={setReviewNote}
      onVerify={(status, notes) =>
        verifyDocumentMutation.mutate({
          documentId: selectedDocument.id,
          status,
          notes,
        })
      }
      onArchive={() => {
        setDocumentToArchive(selectedDocument);
        setArchiveReason('');
      }}
      onClose={() => {
        setSelectedDocument(null);
        setIsDetailDrawerOpen(false);
      }}
    />
  ) : (
    <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
        <ShieldCheck size={22} aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-900">Select a file</p>
      <p className="mt-1 max-w-64 text-xs leading-5 text-slate-500">
        File details, protected actions, verification, and activity will appear
        here.
      </p>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-5">
      <ModuleHeader
        title="Documents"
        description="Review required files and manage protected student records."
        primaryAction={
          canManageDocuments ? (
            <Link
              href={`/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}`}
              className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[var(--primary)] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
            >
              <Upload size={17} aria-hidden="true" />
              Upload document
            </Link>
          ) : undefined
        }
        moreActionItems={[
          {
            label: 'View activity',
            icon: <History size={16} aria-hidden="true" />,
            onClick: () => setActiveTab('activity'),
          },
        ]}
      />

      <DocumentSummaryStrip />

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as DocumentWorkspaceTab)
        }
      >
        <div className="overflow-x-auto border-b border-slate-200">
          <TabsList
            variant="line"
            aria-label="Document workspace sections"
            className="h-auto min-w-max justify-start gap-1 p-0"
          >
            {documentWorkspaceTabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="h-11 flex-none rounded-none px-4 font-bold text-slate-500 after:bg-[var(--color-mod-admissions-accent)] data-[state=active]:text-[var(--color-mod-admissions-text)]"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="checklist" className="mt-5">
          <ChecklistUnavailableState />
        </TabsContent>

        <TabsContent value="all-files" className="mt-5">
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <AllFilesTable
              studentId={studentId}
              documents={documents}
              selectedDocumentId={selectedDocument?.id ?? null}
              canManage={canManageDocuments}
              onSelect={selectDocument}
              onArchive={(document) => {
                setDocumentToArchive(document);
                setArchiveReason('');
              }}
            />
            <aside
              aria-label="Selected document details"
              className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm xl:block"
            >
              {detailContent}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="school-issued" className="mt-5">
          <SchoolIssuedDocuments
            generatedDocuments={generatedDocuments}
            canManage={canManageDocuments}
            generatingKind={generatingKind}
            generationError={generationError}
            revokeError={revokeGeneratedDocumentMutation.error}
            onGenerate={(kind) => void generateSchoolIssuedDocument(kind)}
            onRevoke={(document) => {
              setGeneratedDocumentToRevoke(document);
              setGeneratedDocumentRevokeReason('');
            }}
          />
        </TabsContent>

        <TabsContent value="requests" className="mt-5">
          <DocumentRequestsState canReadRequests={canReadDocumentRequests} />
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <DocumentActivity
            history={historyQuery.data ?? []}
            isLoading={historyQuery.isLoading}
            error={historyQuery.error}
            onRetry={() => void historyQuery.refetch()}
          />
        </TabsContent>
      </Tabs>

      <Sheet open={isDetailDrawerOpen} onOpenChange={setIsDetailDrawerOpen}>
        <SheetContent className="w-full gap-0 overflow-y-auto border-slate-200 bg-white p-0 sm:max-w-xl xl:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Selected document details</SheetTitle>
            <SheetDescription>
              Protected file information, actions, and activity.
            </SheetDescription>
          </SheetHeader>
          {detailContent}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        isOpen={Boolean(generatedDocumentToRevoke)}
        title="Revoke generated document?"
        description={`Revoke ${generatedDocumentToRevoke?.fileName ?? 'this generated document'} and keep its audit history. A new copy can be generated later when allowed.`}
        confirmLabel="Revoke document"
        destructive
        isConfirming={revokeGeneratedDocumentMutation.isPending}
        confirmDisabled={generatedDocumentRevokeReason.trim().length < 5}
        onClose={() => {
          setGeneratedDocumentToRevoke(null);
          setGeneratedDocumentRevokeReason('');
        }}
        onConfirm={() => {
          if (!generatedDocumentToRevoke) return;
          revokeGeneratedDocumentMutation.mutate({
            documentId: generatedDocumentToRevoke.id,
            reason: generatedDocumentRevokeReason.trim(),
          });
        }}
      >
        <label className="block text-sm font-bold text-slate-700">
          Revoke reason
          <textarea
            rows={3}
            value={generatedDocumentRevokeReason}
            onChange={(event) =>
              setGeneratedDocumentRevokeReason(event.target.value)
            }
            placeholder="Why should this school-issued document be revoked?"
            className="mt-2 font-normal"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={Boolean(documentToArchive)}
        title="Archive student document?"
        description={`Archive ${documentToArchive?.fileName ?? 'this document'} and keep its activity history attached to the student record.`}
        confirmLabel="Archive document"
        destructive
        isConfirming={archiveDocumentMutation.isPending}
        confirmDisabled={archiveReason.trim().length < 5}
        onClose={() => {
          setDocumentToArchive(null);
          setArchiveReason('');
        }}
        onConfirm={() => {
          if (!documentToArchive) return;
          archiveDocumentMutation.mutate({
            documentId: documentToArchive.id,
            reason: archiveReason.trim(),
          });
        }}
      >
        {archiveDocumentMutation.isError ? (
          <InlineError>
            {safeErrorMessage(
              archiveDocumentMutation.error,
              'This document could not be archived. Please try again.',
            )}
          </InlineError>
        ) : null}
        <label className="block text-sm font-bold text-slate-700">
          Archive reason
          <textarea
            rows={3}
            value={archiveReason}
            onChange={(event) => setArchiveReason(event.target.value)}
            placeholder="Why should this student document be archived?"
            className="mt-2 font-normal"
          />
        </label>
      </ConfirmDialog>
    </div>
  );
}

function DocumentSummaryStrip() {
  return (
    <section
      aria-label="Document checklist summary"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
        {summaryItems.map((label, index) => (
          <div
            key={label}
            className={cn(
              'min-w-0 px-4 py-3',
              index === 2 && 'sm:border-t sm:border-slate-100 xl:border-t-0',
              index === 4 && 'sm:col-span-2 xl:col-span-1',
            )}
          >
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-700">Unavailable</p>
          </div>
        ))}
      </div>
      <p className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs leading-5 text-slate-500">
        Official checklist totals are not included in this student profile and
        are not calculated from the visible file list.
      </p>
    </section>
  );
}

function ChecklistUnavailableState() {
  return (
    <PageState
      tone="info"
      title="Checklist unavailable"
      description="This student record does not include a policy-derived document checklist yet. Missing requirements cannot be assessed here, but uploaded files remain available under All files."
      className="min-h-[340px]"
    />
  );
}

function AllFilesTable({
  studentId,
  documents,
  selectedDocumentId,
  canManage,
  onSelect,
  onArchive,
}: {
  studentId: string;
  documents: StudentDocument[];
  selectedDocumentId: string | null;
  canManage: boolean;
  onSelect: (document: StudentDocument) => void;
  onArchive: (document: StudentDocument) => void;
}) {
  const router = useRouter();

  if (documents.length === 0) {
    return (
      <EmptyState
        title="No uploaded files"
        description="Protected student files will appear here after they are uploaded."
        className="min-h-[340px]"
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">All files</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            The current student profile does not provide server-side search,
            filters, or pagination metadata.
          </p>
        </div>
        <StatusBadge
          status="UNAVAILABLE"
          label="List controls unavailable"
          tone="inactive"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Uploaded</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documents.map((document) => {
              const isSelected = selectedDocumentId === document.id;
              const isInactive =
                document.status === 'ARCHIVED' ||
                document.status === 'REPLACED';
              return (
                <tr
                  key={document.id}
                  data-state={isSelected ? 'selected' : undefined}
                  aria-selected={isSelected}
                  className={cn(
                    'transition-colors hover:bg-slate-50',
                    isSelected && 'bg-[var(--color-mod-admissions-bg)]',
                  )}
                >
                  <td className="max-w-72 px-4 py-3">
                    <Tooltip content={document.fileName}>
                      <button
                        type="button"
                        onClick={() => onSelect(document)}
                        className="block max-w-full truncate rounded-md text-left font-bold text-slate-900 underline-offset-4 hover:text-[var(--color-mod-admissions-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
                        aria-label={`Show details for ${document.fileName}`}
                      >
                        {document.fileName}
                      </button>
                    </Tooltip>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {document.title || formatDocumentKind(document.kind)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDocumentKind(document.kind)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={document.status ?? 'ACTIVE'}
                      label={formatDocumentStatus(document.status)}
                      tone={documentStatusTone(document.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(document.uploadedAt, 'Upload time unavailable')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <StudentDocumentAccessButton
                        studentId={studentId}
                        document={document}
                        action="preview"
                        disabled={isInactive}
                        showStatus={false}
                      />
                      <ActionMenu
                        label={`More actions for ${document.fileName}`}
                        trigger={
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
                          >
                            <MoreHorizontal size={17} aria-hidden="true" />
                          </button>
                        }
                        items={[
                          {
                            label: 'View details',
                            onClick: () => onSelect(document),
                          },
                          ...(canManage
                            ? [
                                {
                                  label: 'Replace',
                                  onClick: () =>
                                    router.push(
                                      `/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}&documentId=${encodeURIComponent(document.id)}`,
                                    ),
                                },
                                {
                                  label: 'Archive',
                                  variant: 'danger' as const,
                                  disabled: isInactive,
                                  onClick: () => onArchive(document),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SchoolIssuedDocuments({
  generatedDocuments,
  canManage,
  generatingKind,
  generationError,
  revokeError,
  onGenerate,
  onRevoke,
}: {
  generatedDocuments: GeneratedStudentDocumentMeta[];
  canManage: boolean;
  generatingKind: string | null;
  generationError?: string;
  revokeError: unknown;
  onGenerate: (kind: string) => void;
  onRevoke: (document: GeneratedStudentDocumentMeta) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-black text-slate-950">
          School-issued documents
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Generate supported school records and review version history returned
          for this student.
        </p>
      </div>

      {generationError ? <InlineError>{generationError}</InlineError> : null}
      {revokeError ? (
        <InlineError>
          {safeErrorMessage(
            revokeError,
            'The school-issued document could not be revoked. Please try again.',
          )}
        </InlineError>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-[780px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-[0.68rem] font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Availability</th>
              <th className="px-4 py-3">Last generated</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schoolIssuedTypes.map(({ kind, label }) => {
              const versions = generatedDocuments
                .filter((document) => document.kind === kind)
                .sort((left, right) => right.version - left.version);
              const activeDocument = versions.find(
                (document) => !document.revokedAt,
              );
              const latestDocument = activeDocument ?? versions[0] ?? null;
              const status = activeDocument
                ? 'AVAILABLE'
                : latestDocument?.revokedAt
                  ? 'REVOKED'
                  : 'NOT_GENERATED';

              return (
                <tr key={kind}>
                  <td className="px-4 py-3 align-top">
                    <p className="font-bold text-slate-900">{label}</p>
                    {versions.length > 1 ? (
                      <details className="mt-2 text-xs text-slate-500">
                        <summary className="cursor-pointer rounded font-semibold text-[var(--color-mod-admissions-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2">
                          Version history ({versions.length})
                        </summary>
                        <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3">
                          {versions.map((version) => (
                            <li key={version.id}>
                              Version {version.version} ·{' '}
                              {formatDateTime(
                                version.generatedAt,
                                'Generation time unavailable',
                              )}
                              {version.revokedAt ? ' · Revoked' : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : latestDocument ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Version {latestDocument.version}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-72 px-4 py-3 align-top text-xs leading-5 text-slate-600">
                    {activeDocument
                      ? 'A protected copy is available. Regenerating creates a new version.'
                      : latestDocument?.revokedAt
                        ? 'The previous copy was revoked. Generate a new copy when needed.'
                        : 'No school-issued copy has been generated for this student.'}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {latestDocument?.generatedAt
                      ? formatDateTime(
                          latestDocument.generatedAt,
                          'Generation time unavailable',
                        )
                      : 'Not generated'}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge
                      status={status}
                      label={
                        status === 'NOT_GENERATED'
                          ? 'Not generated'
                          : titleCaseStatus(status)
                      }
                      tone={
                        status === 'AVAILABLE'
                          ? 'approved'
                          : status === 'REVOKED'
                            ? 'rejected'
                            : 'inactive'
                      }
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-2">
                      {canManage ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          isLoading={generatingKind === kind}
                          onClick={() => onGenerate(kind)}
                        >
                          <RefreshCw size={15} aria-hidden="true" />
                          {generatingKind === kind
                            ? 'Processing…'
                            : activeDocument
                              ? 'Regenerate'
                              : 'Generate'}
                        </Button>
                      ) : null}
                      {canManage && activeDocument ? (
                        <ActionMenu
                          label={`More actions for ${label}`}
                          items={[
                            {
                              label: 'Revoke',
                              icon: <Archive size={15} aria-hidden="true" />,
                              variant: 'danger',
                              onClick: () => onRevoke(activeDocument),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DocumentRequestsState({
  canReadRequests,
}: {
  canReadRequests: boolean;
}) {
  if (!canReadRequests) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to view document requests."
        description="Ask a school administrator for access to admission document requests. No student records were changed."
      />
    );
  }

  return (
    <PageState
      tone="info"
      title="Student-specific requests are unavailable"
      description="The current profile does not include request records for this student. The admission request center remains available for policy-derived open admission cases."
      secondaryAction={
        <Link
          href="/dashboard/admissions/documents"
          className="inline-flex h-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2"
        >
          Open request center
        </Link>
      }
    />
  );
}

function DocumentActivity({
  history,
  isLoading,
  error,
  onRetry,
}: {
  history: StudentDocumentHistory[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (isLoading) {
    return (
      <div
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
        role="status"
        aria-label="Loading document activity"
      >
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    if (isModuleLockedError(error)) {
      return (
        <ModuleLockedState
          moduleName="Student documents"
          description="Student documents are not enabled for this school. No records were changed."
        />
      );
    }
    if (error instanceof ApiRequestError && error.statusCode === 403) {
      return (
        <PageState
          tone="permission"
          title="You do not have permission to view document activity."
          description="Ask a school administrator for document-history access. No student records were changed."
        />
      );
    }
    return (
      <PageState
        tone="danger"
        title="Document activity could not load"
        description="The file list is still available. Try loading activity again."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState
        title="No document activity"
        description="Upload, review, archive, and school-issued document events will appear here when recorded."
        className="min-h-[340px]"
      />
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-black text-slate-950">
          Document activity
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Latest tenant-scoped events returned for this student.
        </p>
      </div>
      <ol className="divide-y divide-slate-100">
        {history.map((entry) => (
          <li key={entry.id} className="flex gap-3 px-5 py-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)]">
              <History size={17} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    {formatHistoryAction(entry.action)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {entry.documentTitle ??
                      formatDocumentKind(entry.documentKind) ??
                      'Student document'}
                  </p>
                </div>
                <time className="shrink-0 text-xs font-semibold text-slate-500">
                  {formatDateTime(entry.createdAt, 'Activity time unavailable')}
                </time>
              </div>
              {entry.reason ? (
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {entry.reason}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Recorded by {entry.performedBy}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DocumentDetail({
  studentId,
  document,
  history,
  isHistoryLoading,
  historyError,
  canManage,
  reviewNote,
  isReviewing,
  reviewError,
  onReviewNoteChange,
  onVerify,
  onArchive,
  onClose,
}: {
  studentId: string;
  document: StudentDocument;
  history: StudentDocumentHistory[];
  isHistoryLoading: boolean;
  historyError: unknown;
  canManage: boolean;
  reviewNote: string;
  isReviewing: boolean;
  reviewError: unknown;
  onReviewNoteChange: (value: string) => void;
  onVerify: (status: 'VERIFIED' | 'REJECTED', notes: string) => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const isInactive =
    document.status === 'ARCHIVED' || document.status === 'REPLACED';

  return (
    <div>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Selected document
          </p>
          <Tooltip content={document.fileName} side="bottom">
            <button
              type="button"
              className="mt-1 block max-w-full truncate rounded text-left text-base font-black text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
            >
              {document.fileName}
            </button>
          </Tooltip>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close selected document details"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
        >
          <XCircle size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            status={document.status ?? 'ACTIVE'}
            label={formatDocumentStatus(document.status)}
            tone={documentStatusTone(document.status)}
          />
          <span className="text-xs font-semibold text-slate-500">
            {formatDocumentKind(document.kind)}
          </span>
        </div>

        <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs">
          <DetailRow label="Uploaded">
            {formatDateTime(document.uploadedAt, 'Upload time unavailable')}
          </DetailRow>
          <DetailRow label="Uploaded by">
            {document.uploadedById ? 'Uploader name unavailable' : 'Not supplied'}
          </DetailRow>
          <DetailRow label="File type">{document.contentType}</DetailRow>
          <DetailRow label="File size">
            {formatFileSize(document.sizeBytes)}
          </DetailRow>
          <DetailRow label="Expires">
            {document.expiryDate
              ? formatDateOnly(document.expiryDate, 'Expiry date unavailable')
              : 'Not supplied'}
          </DetailRow>
          <DetailRow label="Verified">
            {document.verifiedAt
              ? formatDateTime(
                  document.verifiedAt,
                  'Verification time unavailable',
                )
              : 'Not verified'}
          </DetailRow>
          <DetailRow label="Verified by">
            {document.verifiedById ? 'Verifier name unavailable' : 'Not supplied'}
          </DetailRow>
        </dl>

        {document.status === 'REJECTED' && document.notes ? (
          <div className="rounded-xl border border-danger-100 bg-danger-50 p-3 text-xs leading-5 text-danger-700">
            <strong>Review note:</strong> {latestReviewNote(document.notes)}
          </div>
        ) : null}

        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Protected actions
          </p>
          <div className="mt-3 flex items-center gap-2">
            <StudentDocumentAccessButton
              studentId={studentId}
              document={document}
              action="preview"
              disabled={isInactive}
            />
            <ActionMenu
              label={`More actions for ${document.fileName}`}
              items={[
                {
                  label: 'Download',
                  icon: <Download size={15} aria-hidden="true" />,
                  disabled: isInactive,
                  onClick: () =>
                    void runStudentDocumentAccess(
                      studentId,
                      document,
                      'download',
                    ),
                },
                ...(canManage
                  ? [
                      {
                        label: 'Replace',
                        onClick: () =>
                          router.push(
                            `/dashboard/admissions/documents?studentId=${encodeURIComponent(studentId)}&documentId=${encodeURIComponent(document.id)}`,
                          ),
                      },
                      {
                        label: 'Archive',
                        icon: <Archive size={15} aria-hidden="true" />,
                        variant: 'danger' as const,
                        disabled: isInactive,
                        onClick: onArchive,
                      },
                    ]
                  : []),
              ]}
            />
          </div>
        </div>

        {canManage && !isInactive ? (
          <div className="border-t border-slate-100 pt-5">
            <label className="block text-xs font-bold text-slate-700">
              Review note
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(event) => onReviewNoteChange(event.target.value)}
                placeholder="Required when rejecting a document"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-normal text-slate-900 outline-none focus:border-[var(--color-mod-admissions-accent)] focus:ring-2 focus:ring-[var(--color-mod-admissions-border)]"
              />
            </label>
            {reviewError ? (
              <InlineError>
                {safeErrorMessage(
                  reviewError,
                  'The document review could not be saved. Please try again.',
                )}
              </InlineError>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReviewing}
                onClick={() =>
                  onVerify(
                    'VERIFIED',
                    reviewNote.trim() ||
                      'Verified in the student document workspace.',
                  )
                }
              >
                <CheckCircle2 size={15} aria-hidden="true" />
                Verify
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isReviewing || reviewNote.trim().length < 5}
                onClick={() => onVerify('REJECTED', reviewNote.trim())}
              >
                <XCircle size={15} aria-hidden="true" />
                Reject
              </Button>
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">
            Selected-document activity
          </p>
          {isHistoryLoading ? (
            <div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-100" />
          ) : historyError ? (
            <div className="mt-3 rounded-xl border border-warning-100 bg-warning-50 p-3 text-xs leading-5 text-warning-800">
              Activity is unavailable. File details and protected actions remain
              available.
            </div>
          ) : history.length === 0 ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              No activity was returned for this file.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {history.slice(0, 8).map((entry) => (
                <li
                  key={entry.id}
                  className="border-l-2 border-[var(--color-mod-admissions-border)] pl-3 text-xs"
                >
                  <p className="font-bold text-slate-800">
                    {formatHistoryAction(entry.action)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {formatDateTime(
                      entry.createdAt,
                      'Activity time unavailable',
                    )}{' '}
                    · {entry.performedBy}
                  </p>
                  {entry.reason ? (
                    <p className="mt-1 leading-5 text-slate-600">
                      {entry.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[65%] break-words text-right font-bold text-slate-800">
        {children}
      </dd>
    </div>
  );
}

function StudentDocumentAccessButton({
  studentId,
  document,
  action,
  disabled = false,
  showStatus = true,
}: {
  studentId: string;
  document: StudentDocument;
  action: 'preview' | 'download';
  disabled?: boolean;
  showStatus?: boolean;
}) {
  const [status, setStatus] =
    useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function openDocument() {
    setStatus('loading');
    setMessage(
      action === 'download'
        ? 'Preparing protected download…'
        : 'Preparing protected preview…',
    );
    try {
      await runStudentDocumentAccess(studentId, document, action);
      setStatus('success');
      setMessage(
        action === 'download'
          ? 'Protected download started.'
          : 'Protected preview opened.',
      );
    } catch (error: unknown) {
      setStatus('error');
      setMessage(
        safeErrorMessage(
          error,
          'This protected document is unavailable right now. Please try again.',
        ),
      );
    }
  }

  return (
    <span className="inline-flex flex-col">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || status === 'loading'}
        onClick={(event) => {
          event.stopPropagation();
          void openDocument();
        }}
        aria-label={`${action === 'download' ? 'Download' : 'View'} protected file ${document.fileName}`}
      >
        {status === 'loading' ? (
          <Clock3 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
        )}
        {status === 'loading'
          ? action === 'download'
            ? 'Preparing…'
            : 'Opening…'
          : action === 'download'
            ? 'Download'
            : 'View'}
      </Button>
      {showStatus && message ? (
        <p
          className={cn(
            'mt-2 max-w-56 text-xs font-semibold',
            status === 'error' ? 'text-danger-700' : 'text-slate-500',
          )}
          role={status === 'error' ? 'alert' : 'status'}
          aria-live={status === 'error' ? 'assertive' : 'polite'}
        >
          {message}
        </p>
      ) : null}
    </span>
  );
}

async function runStudentDocumentAccess(
  studentId: string,
  document: StudentDocument,
  action: 'preview' | 'download',
) {
  const access =
    action === 'download'
      ? await api.downloadStudentDocument(studentId, document.id)
      : await api.previewStudentDocument(studentId, document.id);

  if (action === 'download') {
    await downloadProtectedFile(
      access.fileAssetId,
      access.fileName || document.fileName,
    );
  } else {
    await openProtectedFile(access.fileAssetId, {
      fileName: access.fileName || document.fileName,
    });
  }
}

function InlineError({ children }: { children: ReactNode }) {
  return (
    <div
      className="m-4 rounded-xl border border-danger-100 bg-danger-50 p-3 text-sm font-semibold text-danger-700"
      role="alert"
    >
      {children}
    </div>
  );
}

function formatDocumentStatus(status?: string | null) {
  if (
    !status ||
    status === 'ACTIVE' ||
    status === 'PENDING' ||
    status === 'UPLOADED'
  ) {
    return 'Awaiting review';
  }
  return titleCaseStatus(status);
}

function documentStatusTone(status?: string | null): StatusTone {
  if (status === 'VERIFIED') return 'approved';
  if (status === 'REJECTED') return 'rejected';
  if (status === 'ARCHIVED' || status === 'REPLACED') return 'inactive';
  return 'pending';
}

function formatDocumentKind(value?: string | null) {
  if (!value) return null;
  return titleCaseStatus(value);
}

function titleCaseStatus(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHistoryAction(action: string) {
  return titleCaseStatus(action);
}

function formatDateOnly(value: string, fallback: string) {
  try {
    return formatBsDate(value);
  } catch {
    return fallback;
  }
}

function formatDateTime(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  try {
    return formatBsDateTime(value);
  } catch {
    return fallback;
  }
}

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return 'Not supplied';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function latestReviewNote(value: string) {
  return (
    value
      .split('\n')
      .map((line) => line.replace(/^Verification Note:\s*/i, '').trim())
      .filter(Boolean)
      .at(-1) ?? value
  );
}

function safeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    if (error.statusCode === 403) {
      return 'You do not have permission to complete this document action.';
    }
    if (error.statusCode === 404) {
      return 'This document is no longer available.';
    }
    return fallback;
  }
  return fallback;
}

function isModuleLockedError(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.statusCode !== 403) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('subscription plan') ||
    message.includes('not enabled') ||
    message.includes('module.students')
  );
}

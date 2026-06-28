'use client';

import { formatBsDate } from '@schoolos/core';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { FileText, Download, CheckCircle, Clock, AlertTriangle, Plus, ShieldCheck, X } from 'lucide-react';
import { StaffDocumentUploadDialog } from './staff-document-upload-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, TextArea } from '../ui/form-field';
import { Badge } from '../ui/badge';
import { ProtectedFileButton } from '../ui/protected-file';
import { useSession } from '../session-provider';
import { cn } from '../../lib/utils';

export function StaffDocumentsPanel({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const { hasPermissions } = useSession();
  const canUpdateStaff = hasPermissions(['hr:staff:update']);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDocToVerify, setSelectedDocToVerify] = useState<{ id: string; name: string } | null>(null);
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [fileViewError, setFileViewError] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: ['staff-documents', staffId],
    queryFn: () => api.listStaffDocuments(staffId),
  });

  const verifyMutation = useMutation({
    mutationFn: (note: string) =>
      api.verifyStaffDocument(staffId, selectedDocToVerify!.id, { notes: note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      setSelectedDocToVerify(null);
      setVerifyNotes('');
    },
    onError: (error: any) => {
      setVerifyError(error.message || 'Failed to verify document.');
    },
  });

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError(null);
    verifyMutation.mutate(verifyNotes.trim());
  };

  const docs = documentsQuery.data?.items ?? documentsQuery.data ?? [];

  return (
    <section className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-mod-hr-soft)] text-[var(--color-mod-hr-text)] flex items-center justify-center">
            <FileText size={18} />
          </div>
          Staff Documents
        </h3>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 hover:border-[var(--color-mod-hr-border)] hover:bg-[var(--color-mod-hr-soft)]/60 text-slate-700 hover:text-[var(--color-mod-hr-text)] rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
        >
          <Plus size={14} />
          Upload Document
        </button>
      </div>

      {fileViewError ? (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold">Could not open document</p>
            <p className="mt-0.5">{fileViewError}</p>
          </div>
          <button
            type="button"
            className="ml-auto text-xs font-bold text-red-700 underline"
            onClick={() => setFileViewError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {documentsQuery.isLoading ? (
          <div className="py-12 flex justify-center items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-mod-hr-accent)]" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hydrating records...</span>
          </div>
        ) : docs.length > 0 ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Document Details</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Kind</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider">Audit / Remarks</th>
                <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {docs.map((doc: any) => (
                <tr key={doc.id} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    <p className="font-bold text-slate-900">{doc.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-medium">Uploaded {formatBsDate(doc.createdAt)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="font-bold text-[9px] uppercase tracking-wider">
                      {doc.kind.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border inline-flex items-center gap-1",
                      doc.status === 'VERIFIED' ? "bg-emerald-50 text-emerald-600 border-emerald-200/50" :
                      doc.status === 'ACTIVE' || doc.status === 'PENDING' ? "bg-amber-50 text-amber-600 border-amber-200/50" :
                      "bg-rose-50 text-rose-600 border-rose-200/50"
                    )}>
                      {doc.status === 'VERIFIED' ? <CheckCircle size={10} /> : <Clock size={10} />}
                      {doc.status === 'ACTIVE' ? 'PENDING' : doc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-medium leading-relaxed max-w-xs truncate">
                    {doc.notes || doc.verificationNotes || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {doc.status !== 'VERIFIED' && canUpdateStaff && (
                        <button
                          onClick={() => setSelectedDocToVerify({ id: doc.id, name: doc.name })}
                          className="px-3 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase tracking-widest transition-all"
                        >
                          Verify
                        </button>
                      )}
                      <ProtectedFileButton
                        fileAssetId={doc.fileId}
                        fileName={doc.name}
                        action="preview"
                        size="icon"
                        variant="outline"
                        showStatus={false}
                        title="Download / View"
                        ariaLabel={`Open ${doc.name || 'staff document'}`}
                        className="h-8 w-8 rounded-lg border-slate-200 p-0 text-slate-400 hover:border-slate-300 hover:text-slate-700"
                        onSuccess={() => setFileViewError(null)}
                        onError={(message) => setFileViewError(message)}
                      >
                        <Download size={14} />
                      </ProtectedFileButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-slate-400 italic font-medium">
            No files or records uploaded for this staff member.
          </div>
        )}
      </div>

      <StaffDocumentUploadDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        staffId={staffId}
      />

      {/* Verification Dialog */}
      {selectedDocToVerify && (
        <Dialog open={!!selectedDocToVerify} onOpenChange={() => setSelectedDocToVerify(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="text-emerald-500" />
                Verify Document
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-1">Reviewing: {selectedDocToVerify.name}</p>
            </DialogHeader>
            <form onSubmit={handleVerifySubmit} className="p-6 space-y-4">
              <FormField label="Audit / Verification Note">
                <TextArea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="e.g. Document reviewed against original records."
                  rows={3}
                />
              </FormField>
              {verifyError && <p className="text-xs font-bold text-rose-500">{verifyError}</p>}
            </form>
            <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
              <Button type="button" variant="outline" onClick={() => setSelectedDocToVerify(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={handleVerifySubmit}
                isLoading={verifyMutation.isPending}
                disabled={verifyMutation.isPending}
                className="bg-[var(--color-mod-hr-accent)] hover:bg-[var(--color-mod-hr-text)]"
              >
                Approve & Mark Verified
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

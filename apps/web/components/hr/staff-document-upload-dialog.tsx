'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { FormField, Input, Select } from '../ui/form-field';
import { Toast } from '../ui/toast';
import { FileUploader } from '../ui/file-uploader';
import { X } from 'lucide-react';

type StaffDocumentUploadDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
};

export function StaffDocumentUploadDialog({
  isOpen,
  onClose,
  staffId,
}: StaffDocumentUploadDialogProps) {
  const queryClient = useQueryClient();
  const [toastError, setToastError] = useState<string | null>(null);

  const [kind, setKind] = useState('CITIZENSHIP');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [fileId, setFileId] = useState<string | null>(null);

  const addDocumentMutation = useMutation({
    mutationFn: (payload: any) => api.addStaffDocument(staffId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-documents', staffId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
      onClose();
      // Reset form
      setKind('CITIZENSHIP');
      setName('');
      setNotes('');
      setFileId(null);
    },
    onError: (error: any) => {
      setToastError(error.message || 'Failed to link uploaded document.');
    },
  });

  const handleUploadComplete = (id: string, fileName: string) => {
    setFileId(id);
    if (!name) {
      // Auto-populate document name with filename without extension
      setName(fileName.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleRemoveFile = () => {
    setFileId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setToastError(null);

    if (!fileId) {
      setToastError('Please upload a document file.');
      return;
    }
    if (!name) {
      setToastError('Please enter a document name.');
      return;
    }

    addDocumentMutation.mutate({
      kind,
      fileId,
      name,
      notes: notes || undefined,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[2.5rem]">
        <DialogHeader className="flex justify-between items-center pr-12">
          <div>
            <DialogTitle>Upload Document</DialogTitle>
            <p className="text-xs text-slate-500 mt-1">Upload verified files for staff records.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </DialogHeader>

        {toastError && (
          <Toast
            title="Upload Failed"
            description={toastError}
            tone="danger"
            onDismiss={() => setToastError(null)}
            className="m-6"
          />
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <FormField label="Document Kind">
            <Select value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="CITIZENSHIP">Citizenship / National ID</option>
              <option value="PAN_CARD">PAN Card (Taxpayer ID)</option>
              <option value="CONTRACT">Employment Contract</option>
              <option value="ACADEMIC_CERTIFICATE">Academic Certificate</option>
              <option value="OFFER_LETTER">Offer Letter</option>
              <option value="ID_CARD">ID Card</option>
              <option value="OTHER">Other Documents</option>
            </Select>
          </FormField>

          <FormField label="Document Name (Required)">
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Citizenship Front Page"
              required
            />
          </FormField>

          <FormField label="Upload File">
            <FileUploader
              module="staff_documents"
              maxFiles={1}
              accept=".pdf,.png,.jpg,.jpeg"
              onUploadComplete={handleUploadComplete}
              onRemove={handleRemoveFile}
            />
          </FormField>

          <FormField label="Notes / Comments">
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks"
            />
          </FormField>
        </form>

        <DialogFooter className="bg-slate-50 border-t flex justify-end gap-3 p-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!fileId || addDocumentMutation.isPending}
            isLoading={addDocumentMutation.isPending}
          >
            Save Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

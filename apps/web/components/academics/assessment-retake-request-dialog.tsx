'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  AssessmentRetakeSummary,
  AssessmentRetakeType,
  MarkEntrySummary,
} from '@schoolos/core';
import { RotateCcw } from 'lucide-react';
import { academicsApi } from '@/lib/api/academics';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type AssessmentRetakeRequestDialogProps = {
  mark: MarkEntrySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequested?: (retake: AssessmentRetakeSummary) => void;
};

export function AssessmentRetakeRequestDialog({
  mark,
  open,
  onOpenChange,
  onRequested,
}: AssessmentRetakeRequestDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<AssessmentRetakeType>('RETEST');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !mark) return;
    setType(
      mark.status === 'ABSENT' || mark.status === 'EXCUSED'
        ? 'MAKE_UP'
        : 'RETEST',
    );
    setReason('');
    setValidationError(null);
  }, [mark, open]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!mark) {
        throw new Error('Choose a saved mark before requesting a retest.');
      }
      return academicsApi.createAssessmentRetake({
        markEntryId: mark.id,
        type,
        reason: reason.trim(),
      });
    },
    onSuccess: (retake) => {
      void queryClient.invalidateQueries({ queryKey: ['assessment-retakes'] });
      void queryClient.invalidateQueries({ queryKey: ['marks'] });
      onRequested?.(retake);
      onOpenChange(false);
    },
  });

  const submit = () => {
    if (reason.trim().length < 8) {
      setValidationError('Enter a clear reason using at least 8 characters.');
      return;
    }
    setValidationError(null);
    mutation.mutate();
  };

  const studentName = mark?.student
    ? `${mark.student.firstNameEn} ${mark.student.lastNameEn}`.trim()
    : 'Selected student';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request retest or make-up</DialogTitle>
          <DialogDescription className="mt-1">
            {studentName}. The original mark remains unchanged until an
            authorized reviewer approves this lifecycle.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="space-y-2">
            <Label htmlFor="assessment-retake-type">Assessment type</Label>
            <Select
              id="assessment-retake-type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as AssessmentRetakeType)
              }
            >
              <option value="RETEST">Retest</option>
              <option value="MAKE_UP">Make-up assessment</option>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assessment-retake-reason">Reason</Label>
            <Textarea
              id="assessment-retake-reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Record the academic or approved absence reason."
              aria-invalid={Boolean(validationError)}
            />
            {validationError ? (
              <p className="text-sm font-semibold text-rose-700" role="alert">
                {validationError}
              </p>
            ) : null}
          </div>

          {mutation.isError ? (
            <p className="text-sm font-semibold text-rose-700" role="alert">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'The request could not be created.'}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            isLoading={mutation.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Request review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

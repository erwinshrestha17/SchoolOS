'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StaffSelector } from '@/components/staff/staff-selector';
import { getNepalSchoolDay } from '@schoolos/core';

interface TimetableSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot?: any;
  slots?: any[];
  substitution?: any;
  mode: 'create' | 'assign';
}

export function TimetableSubstitutionModal({
  isOpen,
  onClose,
  slot,
  slots = [],
  substitution,
  mode,
}: TimetableSubstitutionModalProps) {
  const queryClient = useQueryClient();
  const [substituteTeacherId, setSubstituteTeacherId] = useState(
    substitution?.substituteTeacherId ?? '',
  );
  const [selectedSlotId, setSelectedSlotId] = useState(slot?.id ?? '');
  const [reason, setReason] = useState(substitution?.reason ?? '');
  const [date, setDate] = useState(getNepalSchoolDay().gregorianDate);
  const [error, setError] = useState<string | null>(null);
  const selectedSlot = slot ?? slots.find((item) => item.id === selectedSlotId);
  const selectedSubjectName =
    selectedSlot?.subject?.name?.trim() || 'Subject not set';
  const selectedClassName =
    selectedSlot?.class?.name?.trim() || 'Class not set';
  const selectedSectionName = selectedSlot?.section?.name?.trim();

  // Phase 5M: availability and professional eligibility of the chosen
  // substitute for this slot, decided by the server before submitting.
  const checkSlotId: string | undefined =
    selectedSlot?.id ?? substitution?.timetableSlotId;
  const checkDate: string | undefined =
    mode === 'create' ? date : substitution?.date?.slice(0, 10);
  const candidateCheckEnabled = Boolean(
    substituteTeacherId && checkSlotId && checkDate,
  );
  const candidateCheck = useQuery({
    queryKey: [
      'substitute-candidate-check',
      checkSlotId,
      checkDate,
      substituteTeacherId,
      substitution?.id ?? null,
    ],
    queryFn: () =>
      api.checkSubstituteCandidate({
        timetableSlotId: checkSlotId as string,
        date: checkDate as string,
        staffId: substituteTeacherId,
        ...(substitution?.id ? { currentSubstitutionId: substitution.id } : {}),
      }),
    enabled: candidateCheckEnabled,
    staleTime: 0,
  });
  const candidateBlocked =
    candidateCheckEnabled &&
    candidateCheck.isSuccess &&
    (candidateCheck.data === null || !candidateCheck.data.eligible);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createSubstitution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-substitutions'] });
      onClose();
    },
    onError: (err: any) =>
      setError(err.message || 'Failed to create substitution'),
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => api.assignSubstitution(substitution.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-substitutions'] });
      onClose();
    },
    onError: (err: any) =>
      setError(err.message || 'Failed to assign substitute'),
  });

  const handleAction = () => {
    setError(null);
    if (!substituteTeacherId) {
      setError('Please select a substitute teacher.');
      return;
    }
    if (mode === 'create' && !selectedSlot) {
      setError('Please select a timetable slot.');
      return;
    }
    const trimmedReason = reason.trim();
    if (mode === 'create' && !trimmedReason) {
      setError('Please provide an absence reason.');
      return;
    }

    if (mode === 'create') {
      createMutation.mutate({
        timetableSlotId: selectedSlot.id,
        absentTeacherId: selectedSlot.staffId,
        substituteTeacherId,
        date,
        reason: trimmedReason,
      });
    } else {
      assignMutation.mutate({
        substituteTeacherId,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900">
            {mode === 'create' ? 'Record Absence' : 'Assign Substitute'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {mode === 'create' && !slot ? (
            <FormField label="Timetable Slot">
              <Select
                value={selectedSlotId}
                onChange={(event) => setSelectedSlotId(event.target.value)}
                className="rounded-xl"
              >
                <option value="">Select a published class slot</option>
                {slots.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject?.name?.trim() || 'Subject not set'} /{' '}
                    {item.startsAt} - {item.endsAt}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {mode === 'create' && selectedSlot && (
            <div className="space-y-2 rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-soft)]/40 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">
                Selected Slot
              </p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">
                  {selectedSubjectName}
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {selectedSlot.startsAt} - {selectedSlot.endsAt}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {selectedClassName}
                {selectedSectionName
                  ? ` - ${selectedSectionName}`
                  : ' - All sections'}
              </p>
            </div>
          )}

          {mode === 'create' && (
            <FormField label="Absence Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl"
              />
            </FormField>
          )}

          <StaffSelector
            label="Substitute Teacher"
            value={substituteTeacherId}
            onChange={setSubstituteTeacherId}
            selectedLabel={
              substitution?.substituteTeacher
                ? [
                    substitution.substituteTeacher.firstName,
                    substitution.substituteTeacher.lastName,
                  ]
                    .filter(Boolean)
                    .join(' ')
                : undefined
            }
            placeholder="Select a replacement teacher"
          />

          {candidateCheckEnabled ? (
            <div
              role="status"
              className={
                candidateCheck.isLoading
                  ? 'rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500'
                  : candidateBlocked
                    ? 'rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700'
                    : candidateCheck.isSuccess
                      ? 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800'
                      : 'rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600'
              }
            >
              {candidateCheck.isLoading ? (
                'Checking availability and eligibility…'
              ) : candidateCheck.isError ? (
                'Eligibility could not be checked. It will still be verified when you save.'
              ) : candidateBlocked ? (
                <span className="flex items-start gap-2">
                  <AlertCircle
                    size={14}
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    {candidateCheck.data === null
                      ? 'This teacher cannot cover this slot.'
                      : `Cannot cover this slot: ${candidateCheck.data.blockingReasons.join('; ')}`}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Available and eligible for this class and subject.
                </span>
              )}
            </div>
          ) : null}

          <FormField
            label={mode === 'create' ? 'Absence Reason' : 'Assignment Notes'}
          >
            <Textarea
              placeholder={
                mode === 'create'
                  ? 'Record the approved absence reason'
                  : 'Optional assignment note'
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="rounded-2xl"
            />
          </FormField>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-8 flex gap-3 sm:justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-xl font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAction}
            className="rounded-xl bg-[var(--color-mod-homework-accent)] px-8 font-bold text-white shadow-sm hover:bg-[var(--color-mod-homework-text)]"
            disabled={
              candidateBlocked ||
              createMutation.isPending ||
              assignMutation.isPending
            }
          >
            {createMutation.isPending || assignMutation.isPending
              ? 'Processing...'
              : mode === 'create'
                ? 'Record & Assign'
                : 'Assign Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

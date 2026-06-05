'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { StaffSelector } from '@/components/staff/staff-selector';

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
  const [substituteTeacherId, setSubstituteTeacherId] = useState(substitution?.substituteTeacherId ?? '');
  const [selectedSlotId, setSelectedSlotId] = useState(slot?.id ?? '');
  const [reason, setReason] = useState(substitution?.reason ?? '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  const selectedSlot = slot ?? slots.find((item) => item.id === selectedSlotId);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createSubstitution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-substitutions'] });
      onClose();
    },
    onError: (err: any) => setError(err.message || 'Failed to create substitution'),
  });

  const assignMutation = useMutation({
    mutationFn: (data: any) => api.assignSubstitution(substitution.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-substitutions'] });
      onClose();
    },
    onError: (err: any) => setError(err.message || 'Failed to assign substitute'),
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
                    {item.subject?.name ?? 'Subject'} / {item.startsAt} - {item.endsAt}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          {mode === 'create' && selectedSlot && (
            <div className="space-y-2 rounded-2xl border border-[var(--color-mod-homework-border)] bg-[var(--color-mod-homework-soft)]/40 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-[var(--color-mod-homework-text)]">Selected Slot</p>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-900">{selectedSlot.subject?.name}</span>
                <span className="text-xs font-medium text-slate-600">{selectedSlot.startsAt} - {selectedSlot.endsAt}</span>
              </div>
              <p className="text-xs text-slate-500">{selectedSlot.class?.name} {selectedSlot.section?.name ? `- ${selectedSlot.section.name}` : ''}</p>
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
            placeholder="Select a replacement teacher"
          />

          <FormField label={mode === 'create' ? 'Absence Reason' : 'Assignment Notes'}>
            <Textarea 
              placeholder={mode === 'create' ? 'Record the approved absence reason' : 'Optional assignment note'}
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
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button 
            onClick={handleAction} 
            className="rounded-xl bg-[var(--color-mod-homework-accent)] px-8 font-bold text-white shadow-sm hover:bg-[var(--color-mod-homework-text)]"
            disabled={createMutation.isPending || assignMutation.isPending}
          >
            {createMutation.isPending || assignMutation.isPending ? 'Processing...' : mode === 'create' ? 'Record & Assign' : 'Assign Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

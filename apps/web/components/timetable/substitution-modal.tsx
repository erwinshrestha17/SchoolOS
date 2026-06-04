'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Users, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2,
  X
} from 'lucide-react';
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

    if (mode === 'create') {
      createMutation.mutate({
        timetableSlotId: selectedSlot.id,
        absentTeacherId: selectedSlot.staffId,
        substituteTeacherId,
        date,
        reason: reason.trim() || 'Teacher Absence',
      });
    } else {
      assignMutation.mutate({
        substituteTeacherId,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tight italic uppercase text-slate-900">
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
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Selected Slot</p>
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

          <FormField label="Reason / Notes">
            <Textarea 
              placeholder="e.g. Medical Leave, Emergency..."
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
            className="bg-slate-900 hover:bg-slate-800 rounded-xl font-bold px-8 shadow-lg"
            disabled={createMutation.isPending || assignMutation.isPending}
          >
            {createMutation.isPending || assignMutation.isPending ? 'Processing...' : mode === 'create' ? 'Record & Assign' : 'Assign Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

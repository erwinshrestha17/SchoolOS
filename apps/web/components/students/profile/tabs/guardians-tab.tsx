'use client';

import { useState } from 'react';
import { GuardianProfile, UpdateStudentGuardianPayload } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MapPin, Edit3 } from 'lucide-react';

type GuardiansTabProps = {
  guardians: GuardianProfile[];
  editingGuardianId: string | null;
  isSaving: boolean;
  error: unknown;
  onCancelEdit: () => void;
  onEditGuardian: (guardianId: string) => void;
  onSaveGuardian: (guardianId: string, body: UpdateStudentGuardianPayload) => void;
};

export function GuardiansTab({
  guardians,
  editingGuardianId,
  isSaving,
  error,
  onCancelEdit,
  onEditGuardian,
  onSaveGuardian,
}: GuardiansTabProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 animate-fade-in">
      {guardians.length > 0 ? (
        guardians.map((guardian) => {
          const isEditing = editingGuardianId === guardian.id;

          return (
            <SectionCard 
              key={guardian.id}
              title={isEditing ? 'Edit Guardian Profile' : guardian.fullName}
              description={isEditing ? undefined : guardian.relation}
              headerAction={
                isEditing ? null : (
                  <div className="flex items-center gap-2">
                    {guardian.isPrimary && <Badge variant="success">Primary</Badge>}
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-primary-500 hover:text-white transition-colors"
                      onClick={() => onEditGuardian(guardian.id)}
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                )
              }
            >
              {isEditing ? (
                <GuardianEditForm
                  guardian={guardian}
                  isSaving={isSaving}
                  error={error}
                  onCancel={onCancelEdit}
                  onSave={(body) => onSaveGuardian(guardian.id, body)}
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <Phone size={14} />
                      </div>
                      <span>{guardian.primaryPhone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <Mail size={14} />
                      </div>
                      <span className="truncate">{guardian.email || 'No email'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <MapPin size={14} />
                      </div>
                      <span>Ward {guardian.wardNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          );
        })
      ) : (
        <div className="col-span-2 py-12 text-center bg-white rounded-[2rem] border border-slate-200">
          <p className="text-slate-400 font-medium">No guardian records found.</p>
        </div>
      )}
    </div>
  );
}

type GuardianEditFormProps = {
  guardian: GuardianProfile;
  isSaving: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (body: UpdateStudentGuardianPayload) => void;
};

function GuardianEditForm({
  guardian,
  isSaving,
  error,
  onCancel,
  onSave,
}: GuardianEditFormProps) {
  const [fullName, setFullName] = useState(guardian.fullName);
  const [relation, setRelation] = useState(guardian.relation);
  const [primaryPhone, setPrimaryPhone] = useState(guardian.primaryPhone || '');
  const [email, setEmail] = useState(guardian.email || '');
  const [wardNumber, setWardNumber] = useState(guardian.wardNumber || '');
  const [isPrimary, setIsPrimary] = useState(guardian.isPrimary);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      fullName,
      relation,
      primaryPhone,
      email: email || null,
      wardNumber: wardNumber || null,
      isPrimary,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!!error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {(error as any).message || 'Failed to save guardian'}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Full Name</label>
        <input
          type="text"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          disabled={isSaving}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Relation</label>
          <select
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none bg-white"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            disabled={isSaving}
          >
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="GUARDIAN">Guardian</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Phone</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={primaryPhone}
            onChange={(e) => setPrimaryPhone(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Email</label>
          <input
            type="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Ward Number</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
            value={wardNumber}
            onChange={(e) => setWardNumber(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          id={`primary-${guardian.id}`}
          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          disabled={isSaving}
        />
        <label htmlFor={`primary-${guardian.id}`} className="text-xs font-bold text-slate-700 select-none">
          Primary Contact Guardian
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}


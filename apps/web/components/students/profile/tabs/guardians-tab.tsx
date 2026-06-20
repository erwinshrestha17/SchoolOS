'use client';

import { useState } from 'react';
import { CreateStudentGuardianPayload, GuardianProfile, UpdateStudentGuardianPayload } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { Badge } from '@/components/ui/badge';
import { Phone, Mail, MapPin, Edit3, Plus, Trash2 } from 'lucide-react';

type GuardiansTabProps = {
  guardians: GuardianProfile[];
  editingGuardianId: string | null;
  isAddingGuardian: boolean;
  isSaving: boolean;
  error: unknown;
  onCancelEdit: () => void;
  onEditGuardian: (guardianId: string) => void;
  onSaveGuardian: (guardianId: string, body: UpdateStudentGuardianPayload) => void;
  onAddGuardian: () => void;
  onCancelAdd: () => void;
  onCreateGuardian: (body: CreateStudentGuardianPayload) => void;
  onRemoveGuardian: (guardianId: string, reason: string, newPrimaryGuardianId?: string | null) => void;
};

export function GuardiansTab({
  guardians,
  editingGuardianId,
  isAddingGuardian,
  isSaving,
  error,
  onCancelEdit,
  onEditGuardian,
  onSaveGuardian,
  onAddGuardian,
  onCancelAdd,
  onCreateGuardian,
  onRemoveGuardian,
}: GuardiansTabProps) {
  const sortedGuardians = [...guardians].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
        <div>
          <p className="text-sm font-black text-slate-950">Guardian management</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">A student must have one or two active guardians, with exactly one Primary.</p>
        </div>
        {guardians.length === 1 ? (
          <button type="button" onClick={onAddGuardian} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-xs font-black uppercase tracking-widest text-white">
            <Plus size={15} />
            Add second guardian
          </button>
        ) : guardians.length >= 2 ? (
          <span className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">Maximum 2 guardians linked</span>
        ) : null}
      </div>
      {isAddingGuardian ? (
        <SectionCard title="Add Second Guardian" description="Use a new guardian or reuse an existing tenant guardian by primary phone.">
          <GuardianEditForm
            isNew
            isSaving={isSaving}
            error={error}
            onCancel={onCancelAdd}
            onSave={(body) => onCreateGuardian(body as CreateStudentGuardianPayload)}
          />
        </SectionCard>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-2">
      {guardians.length > 0 ? (
        sortedGuardians.map((guardian) => {
          const isEditing = editingGuardianId === guardian.id;

          return (
            <SectionCard 
              key={guardian.id}
              title={isEditing ? 'Edit Guardian Profile' : guardian.fullName}
              description={isEditing ? undefined : formatGuardianRelation(guardian.relation)}
              headerAction={
                isEditing ? null : (
                  <div className="flex items-center gap-2">
                    {guardian.isPrimary && <Badge variant="success">Primary</Badge>}
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)] transition-colors hover:bg-[var(--color-mod-admissions-accent)] hover:text-white"
                      onClick={() => onEditGuardian(guardian.id)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <GuardianRemoveButton
                      guardian={guardian}
                      guardians={sortedGuardians}
                      isSaving={isSaving}
                      onRemove={onRemoveGuardian}
                    />
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
                      <span>{guardian.wardNumber ? `Ward ${guardian.wardNumber}` : 'Ward not recorded'}</span>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          );
        })
      ) : (
        <div className="rounded-2xl border border-[var(--color-mod-admissions-border)] bg-white px-6 py-10 text-center lg:col-span-2">
          <p className="text-sm font-bold text-slate-900">No guardians linked</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Guardian actions will appear here once a backend-supported guardian record is linked.
          </p>
        </div>
      )}
      </div>
    </div>
  );
}

type GuardianEditFormProps = {
  guardian: GuardianProfile;
  isNew?: false;
  isSaving: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (body: UpdateStudentGuardianPayload) => void;
};

type NewGuardianEditFormProps = {
  guardian?: undefined;
  isNew: true;
  isSaving: boolean;
  error: unknown;
  onCancel: () => void;
  onSave: (body: CreateStudentGuardianPayload) => void;
};

function GuardianEditForm({
  guardian,
  isNew,
  isSaving,
  error,
  onCancel,
  onSave,
}: GuardianEditFormProps | NewGuardianEditFormProps) {
  const [fullName, setFullName] = useState(guardian?.fullName ?? '');
  const [relation, setRelation] = useState(guardian?.relation ?? 'FATHER');
  const [primaryPhone, setPrimaryPhone] = useState(guardian?.primaryPhone || '');
  const [secondaryPhone, setSecondaryPhone] = useState(guardian?.secondaryPhone || '');
  const [email, setEmail] = useState(guardian?.email || '');
  const [occupation, setOccupation] = useState(guardian?.occupation || '');
  const [wardNumber, setWardNumber] = useState(guardian?.wardNumber || '');
  const [isPrimary, setIsPrimary] = useState(guardian?.isPrimary ?? false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^9[678]\d{8}$/.test(primaryPhone)) {
      setPhoneError('Must be exactly 10 digits starting with 98, 97, or 96');
      return;
    }
    setPhoneError(null);
    onSave({
      fullName,
      relation,
      primaryPhone,
      secondaryPhone: secondaryPhone || null,
      email: email || null,
      occupation: occupation || null,
      wardNumber: wardNumber || null,
      isPrimary,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!!error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {error instanceof Error ? error.message : 'Failed to save guardian'}
        </div>
      )}
      <div className="space-y-2">
        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Full Name</label>
        <input
          type="text"
          className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            disabled={isSaving}
          >
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="LEGAL_GUARDIAN">Legal Guardian</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Phone</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            maxLength={10}
            value={primaryPhone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
              setPrimaryPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            disabled={isSaving}
          />
          {phoneError && (
            <p className="text-[10px] font-bold text-rose-600 mt-1">{phoneError}</p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Secondary Phone</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            value={secondaryPhone}
            onChange={(e) => setSecondaryPhone(e.target.value.replace(/[^\d+\s-]/g, '').slice(0, 20))}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Email</label>
          <input
            type="email"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Occupation</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            disabled={isSaving}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Ward Number</label>
          <input
            type="text"
            className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-[var(--color-mod-admissions-accent)] focus:outline-none"
            value={wardNumber}
            onChange={(e) => setWardNumber(e.target.value)}
            disabled={isSaving}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 py-1">
        <input
          type="checkbox"
          id={`primary-${guardian?.id ?? 'new'}`}
          className="h-4 w-4 rounded border-slate-300 text-[var(--color-mod-admissions-accent)] focus:ring-[var(--color-mod-admissions-accent)]"
          checked={isPrimary}
          onChange={(e) => setIsPrimary(e.target.checked)}
          disabled={isSaving}
        />
        <label htmlFor={`primary-${guardian?.id ?? 'new'}`} className="text-xs font-bold text-slate-700 select-none">
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
          className="rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-mod-admissions-text)] disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : isNew ? 'Add Guardian' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function GuardianRemoveButton({
  guardian,
  guardians,
  isSaving,
  onRemove,
}: {
  guardian: GuardianProfile;
  guardians: GuardianProfile[];
  isSaving: boolean;
  onRemove: (guardianId: string, reason: string, newPrimaryGuardianId?: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const replacement = guardians.find((item) => item.id !== guardian.id) ?? null;
  const blockedReason =
    guardians.length <= 1
      ? 'A student must have at least one guardian.'
      : guardian.isPrimary && !replacement
        ? 'Choose another primary guardian before removing this one.'
        : null;

  if (blockedReason) {
    return (
      <button type="button" disabled title={blockedReason} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
        <Trash2 size={14} />
      </button>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-50 text-danger-600 transition-colors hover:bg-danger-100">
        <Trash2 size={14} />
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-black text-slate-950">Remove guardian?</h3>
            <p className="mt-2 text-sm text-slate-600">Guardian access is revoked immediately and protected-file access review is recorded.</p>
            {guardian.isPrimary && replacement ? <p className="mt-2 text-sm font-semibold text-slate-700">{replacement.fullName} will become Primary.</p> : null}
            <label className="mt-4 block text-xs font-black uppercase tracking-widest text-slate-500">Audit reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-medium normal-case tracking-normal text-slate-900" /></label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">Cancel</button>
              <button type="button" disabled={isSaving || reason.trim().length < 5} onClick={() => { onRemove(guardian.id, reason.trim(), guardian.isPrimary ? replacement?.id : null); setIsOpen(false); }} className="rounded-xl bg-danger-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Remove guardian</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatGuardianRelation(value?: string | null) {
  if (!value) return 'Relation not recorded';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

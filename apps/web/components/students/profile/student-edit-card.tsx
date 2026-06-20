'use client';

import { useState } from 'react';
import { StudentProfileDetail, UpdateStudentProfilePayload } from '@schoolos/core';
import { formatBsDateForInput, parseBsDateInput, toGregorianDateFromBs } from '@schoolos/core';
import { isValidDateOfBirth, isValidPersonName, normalizePersonName } from '@schoolos/core';
import { Accessibility, CheckCircle2, Heart, ImageUp, Save, Trash2, X } from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StudentPhotoPreview } from './student-photo-preview';
import { BsDateField } from '@/components/ui/bs-date-field';

const STUDENT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const STUDENT_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type StudentEditCardProps = {
  profile: StudentProfileDetail;
  isSaving: boolean;
  error: any;
  photoError?: Error | null;
  isUploadingPhoto?: boolean;
  isRemovingPhoto?: boolean;
  onCancel: () => void;
  onUploadPhoto?: (file: File) => void;
  onRemovePhoto?: () => void;
  onSave: (body: UpdateStudentProfilePayload) => void;
};

export function StudentEditCard({ profile, isSaving, error, photoError, isUploadingPhoto, isRemovingPhoto, onCancel, onUploadPhoto, onRemovePhoto, onSave }: StudentEditCardProps) {
  const { student } = profile;
  const [firstNameEn, setFirstNameEn] = useState(student.firstNameEn ?? '');
  const [lastNameEn, setLastNameEn] = useState(student.lastNameEn ?? '');
  const [dateOfBirthBs, setDateOfBirthBs] = useState(student.dateOfBirth ? formatBsDateForInput(student.dateOfBirth) : '');
  const [gender, setGender] = useState(student.gender ?? '');
  const [nationalStudentId, setNationalStudentId] = useState(student.nationalStudentId ?? '');
  const [disabilityStatus, setDisabilityStatus] = useState(student.disabilityFlag ? 'yes' : 'no');
  const [disabilityFlag, setDisabilityFlag] = useState(student.disabilityFlag ?? '');
  const [medicalConditions, setMedicalConditions] = useState(student.medicalConditions ?? '');
  const [severeAllergies, setSevereAllergies] = useState(student.severeAllergies ?? '');
  const [emergencyName, setEmergencyName] = useState(student.emergencyName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(student.emergencyPhone ?? '');
  const [validationError, setValidationError] = useState('');
  const [photoValidationError, setPhotoValidationError] = useState('');
  const [removePhotoDialogOpen, setRemovePhotoDialogOpen] = useState(false);
  const isPhotoBusy = Boolean(isUploadingPhoto || isRemovingPhoto);
  const hasPhoto = Boolean(student.photoUrl);

  const handlePhotoSelection = (file: File | undefined) => {
    setPhotoValidationError('');
    if (!file) return;
    if (!STUDENT_PHOTO_MIME_TYPES.has(file.type)) { setPhotoValidationError('Use a JPG, PNG, or WEBP image for the student photo.'); return; }
    if (file.size > STUDENT_PHOTO_MAX_BYTES) { setPhotoValidationError('Student photo must be 2MB or smaller.'); return; }
    onUploadPhoto?.(file);
  };

  const handleSave = () => {
    setValidationError('');
    if (!isValidPersonName(firstNameEn) || !isValidPersonName(lastNameEn)) { setValidationError('Enter valid student names.'); return; }
    if (!dateOfBirthBs) { setValidationError('Date of birth is required.'); return; }
    let dateOfBirth: string;
    try {
      const gregorian = toGregorianDateFromBs(parseBsDateInput(dateOfBirthBs));
      dateOfBirth = `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Enter a valid BS date of birth.');
      return;
    }
    if (!isValidDateOfBirth(dateOfBirth)) { setValidationError('Date of birth cannot be future or more than 120 years ago.'); return; }
    if (disabilityStatus === 'yes' && !disabilityFlag.trim()) { setValidationError('Add disability support details or select no known disability.'); return; }
    onSave({
      firstNameEn: normalizePersonName(firstNameEn), lastNameEn: normalizePersonName(lastNameEn), dateOfBirth,
      ...(gender ? { gender } : {}), nationalStudentId: nationalStudentId.trim() || null,
      disabilityFlag: disabilityStatus === 'yes' ? disabilityFlag.trim() : null,
      confirmNoDisability: disabilityStatus === 'no', medicalConditions: medicalConditions.trim() || null,
      severeAllergies: severeAllergies.trim() || null, emergencyName: emergencyName.trim() || null,
      emergencyPhone: emergencyPhone.trim() || null,
    });
  };

  return <>
    <SectionCard title="Edit Profile" description={`Updating record for ${student.studentSystemId}`} className="animate-in fade-in slide-in-from-top-4">
      <div className="grid gap-8">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><StudentPhotoPreview studentId={student.id} photoVersion={student.photoUrl} alt={`${student.firstNameEn} ${student.lastNameEn} profile photo`} /><div><p className="text-sm font-bold text-slate-900">Student photo</p><p className="mt-1 max-w-md text-xs font-medium text-slate-500">JPG, PNG, or WEBP only, up to 2MB. The preview is loaded through an authenticated protected-file endpoint.</p>{isPhotoBusy ? <p className="mt-2 text-xs font-bold text-[var(--color-mod-admissions-text)]">{isUploadingPhoto ? 'Uploading photo…' : 'Removing photo…'}</p> : null}</div></div><div className="flex flex-wrap gap-2"><label className={cn('inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-mod-admissions-text)]', isPhotoBusy && 'cursor-not-allowed opacity-50')}><ImageUp size={16} />{isUploadingPhoto ? 'Uploading…' : hasPhoto ? 'Replace' : 'Upload'}<input aria-label="Upload student photo" data-testid="student-photo-upload-input" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={isPhotoBusy} onChange={(event) => { handlePhotoSelection(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label>{hasPhoto ? <button type="button" onClick={() => setRemovePhotoDialogOpen(true)} disabled={isPhotoBusy} data-testid="student-photo-remove-button" className="inline-flex items-center gap-2 rounded-xl border border-danger-100 bg-white px-4 py-2.5 text-sm font-bold text-danger-600 transition hover:bg-danger-50 disabled:opacity-50"><Trash2 size={16} />{isRemovingPhoto ? 'Removing…' : 'Remove'}</button> : null}</div></div>{photoValidationError ? <p className="mt-3 text-sm font-bold text-danger-500">{photoValidationError}</p> : null}{photoError ? <p className="mt-3 text-sm font-bold text-danger-500">{photoError.message}</p> : null}</div>

        <div className="grid gap-6 md:grid-cols-2"><FormField label="First Name (EN)"><input className="premium-input" value={firstNameEn} onChange={(e) => setFirstNameEn(e.target.value)} /></FormField><FormField label="Last Name (EN)"><input className="premium-input" value={lastNameEn} onChange={(e) => setLastNameEn(e.target.value)} /></FormField><BsDateField label="Date of Birth (BS)" value={dateOfBirthBs} onChange={setDateOfBirthBs} required /><FormField label="Gender"><select className="premium-input" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Select gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></FormField></div>

        <div className="space-y-6 rounded-2xl bg-slate-50 p-6"><p className="flex items-center gap-2 text-sm font-bold text-slate-900"><Heart size={18} className="text-danger-500" />Health & Special Needs</p><div className="grid gap-6 md:grid-cols-2"><FormField label="Medical Conditions"><input className="premium-input bg-white" value={medicalConditions} onChange={(e) => setMedicalConditions(e.target.value)} placeholder="e.g. Asthma" /></FormField><FormField label="Severe Allergies"><input className="premium-input bg-white" value={severeAllergies} onChange={(e) => setSevereAllergies(e.target.value)} placeholder="e.g. Peanuts" /></FormField></div>
          <fieldset className="space-y-3"><legend className="ml-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">Disability status</legend><p className="text-sm text-slate-600">Choose the option that best reflects the support information recorded for this student.</p><div role="radiogroup" aria-label="Disability status" className="grid gap-3 sm:grid-cols-2"><DisabilityOption active={disabilityStatus === 'no'} title="No known disability" description="No disability support details are currently recorded." onClick={() => { setDisabilityStatus('no'); setDisabilityFlag(''); }} /><DisabilityOption active={disabilityStatus === 'yes'} title="Disability support recorded" description="Record the relevant support or accessibility details." onClick={() => setDisabilityStatus('yes')} /></div>{disabilityStatus === 'yes' ? <FormField label="Disability support details"><input className="premium-input bg-white" value={disabilityFlag} onChange={(e) => setDisabilityFlag(e.target.value)} placeholder="Describe the recorded support needs" /></FormField> : null}</fieldset>
        </div>

        <div className="grid gap-6 md:grid-cols-2"><FormField label="Emergency Contact Name"><input className="premium-input" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} /></FormField><FormField label="Emergency Phone"><input className="premium-input" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} /></FormField></div>
        {validationError ? <p className="text-sm font-bold text-danger-500">{validationError}</p> : null}{error ? <p className="text-sm font-bold text-danger-500">{error.message}</p> : null}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6"><button type="button" onClick={onCancel} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900"><X size={18} />Cancel</button><button type="button" onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] disabled:opacity-50"><Save size={18} />{isSaving ? 'Saving…' : 'Save Changes'}</button></div>
      </div>
    </SectionCard>
    <ConfirmDialog isOpen={removePhotoDialogOpen} title="Remove Student Photo" description="Remove this profile photo? The student record will remain, but the protected preview will no longer be available." confirmLabel="Remove Photo" destructive isConfirming={isRemovingPhoto} onConfirm={() => { onRemovePhoto?.(); setRemovePhotoDialogOpen(false); }} onClose={() => setRemovePhotoDialogOpen(false)} />
  </>;
}

function DisabilityOption({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) { return <button type="button" role="radio" aria-checked={active} onClick={onClick} className={cn('flex w-full items-start gap-3 rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-accent)] focus:ring-offset-2', active ? 'border-[var(--color-mod-admissions-accent)] bg-[var(--color-mod-admissions-bg)] shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50')}><span className={cn('mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', active ? 'border-[var(--color-mod-admissions-accent)] bg-[var(--color-mod-admissions-accent)] text-white' : 'border-slate-300 bg-white text-transparent')}><CheckCircle2 className="h-4 w-4" /></span><span><span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Accessibility className="h-4 w-4 text-slate-500" />{title}</span><span className="mt-1 block text-sm leading-5 text-slate-600">{description}</span></span></button>; }
function FormField({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <div className="space-y-1.5"><label className="ml-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">{label}</label>{children}{error ? <p className="ml-1 text-[0.7rem] font-bold text-danger-500">{error}</p> : null}</div>; }

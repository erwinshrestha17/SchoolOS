'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  StudentProfileDetail,
  UpdateStudentProfilePayload,
} from '@schoolos/core';
import {
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
} from '@schoolos/core';
import {
  isValidDateOfBirth,
  isValidPersonName,
  normalizePersonName,
} from '@schoolos/core';
import {
  Accessibility,
  CheckCircle2,
  Heart,
  ImageUp,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { SectionCard } from '@/components/ui/section-card';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StudentPhotoPreview } from './student-photo-preview';
import { BsDateField } from '@/components/ui/bs-date-field';
import { api } from '@/lib/api';
import { schoolFacingErrorMessage } from '@/lib/school-facing-error';

const STUDENT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const STUDENT_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
  focusTarget?: string | null;
};

export function StudentEditCard({
  profile,
  isSaving,
  error,
  photoError,
  isUploadingPhoto,
  isRemovingPhoto,
  onCancel,
  onUploadPhoto,
  onRemovePhoto,
  onSave,
  focusTarget,
}: StudentEditCardProps) {
  const { student } = profile;
  const activeEnrollment =
    profile.enrollments.find(
      (enrollment) => enrollment.status.toUpperCase() === 'ACTIVE',
    ) ?? null;
  const [firstNameEn, setFirstNameEn] = useState(student.firstNameEn ?? '');
  const [lastNameEn, setLastNameEn] = useState(student.lastNameEn ?? '');
  const [firstNameNp, setFirstNameNp] = useState(student.firstNameNp ?? '');
  const [lastNameNp, setLastNameNp] = useState(student.lastNameNp ?? '');
  const [dateOfBirthBs, setDateOfBirthBs] = useState(
    student.dateOfBirth ? formatBsDateForInput(student.dateOfBirth) : '',
  );
  const [gender, setGender] = useState(student.gender ?? '');
  const [nationality, setNationality] = useState(student.nationality ?? '');
  const [nationalStudentId, setNationalStudentId] = useState(
    student.nationalStudentId ?? '',
  );
  const [classId, setClassId] = useState(activeEnrollment?.classId ?? '');
  const [sectionId, setSectionId] = useState(activeEnrollment?.sectionId ?? '');
  const [rollNumber, setRollNumber] = useState(
    activeEnrollment?.rollNumber?.toString() ?? '',
  );
  const [disabilityStatus, setDisabilityStatus] = useState(
    student.disabilityFlag ? 'yes' : '',
  );
  const [disabilityFlag, setDisabilityFlag] = useState(
    student.disabilityFlag ?? '',
  );
  const [medicalConditions, setMedicalConditions] = useState(
    student.medicalConditions ?? '',
  );
  const [severeAllergies, setSevereAllergies] = useState(
    student.severeAllergies ?? '',
  );
  const [emergencyName, setEmergencyName] = useState(
    student.emergencyName ?? '',
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    student.emergencyPhone ?? '',
  );
  const [validationError, setValidationError] = useState('');
  const [photoValidationError, setPhotoValidationError] = useState('');
  const [removePhotoDialogOpen, setRemovePhotoDialogOpen] = useState(false);
  const isPhotoBusy = Boolean(isUploadingPhoto || isRemovingPhoto);
  const hasPhoto = Boolean(student.photoVersion);
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const availableSections = (sectionsQuery.data ?? []).filter(
    (section) => (section.classId ?? section.class?.id) === classId,
  );

  const handlePhotoSelection = (file: File | undefined) => {
    setPhotoValidationError('');
    if (!file) return;
    if (!STUDENT_PHOTO_MIME_TYPES.has(file.type)) {
      setPhotoValidationError(
        'Use a JPG, PNG, or WEBP image for the student photo.',
      );
      return;
    }
    if (file.size > STUDENT_PHOTO_MAX_BYTES) {
      setPhotoValidationError('Student photo must be 2MB or smaller.');
      return;
    }
    onUploadPhoto?.(file);
  };

  const handleSave = () => {
    setValidationError('');
    if (!isValidPersonName(firstNameEn) || !isValidPersonName(lastNameEn)) {
      setValidationError('Enter valid student names.');
      return;
    }
    if (
      (firstNameNp.trim() && !lastNameNp.trim()) ||
      (!firstNameNp.trim() && lastNameNp.trim())
    ) {
      setValidationError(
        'Enter both Nepali first and last names, or leave both blank for authorized follow-up.',
      );
      return;
    }
    if (!nationality.trim()) {
      setValidationError('Nationality is required.');
      return;
    }
    if (!dateOfBirthBs) {
      setValidationError('Date of birth is required.');
      return;
    }
    let dateOfBirth: string;
    try {
      const gregorian = toGregorianDateFromBs(parseBsDateInput(dateOfBirthBs));
      dateOfBirth = `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
    } catch (error) {
      setValidationError('Enter a valid BS date of birth.');
      return;
    }
    if (!isValidDateOfBirth(dateOfBirth)) {
      setValidationError(
        'Date of birth cannot be future or more than 120 years ago.',
      );
      return;
    }
    if (!disabilityStatus) {
      setValidationError(
        'Review the recorded disability status before saving. SchoolOS will not infer this sensitive detail.',
      );
      return;
    }
    if (disabilityStatus === 'yes' && !disabilityFlag.trim()) {
      setValidationError(
        'Add disability support details or select no known disability after reviewing the official record.',
      );
      return;
    }
    if (activeEnrollment && !classId) {
      setValidationError('Select a class for the active enrollment.');
      return;
    }
    const parsedRollNumber = rollNumber.trim() ? Number(rollNumber) : null;
    if (
      parsedRollNumber !== null &&
      (!Number.isInteger(parsedRollNumber) || parsedRollNumber < 1)
    ) {
      setValidationError(
        'Roll number must be a whole number greater than zero.',
      );
      return;
    }
    onSave({
      firstNameEn: normalizePersonName(firstNameEn),
      lastNameEn: normalizePersonName(lastNameEn),
      dateOfBirth,
      firstNameNp: firstNameNp.trim() ? normalizePersonName(firstNameNp) : null,
      lastNameNp: lastNameNp.trim() ? normalizePersonName(lastNameNp) : null,
      ...(gender ? { gender } : {}),
      nationality: nationality.trim(),
      nationalStudentId: nationalStudentId.trim() || null,
      ...(activeEnrollment
        ? {
            classId,
            sectionId: sectionId || null,
            rollNumber: parsedRollNumber,
          }
        : {}),
      disabilityFlag: disabilityStatus === 'yes' ? disabilityFlag.trim() : null,
      confirmNoDisability: disabilityStatus === 'no',
      medicalConditions: medicalConditions.trim() || null,
      severeAllergies: severeAllergies.trim() || null,
      emergencyName: emergencyName.trim() || null,
      emergencyPhone: emergencyPhone.trim() || null,
    });
  };

  return (
    <>
      <SectionCard
        title="Edit Profile"
        description={`Updating record for ${student.studentSystemId}`}
        className="animate-in fade-in slide-in-from-top-4"
      >
        <div className="grid gap-8">
          {focusTarget ? (
            <div
              role="status"
              className="rounded-2xl border border-[var(--color-mod-admissions-border)] bg-[var(--color-mod-admissions-bg)] p-4 text-sm font-semibold leading-6 text-[var(--color-mod-admissions-text)]"
            >
              Review the highlighted government-reporting detail, then save.
              SchoolOS will check readiness again.
            </div>
          ) : null}
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <StudentPhotoPreview
                  studentId={student.id}
                  photoVersion={student.photoVersion}
                  alt={`${student.firstNameEn} ${student.lastNameEn} profile photo`}
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    Student photo
                  </p>
                  <p className="mt-1 max-w-md text-xs font-medium text-slate-500">
                    JPG, PNG, or WEBP only, up to 2MB. The preview is loaded
                    through protected school access.
                  </p>
                  {isPhotoBusy ? (
                    <p className="mt-2 text-xs font-bold text-[var(--color-mod-admissions-text)]">
                      {isUploadingPhoto
                        ? 'Uploading photo…'
                        : 'Removing photo…'}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <label
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-mod-admissions-text)]',
                    isPhotoBusy && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <ImageUp size={16} />
                  {isUploadingPhoto
                    ? 'Uploading…'
                    : hasPhoto
                      ? 'Replace'
                      : 'Upload'}
                  <input
                    aria-label="Upload student photo"
                    data-testid="student-photo-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={isPhotoBusy}
                    onChange={(event) => {
                      handlePhotoSelection(event.target.files?.[0]);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
                {hasPhoto ? (
                  <button
                    type="button"
                    onClick={() => setRemovePhotoDialogOpen(true)}
                    disabled={isPhotoBusy}
                    data-testid="student-photo-remove-button"
                    className="inline-flex items-center gap-2 rounded-xl border border-danger-100 bg-white px-4 py-2.5 text-sm font-bold text-danger-600 transition hover:bg-danger-50 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    {isRemovingPhoto ? 'Removing…' : 'Remove'}
                  </button>
                ) : null}
              </div>
            </div>
            {photoValidationError ? (
              <p className="mt-3 text-sm font-bold text-danger-500">
                {photoValidationError}
              </p>
            ) : null}
            {photoError ? (
              <p className="mt-3 text-sm font-bold text-danger-500">
                {schoolFacingErrorMessage(photoError, {
                  fallback:
                    'The student photo could not be updated. The existing photo was not changed.',
                  invalid:
                    'Use a valid JPG, PNG, or WEBP image that is 2MB or smaller.',
                  forbidden:
                    'You do not have permission to change this student photo.',
                  notFound: 'This student record is no longer available.',
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Official identity
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                Enter only verified identity details. SchoolOS does not infer
                gender, nationality, disability, ethnicity, language, caste, or
                religion from a student’s name.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="First Name (EN)">
                <input
                  autoFocus={focusTarget === 'fullNameEn'}
                  className="premium-input"
                  value={firstNameEn}
                  onChange={(e) => setFirstNameEn(e.target.value)}
                />
              </FormField>
              <FormField label="Last Name (EN)">
                <input
                  className="premium-input"
                  value={lastNameEn}
                  onChange={(e) => setLastNameEn(e.target.value)}
                />
              </FormField>
              <FormField label="First Name (NP)">
                <input
                  autoFocus={focusTarget === 'fullNameNp'}
                  className="premium-input"
                  value={firstNameNp}
                  onChange={(e) => setFirstNameNp(e.target.value)}
                />
              </FormField>
              <FormField label="Last Name (NP)">
                <input
                  className="premium-input"
                  value={lastNameNp}
                  onChange={(e) => setLastNameNp(e.target.value)}
                />
              </FormField>
              <BsDateField
                label="Date of Birth (BS)"
                value={dateOfBirthBs}
                onChange={setDateOfBirthBs}
                required
              />
              <FormField label="Gender">
                <select
                  autoFocus={focusTarget === 'gender'}
                  className="premium-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select gender after review</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                  <option value="OTHER">Other</option>
                </select>
              </FormField>
              <FormField label="Nationality">
                <input
                  autoFocus={focusTarget === 'nationality'}
                  className="premium-input"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                />
              </FormField>
              <FormField label="iEMIS identifier">
                <input
                  autoFocus={focusTarget === 'nationalStudentId'}
                  className="premium-input"
                  value={nationalStudentId}
                  onChange={(e) => setNationalStudentId(e.target.value)}
                  placeholder="Add only after verification"
                />
              </FormField>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <p className="text-sm font-bold text-slate-900">
                Active enrollment placement
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                Class, section, and roll number update the same active
                enrollment shown across this student profile.
              </p>
            </div>
            {activeEnrollment ? (
              <div className="grid gap-6 md:grid-cols-3">
                <FormField label="Class">
                  <select
                    autoFocus={focusTarget === 'placement' && !sectionId}
                    className="premium-input"
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      setSectionId('');
                    }}
                    disabled={classesQuery.isLoading || classesQuery.isError}
                  >
                    <option value="">Select class</option>
                    {(classesQuery.data ?? []).map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Section">
                  <select
                    autoFocus={
                      focusTarget === 'placement' && Boolean(sectionId)
                    }
                    className="premium-input"
                    value={sectionId}
                    onChange={(event) => setSectionId(event.target.value)}
                    disabled={
                      sectionsQuery.isLoading ||
                      sectionsQuery.isError ||
                      !classId
                    }
                  >
                    <option value="">Not assigned</option>
                    {availableSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Roll number">
                  <input
                    className="premium-input"
                    inputMode="numeric"
                    value={rollNumber}
                    onChange={(event) => setRollNumber(event.target.value)}
                    placeholder="Not assigned"
                  />
                </FormField>
              </div>
            ) : (
              <p className="rounded-xl bg-warning-50 p-4 text-sm font-semibold leading-6 text-warning-800">
                No active enrollment can be corrected from this form. Contact an
                authorized admissions administrator to create or restore the
                enrollment.
              </p>
            )}
            {classesQuery.isError || sectionsQuery.isError ? (
              <p className="text-xs font-semibold text-danger-600">
                Placement choices could not be loaded. Existing placement will
                not be changed until the choices are available.
              </p>
            ) : null}
          </div>

          <div className="space-y-6 rounded-2xl bg-slate-50 p-6">
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Heart size={18} className="text-danger-500" />
              Health & Special Needs
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <FormField label="Medical Conditions">
                <input
                  className="premium-input bg-white"
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  placeholder="e.g. Asthma"
                />
              </FormField>
              <FormField label="Severe Allergies">
                <input
                  className="premium-input bg-white"
                  value={severeAllergies}
                  onChange={(e) => setSevereAllergies(e.target.value)}
                  placeholder="e.g. Peanuts"
                />
              </FormField>
            </div>
            <fieldset className="space-y-3">
              <legend className="ml-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
                Disability status
              </legend>
              <p className="text-sm text-slate-600">
                Choose the option that best reflects the support information
                recorded for this student.
              </p>
              <div
                role="radiogroup"
                aria-label="Disability status"
                className="grid gap-3 sm:grid-cols-2"
              >
                <DisabilityOption
                  active={disabilityStatus === 'no'}
                  title="No known disability"
                  description="No disability support details are currently recorded."
                  onClick={() => {
                    setDisabilityStatus('no');
                    setDisabilityFlag('');
                  }}
                />
                <DisabilityOption
                  active={disabilityStatus === 'yes'}
                  title="Disability support recorded"
                  description="Record the relevant support or accessibility details."
                  onClick={() => setDisabilityStatus('yes')}
                />
              </div>
              {disabilityStatus === 'yes' ? (
                <FormField label="Disability support details">
                  <input
                    className="premium-input bg-white"
                    value={disabilityFlag}
                    onChange={(e) => setDisabilityFlag(e.target.value)}
                    placeholder="Describe the recorded support needs"
                  />
                </FormField>
              ) : null}
            </fieldset>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <FormField label="Emergency Contact Name">
              <input
                className="premium-input"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </FormField>
            <FormField label="Emergency Phone">
              <input
                className="premium-input"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
              />
            </FormField>
          </div>
          {validationError ? (
            <p className="text-sm font-bold text-danger-500">
              {validationError}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm font-bold text-danger-500">
              {schoolFacingErrorMessage(error, {
                fallback:
                  'The student profile could not be saved. Existing details were not changed.',
                invalid:
                  'Review the student identity, enrollment, and required support details.',
                forbidden:
                  'You do not have permission to update this student profile.',
                notFound: 'This student record is no longer available.',
                conflict:
                  'This student profile changed while you were editing it. Refresh and try again.',
              })}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-900"
            >
              <X size={18} />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-8 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-mod-admissions-text)] disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </SectionCard>
      <ConfirmDialog
        isOpen={removePhotoDialogOpen}
        title="Remove Student Photo"
        description="Remove this profile photo? The student record will remain, but the protected preview will no longer be available."
        confirmLabel="Remove Photo"
        destructive
        isConfirming={isRemovingPhoto}
        onConfirm={() => {
          onRemovePhoto?.();
          setRemovePhotoDialogOpen(false);
        }}
        onClose={() => setRemovePhotoDialogOpen(false)}
      />
    </>
  );
}

function DisabilityOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--color-mod-admissions-accent)] focus:ring-offset-2',
        active
          ? 'border-[var(--color-mod-admissions-accent)] bg-[var(--color-mod-admissions-bg)] shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          active
            ? 'border-[var(--color-mod-admissions-accent)] bg-[var(--color-mod-admissions-accent)] text-white'
            : 'border-slate-300 bg-white text-transparent',
        )}
      >
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <span>
        <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Accessibility className="h-4 w-4 text-slate-500" />
          {title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-slate-600">
          {description}
        </span>
      </span>
    </button>
  );
}
function FormField({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="ml-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      {children}
      {error ? (
        <p className="ml-1 text-[0.7rem] font-bold text-danger-500">{error}</p>
      ) : null}
    </div>
  );
}

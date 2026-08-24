"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GUARDIAN_RECOVERY_ACTIONS,
  GUARDIAN_RECOVERY_VERIFICATION_METHODS,
  type CreateStudentGuardianPayload,
  type GuardianAccessAdministration,
  type GuardianCapability,
  type GuardianProfile,
  type GuardianRecoveryAction,
  type GuardianRecoveryActionPayload,
  type GuardianRecoveryVerificationMethod,
  type UpdateStudentGuardianPayload,
  formatBsDate,
  formatBsDateForInput,
  getNepalMobileCarrier,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizeNepalPhone,
  normalizePersonName,
  toGregorianDateFromBs,
  tryNormalizeNepalPhone,
} from "@schoolos/core";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  History,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Smartphone,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/components/session-provider";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/section-card";
import { schoolFacingErrorMessage } from "@/lib/school-facing-error";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[var(--color-mod-admissions-accent)] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

const enabledCapabilities: Array<{
  value: GuardianCapability;
  label: string;
  description: string;
}> = [
  {
    value: "ACADEMICS_VIEW",
    label: "Academic information",
    description: "Homework, results, library, and school learning records.",
  },
  {
    value: "ATTENDANCE_VIEW",
    label: "Attendance",
    description: "Attendance summaries and approved attendance detail.",
  },
  {
    value: "FEES_VIEW",
    label: "Fees and receipts",
    description: "School-owned fee balances and protected receipts.",
  },
  {
    value: "EMERGENCY_ALERT_RECEIVE",
    label: "Emergency alerts",
    description: "Important safety and emergency notices for this child.",
  },
  {
    value: "SCHOOL_COMMUNICATE",
    label: "School communication",
    description: "Notices and school communication for this child.",
  },
];

const deferredCapabilities: Array<{
  value: GuardianCapability;
  label: string;
}> = [
  { value: "LEAVE_MANAGE", label: "Leave requests" },
  { value: "FEES_PAY", label: "Online payments" },
  { value: "SPECIFIC_CONSENT_GIVE", label: "Specific consent" },
  { value: "PICKUP_AUTHORIZE", label: "Pickup authorization" },
  {
    value: "COMPLAINT_OR_CORRECTION_SUBMIT",
    label: "Complaints and corrections",
  },
];

type GuardiansTabProps = {
  studentId: string;
  guardians: GuardianProfile[];
  editingGuardianId: string | null;
  isAddingGuardian: boolean;
  isSaving: boolean;
  error: unknown;
  onCancelEdit: () => void;
  onEditGuardian: (guardianId: string) => void;
  onSaveGuardian: (
    guardianId: string,
    body: UpdateStudentGuardianPayload,
  ) => void;
  onAddGuardian: () => void;
  onCancelAdd: () => void;
  onCreateGuardian: (body: CreateStudentGuardianPayload) => void;
};

export function GuardiansTab({
  studentId,
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
}: GuardiansTabProps) {
  const { session, hasPermissions } = useSession();
  const isSupportOverride = session?.user.isSupportOverride === true;
  const canCreate = !isSupportOverride && hasPermissions(["guardians:create"]);
  const canUpdate = !isSupportOverride && hasPermissions(["guardians:update"]);
  const canVerify = !isSupportOverride && hasPermissions(["guardians:verify"]);
  const canAdministerRecovery =
    !isSupportOverride &&
    hasPermissions([
      "guardians:update",
      "guardians:verify",
      "users:reset_password",
    ]);
  const canProvisionAccount =
    !isSupportOverride &&
    hasPermissions(["guardians:update", "guardians:verify", "users:create"]);
  const canViewAccessAdministration =
    canAdministerRecovery || canProvisionAccount || canVerify;
  const sortedGuardians = [...guardians].sort(
    (a, b) =>
      guardianStatusOrder(a.status) - guardianStatusOrder(b.status) ||
      Number(b.isPrimary) - Number(a.isPrimary) ||
      (a.emergencyContactPriority ?? 99) - (b.emergencyContactPriority ?? 99),
  );

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4">
        <div>
          <p className="text-sm font-black text-slate-950">
            Guardian relationships and access
          </p>
          <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-500">
            Record each real family relationship separately. Access is granted
            per child, can be time-limited, and can be revoked immediately.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={onAddGuardian}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-xs font-black uppercase tracking-widest text-white"
          >
            <Plus size={15} aria-hidden="true" />
            Link guardian
          </button>
        ) : null}
      </div>

      {isAddingGuardian ? (
        <SectionCard
          title="Link guardian"
          description="New relationships begin without parent-app access until verification, approval, and capabilities are recorded."
        >
          <GuardianEditForm
            isNew
            isSaving={isSaving}
            error={error}
            forcePrimary={guardians.length === 0}
            canVerify={canVerify}
            onCancel={onCancelAdd}
            onSave={(body) => onCreateGuardian(body)}
          />
        </SectionCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {sortedGuardians.length > 0 ? (
          sortedGuardians.map((guardian) => {
            const isEditing = editingGuardianId === guardian.id;

            return (
              <SectionCard
                key={guardian.id}
                title={
                  isEditing ? "Edit guardian relationship" : guardian.fullName
                }
                description={
                  isEditing
                    ? "Contact information and this child’s access authority are stored separately."
                    : formatGuardianRelation(guardian.relation)
                }
                headerAction={
                  isEditing ? null : (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {guardian.isPrimary ? (
                        <Badge variant="success">Primary</Badge>
                      ) : null}
                      <Badge
                        variant={relationshipStatusVariant(guardian.status)}
                      >
                        {formatTokenLabel(guardian.status)}
                      </Badge>
                      {canUpdate ? (
                        <button
                          type="button"
                          aria-label={`Edit ${guardian.fullName}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-mod-admissions-bg)] text-[var(--color-mod-admissions-accent)] transition-colors hover:bg-[var(--color-mod-admissions-accent)] hover:text-white"
                          onClick={() => onEditGuardian(guardian.id)}
                        >
                          <Edit3 size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  )
                }
              >
                {isEditing ? (
                  <GuardianEditForm
                    guardian={guardian}
                    isSaving={isSaving}
                    error={error}
                    canVerify={canVerify}
                    onCancel={onCancelEdit}
                    onSave={(body) => onSaveGuardian(guardian.id, body)}
                  />
                ) : (
                  <div className="space-y-5">
                    <GuardianSummary guardian={guardian} />
                    {canViewAccessAdministration ? (
                      <GuardianAccessPanel
                        studentId={studentId}
                        guardian={guardian}
                        canAdministerRecovery={canAdministerRecovery}
                        canProvisionAccount={canProvisionAccount}
                        canVerify={canVerify}
                      />
                    ) : null}
                  </div>
                )}
              </SectionCard>
            );
          })
        ) : (
          <div className="rounded-2xl border border-[var(--color-mod-admissions-border)] bg-white px-6 py-10 text-center lg:col-span-2">
            <p className="text-sm font-bold text-slate-900">
              No guardians linked
            </p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Link a verified family or legal relationship before enabling
              parent access.
            </p>
            {canCreate ? (
              <button
                type="button"
                onClick={onAddGuardian}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 text-xs font-black uppercase tracking-widest text-white"
              >
                <Plus size={15} aria-hidden="true" />
                Link guardian
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function GuardianSummary({ guardian }: { guardian: GuardianProfile }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <ContactLine icon={<Phone size={14} />} text={guardian.primaryPhone} />
        <ContactLine
          icon={<Mail size={14} />}
          text={guardian.email || "Email not recorded"}
        />
        <ContactLine
          icon={<MapPin size={14} />}
          text={
            guardian.wardNumber
              ? `Ward ${guardian.wardNumber}`
              : "Ward not recorded"
          }
        />
        <ContactLine
          icon={<ShieldCheck size={14} />}
          text={`${formatTokenLabel(guardian.verificationStatus)} · ${formatTokenLabel(guardian.approvalStatus)}`}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          {guardian.capabilities.length > 0 ? (
            guardian.capabilities.map((capability) => (
              <Badge key={capability} variant="info">
                {capabilityLabel(capability)}
              </Badge>
            ))
          ) : (
            <Badge variant="warning">No parent-app capabilities</Badge>
          )}
        </div>
        <dl className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <dt className="font-bold text-slate-500">Effective from</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {formatBsDate(guardian.effectiveFrom)}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Effective until</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {guardian.effectiveUntil
                ? formatBsDate(guardian.effectiveUntil)
                : "No scheduled end"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Emergency priority</dt>
            <dd className="mt-0.5 font-semibold text-slate-900">
              {guardian.emergencyContactPriority ?? "Not assigned"}
            </dd>
          </div>
          <div>
            <dt className="font-bold text-slate-500">Restriction reference</dt>
            <dd className="mt-0.5 break-words font-semibold text-slate-900">
              {guardian.restrictionReasonRef || "No restriction recorded"}
            </dd>
          </div>
        </dl>
      </div>
    </>
  );
}

function ContactLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 text-sm text-slate-600">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        {icon}
      </div>
      <span className="truncate">{text}</span>
    </div>
  );
}

type GuardianEditFormProps = {
  guardian: GuardianProfile;
  isNew?: false;
  forcePrimary?: boolean;
  isSaving: boolean;
  error: unknown;
  canVerify: boolean;
  onCancel: () => void;
  onSave: (body: UpdateStudentGuardianPayload) => void;
};

type NewGuardianEditFormProps = {
  guardian?: undefined;
  isNew: true;
  forcePrimary?: boolean;
  isSaving: boolean;
  error: unknown;
  canVerify: boolean;
  onCancel: () => void;
  onSave: (body: CreateStudentGuardianPayload) => void;
};

function GuardianEditForm({
  guardian,
  isNew,
  forcePrimary = false,
  isSaving,
  error,
  canVerify,
  onCancel,
  onSave,
}: GuardianEditFormProps | NewGuardianEditFormProps) {
  const [fullName, setFullName] = useState(guardian?.fullName ?? "");
  const [relation, setRelation] = useState(
    guardian?.relation ?? "LEGAL_GUARDIAN",
  );
  const [primaryPhone, setPrimaryPhone] = useState(
    guardian?.primaryPhone || "",
  );
  const [secondaryPhone, setSecondaryPhone] = useState(
    guardian?.secondaryPhone || "",
  );
  const [email, setEmail] = useState(guardian?.email || "");
  const [occupation, setOccupation] = useState(guardian?.occupation || "");
  const [wardNumber, setWardNumber] = useState(guardian?.wardNumber || "");
  const [isPrimary, setIsPrimary] = useState(
    forcePrimary || guardian?.isPrimary || false,
  );
  const [capabilities, setCapabilities] = useState<GuardianCapability[]>(
    guardian?.capabilities ?? [],
  );
  const [verificationStatus, setVerificationStatus] = useState(
    guardian?.verificationStatus ?? "UNVERIFIED",
  );
  const [approvalStatus, setApprovalStatus] = useState(
    guardian?.approvalStatus ?? "PENDING",
  );
  const [effectiveFromBs, setEffectiveFromBs] = useState(
    safeBsInput(guardian?.effectiveFrom ?? new Date()),
  );
  const [effectiveUntilBs, setEffectiveUntilBs] = useState(
    guardian?.effectiveUntil ? safeBsInput(guardian.effectiveUntil) : "",
  );
  const [emergencyPriority, setEmergencyPriority] = useState(
    guardian?.emergencyContactPriority?.toString() ?? "",
  );
  const [restrictionReference, setRestrictionReference] = useState(
    guardian?.restrictionReasonRef ?? "",
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleCapability = (capability: GuardianCapability) => {
    setCapabilities((current) =>
      current.includes(capability)
        ? current.filter((item) => item !== capability)
        : [...current, capability],
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidPersonName(fullName)) {
      setValidationError("Enter a valid guardian name.");
      return;
    }
    if (isNew && !tryNormalizeNepalPhone(primaryPhone)) {
      setValidationError("Enter a valid NTC or Ncell mobile number.");
      return;
    }
    if (secondaryPhone && !tryNormalizeNepalPhone(secondaryPhone)) {
      setValidationError("Enter a valid secondary NTC or Ncell number.");
      return;
    }
    if (email && !isValidEmail(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    let effectiveFrom: string;
    let effectiveUntil: string | null;
    try {
      effectiveFrom = bsDateToApi(effectiveFromBs);
      effectiveUntil = effectiveUntilBs ? bsDateToApi(effectiveUntilBs) : null;
    } catch {
      setValidationError(
        "Enter valid Bikram Sambat dates in YYYY-MM-DD format.",
      );
      return;
    }
    if (effectiveUntil && effectiveUntil < effectiveFrom) {
      setValidationError("The end date must be after the start date.");
      return;
    }
    setValidationError(null);

    const relationshipAuthority = canVerify
      ? {
          capabilities,
          verificationStatus,
          approvalStatus,
          effectiveFrom,
          effectiveUntil,
          emergencyContactPriority: emergencyPriority
            ? Number(emergencyPriority)
            : null,
          restrictionReasonRef: restrictionReference.trim() || null,
        }
      : {};
    const shared = {
      fullName: normalizePersonName(fullName),
      relation,
      secondaryPhone: secondaryPhone
        ? normalizeNepalPhone(secondaryPhone)
        : null,
      email: email ? normalizeEmail(email) : null,
      occupation: occupation.trim() || null,
      wardNumber: wardNumber.trim() || null,
      isPrimary,
      ...relationshipAuthority,
    };

    if (isNew) {
      onSave({
        ...shared,
        primaryPhone: normalizeNepalPhone(primaryPhone),
      });
      return;
    }
    onSave(shared);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error || validationError ? (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-bold text-rose-700">
          {validationError ??
            schoolFacingErrorMessage(error, {
              fallback:
                "The guardian could not be saved. Existing access was not changed.",
              invalid:
                "Review the relationship, authority, dates, and contact information.",
              forbidden:
                "You do not have permission to change this guardian relationship.",
              notFound:
                "This student or guardian relationship is no longer available.",
              conflict:
                "This relationship changed while you were editing it. Refresh and try again.",
            })}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            disabled={isSaving}
          />
        </Field>
        <Field label="Relationship">
          <select
            className={inputClass}
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
            disabled={isSaving}
          >
            <option value="FATHER">Father</option>
            <option value="MOTHER">Mother</option>
            <option value="LEGAL_GUARDIAN">Legal guardian</option>
            <option value="LOCAL_GUARDIAN">Local guardian</option>
            <option value="OVERSEAS_PARENT">Overseas parent</option>
            <option value="TEMPORARY_GUARDIAN">Temporary guardian</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field
          label="Primary phone"
          hint={
            isNew
              ? "Used for the guardian record."
              : "Use Access & recovery for an audited phone change."
          }
        >
          <input
            className={inputClass}
            value={primaryPhone}
            onChange={(event) => setPrimaryPhone(event.target.value)}
            disabled={isSaving || !isNew}
            required={isNew}
          />
          {getNepalMobileCarrier(primaryPhone) ? (
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              Carrier: {getNepalMobileCarrier(primaryPhone)}
            </p>
          ) : null}
        </Field>
        <Field label="Secondary phone">
          <input
            className={inputClass}
            value={secondaryPhone}
            onChange={(event) => setSecondaryPhone(event.target.value)}
            disabled={isSaving}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSaving}
          />
        </Field>
        <Field label="Occupation">
          <input
            className={inputClass}
            value={occupation}
            onChange={(event) => setOccupation(event.target.value)}
            disabled={isSaving}
          />
        </Field>
        <Field label="Ward number">
          <input
            className={inputClass}
            value={wardNumber}
            onChange={(event) => setWardNumber(event.target.value)}
            disabled={isSaving}
          />
        </Field>
        <Field label="Emergency contact priority" hint="1 is contacted first.">
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={emergencyPriority}
            onChange={(event) => setEmergencyPriority(event.target.value)}
            disabled={isSaving || !canVerify}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700">
        <input
          type="checkbox"
          checked={isPrimary}
          onChange={(event) => setIsPrimary(event.target.checked)}
          disabled={isSaving || forcePrimary}
          className="h-4 w-4"
        />
        {forcePrimary
          ? "The first guardian is the primary contact."
          : "Primary contact for this student"}
      </label>

      <div className="rounded-xl border border-slate-200 p-4">
        <div>
          <p className="text-sm font-black text-slate-900">
            Parent-app capabilities
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            No capability is implied by the relationship name. Select only the
            information this guardian may access for this child.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {enabledCapabilities.map((capability) => (
            <label
              key={capability.value}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={capabilities.includes(capability.value)}
                onChange={() => toggleCapability(capability.value)}
                disabled={isSaving || !canVerify}
              />
              <span>
                <span className="block text-xs font-bold text-slate-900">
                  {capability.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                  {capability.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-bold text-amber-900">
            Pilot-disabled actions
          </p>
          <p className="mt-1 text-[11px] leading-4 text-amber-800">
            {deferredCapabilities.map((item) => item.label).join(", ")} remain
            unavailable until their end-to-end safety gates pass.
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <Field label="Verification">
          <select
            className={inputClass}
            value={verificationStatus}
            onChange={(event) =>
              setVerificationStatus(
                event.target.value as "UNVERIFIED" | "VERIFIED",
              )
            }
            disabled={isSaving || !canVerify}
          >
            <option value="UNVERIFIED">Unverified</option>
            <option value="VERIFIED">Verified</option>
          </select>
        </Field>
        <Field label="Approval">
          <select
            className={inputClass}
            value={approvalStatus}
            onChange={(event) =>
              setApprovalStatus(
                event.target.value as "PENDING" | "APPROVED" | "REJECTED",
              )
            }
            disabled={isSaving || !canVerify}
          >
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </Field>
        <Field label="Start date (BS)" hint="YYYY-MM-DD">
          <input
            className={inputClass}
            value={effectiveFromBs}
            onChange={(event) => setEffectiveFromBs(event.target.value)}
            placeholder="2083-04-12"
            inputMode="numeric"
            disabled={isSaving || !canVerify}
          />
        </Field>
        <Field label="End date (BS)" hint="Leave blank for no scheduled end.">
          <input
            className={inputClass}
            value={effectiveUntilBs}
            onChange={(event) => setEffectiveUntilBs(event.target.value)}
            placeholder="2083-10-12"
            inputMode="numeric"
            disabled={isSaving || !canVerify}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Restriction or decision reference"
            hint="Use a safe case or register reference, not sensitive family details."
          >
            <input
              className={inputClass}
              value={restrictionReference}
              onChange={(event) => setRestrictionReference(event.target.value)}
              disabled={isSaving || !canVerify}
              maxLength={200}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
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
          className="rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : isNew ? "Link guardian" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function GuardianAccessPanel({
  studentId,
  guardian,
  canAdministerRecovery,
  canProvisionAccount,
  canVerify,
}: {
  studentId: string;
  guardian: GuardianProfile;
  canAdministerRecovery: boolean;
  canProvisionAccount: boolean;
  canVerify: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const queryKey = ["guardian-access-administration", studentId, guardian.id];
  const accessQuery = useQuery({
    queryKey,
    queryFn: () => api.getGuardianAccessAdministration(studentId, guardian.id),
    enabled: isOpen,
  });

  const refreshAccess = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: ["student-profile", studentId],
      }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: (body: GuardianRecoveryActionPayload) =>
      api.performGuardianRecoveryAction(studentId, guardian.id, body),
    onSuccess: async (result) => {
      setMessage(
        `${recoveryActionLabel(result.action)} completed. ${result.sessionsRevoked} session${result.sessionsRevoked === 1 ? "" : "s"} revoked.`,
      );
      await refreshAccess();
    },
  });
  const provisionMutation = useMutation({
    mutationFn: (body: Parameters<typeof api.provisionGuardianAccount>[2]) =>
      api.provisionGuardianAccount(studentId, guardian.id, body),
    onSuccess: async () => {
      setMessage(
        "Guardian account provisioned. The temporary password must be changed at first sign-in.",
      );
      await refreshAccess();
    },
  });
  const sessionMutation = useMutation({
    mutationFn: ({
      sessionId,
      reason,
      evidenceReference,
    }: {
      sessionId: string;
      reason: string;
      evidenceReference: string;
    }) =>
      api.revokeGuardianSession(studentId, guardian.id, sessionId, {
        reason,
        evidenceReference,
      }),
    onSuccess: async () => {
      setMessage("The selected guardian session was revoked.");
      await refreshAccess();
    },
  });
  const createVerificationMutation = useMutation({
    mutationFn: (body: {
      documentType: string;
      documentNumber: string;
      notes?: string;
    }) => api.createGuardianIdentityVerification(guardian.id, body),
    onSuccess: async () => {
      setMessage("Identity evidence recorded for review.");
      await refreshAccess();
    },
  });
  const reviewVerificationMutation = useMutation({
    mutationFn: ({
      verificationId,
      status,
      reviewNote,
    }: {
      verificationId: string;
      status: "VERIFIED" | "REJECTED";
      reviewNote: string;
    }) =>
      api.reviewGuardianIdentityVerification(guardian.id, verificationId, {
        status,
        reviewNote,
      }),
    onSuccess: async () => {
      setMessage("Identity review decision recorded.");
      await refreshAccess();
    },
  });

  const mutationError =
    actionMutation.error ??
    provisionMutation.error ??
    sessionMutation.error ??
    createVerificationMutation.error ??
    reviewVerificationMutation.error;

  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
      >
        <ShieldCheck size={15} aria-hidden="true" />
        {isOpen ? "Close access & recovery" : "Access & recovery"}
      </button>

      {isOpen ? (
        <div className="mt-4 space-y-4">
          {accessQuery.isLoading ? (
            <PanelState text="Loading guardian access history…" />
          ) : accessQuery.isError || !accessQuery.data ? (
            <PanelState
              tone="error"
              text={schoolFacingErrorMessage(accessQuery.error, {
                fallback:
                  "Guardian access details are unavailable. No access was changed.",
                forbidden:
                  "You do not have permission to view guardian access details.",
                notFound: "This guardian relationship is no longer available.",
              })}
            />
          ) : (
            <>
              {message ? <PanelState tone="success" text={message} /> : null}
              {mutationError ? (
                <PanelState
                  tone="error"
                  text={schoolFacingErrorMessage(mutationError, {
                    fallback:
                      "The guardian access change could not be completed. Existing access remains unchanged.",
                    invalid:
                      "Review the proof, reason, evidence reference, and requested action.",
                    forbidden:
                      "You do not have permission to complete this guardian access action.",
                    conflict:
                      "Guardian access changed while this action was open. Refresh and try again.",
                  })}
                />
              ) : null}

              <GuardianAccountSummary data={accessQuery.data} />
              <IdentityReviewWorkspace
                data={accessQuery.data}
                canVerify={canVerify}
                isSaving={
                  createVerificationMutation.isPending ||
                  reviewVerificationMutation.isPending
                }
                onCreate={(body) => createVerificationMutation.mutate(body)}
                onReview={(body) => reviewVerificationMutation.mutate(body)}
              />
              {!accessQuery.data.account.linked ? (
                <GuardianProvisionForm
                  data={accessQuery.data}
                  canProvision={canProvisionAccount}
                  isSaving={provisionMutation.isPending}
                  onSubmit={(body) => provisionMutation.mutate(body)}
                />
              ) : null}
              <GuardianSessions
                data={accessQuery.data}
                canAdminister={canAdministerRecovery}
                isSaving={sessionMutation.isPending}
                onRevoke={(body) => sessionMutation.mutate(body)}
              />
              <GuardianRecoveryForm
                data={accessQuery.data}
                canAdminister={canAdministerRecovery}
                isSaving={actionMutation.isPending}
                onSubmit={(body) => actionMutation.mutate(body)}
              />
              <GuardianDecisionHistory history={accessQuery.data.history} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function GuardianAccountSummary({
  data,
}: {
  data: GuardianAccessAdministration;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-900">Guardian account</p>
          <p className="mt-1 text-xs text-slate-500">
            Safe account and recovery readiness only. Private session details
            are never shown.
          </p>
        </div>
        <Badge variant={data.account.linked ? "success" : "warning"}>
          {data.account.linked ? "Linked" : "Not linked"}
        </Badge>
      </div>
      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <SummaryValue
          label="Account status"
          value={data.account.status || "—"}
        />
        <SummaryValue label="Email" value={data.account.email || "—"} />
        <SummaryValue label="Phone" value={data.account.phone || "—"} />
        <SummaryValue
          label="Last sign-in"
          value={
            data.account.lastLoginAt
              ? formatBsDate(data.account.lastLoginAt)
              : "No sign-in recorded"
          }
        />
      </dl>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {GUARDIAN_RECOVERY_VERIFICATION_METHODS.map((method) => {
          const available = recoveryMethodAvailable(data, method);
          return (
            <div
              key={method}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                available
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              {available ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <XCircle size={14} aria-hidden="true" />
              )}
              {recoveryMethodLabel(method)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuardianProvisionForm({
  data,
  canProvision,
  isSaving,
  onSubmit,
}: {
  data: GuardianAccessAdministration;
  canProvision: boolean;
  isSaving: boolean;
  onSubmit: (body: Parameters<typeof api.provisionGuardianAccount>[2]) => void;
}) {
  const [email, setEmail] = useState(data.account.email ?? "");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [verificationMethod, setVerificationMethod] =
    useState<GuardianRecoveryVerificationMethod>("SCHOOL_IDENTITY_REVIEW");
  const [coGuardianId, setCoGuardianId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (!canProvision) {
    return (
      <PanelState text="Guardian account provisioning requires guardian verification and user-creation permission." />
    );
  }

  const available = recoveryMethodAvailable(data, verificationMethod);
  return (
    <form
      className="rounded-xl border border-slate-200 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          email: normalizeEmail(email),
          temporaryPassword,
          verificationMethod,
          reason: reason.trim(),
          evidenceReference: evidenceReference.trim(),
          coGuardianId:
            verificationMethod === "APPROVED_CO_GUARDIAN"
              ? coGuardianId
              : undefined,
        });
      }}
    >
      <div className="flex items-center gap-2">
        <KeyRound size={16} className="text-slate-500" aria-hidden="true" />
        <p className="text-sm font-black text-slate-900">
          Provision parent account
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Creates only the parent role and requires a password change at first
        sign-in. The temporary password is never written to access history.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Account email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSaving}
          />
        </Field>
        <Field label="Temporary password">
          <input
            type="password"
            className={inputClass}
            value={temporaryPassword}
            onChange={(event) => setTemporaryPassword(event.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            disabled={isSaving}
          />
        </Field>
        <RecoveryMethodField
          data={data}
          value={verificationMethod}
          onChange={setVerificationMethod}
          disabled={isSaving}
        />
        {verificationMethod === "APPROVED_CO_GUARDIAN" ? (
          <CoGuardianField
            data={data}
            value={coGuardianId}
            onChange={setCoGuardianId}
            disabled={isSaving}
          />
        ) : null}
        <Field label="Decision reason">
          <textarea
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={5}
            maxLength={500}
            required
            disabled={isSaving}
          />
        </Field>
        <Field
          label="Evidence reference"
          hint="Use a safe case, register, or document reference."
        >
          <input
            className={inputClass}
            value={evidenceReference}
            onChange={(event) => setEvidenceReference(event.target.value)}
            minLength={3}
            maxLength={200}
            required
            disabled={isSaving}
          />
        </Field>
      </div>
      <Confirmation
        checked={confirmed}
        onChange={setConfirmed}
        label="I verified this guardian’s identity and approve parent-app account creation."
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={
            isSaving ||
            !confirmed ||
            !available ||
            !isValidEmail(email) ||
            temporaryPassword.length < 8 ||
            reason.trim().length < 5 ||
            evidenceReference.trim().length < 3 ||
            (verificationMethod === "APPROVED_CO_GUARDIAN" && !coGuardianId)
          }
          className="rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          {isSaving ? "Provisioning…" : "Provision parent account"}
        </button>
      </div>
    </form>
  );
}

function IdentityReviewWorkspace({
  data,
  canVerify,
  isSaving,
  onCreate,
  onReview,
}: {
  data: GuardianAccessAdministration;
  canVerify: boolean;
  isSaving: boolean;
  onCreate: (body: {
    documentType: string;
    documentNumber: string;
    notes?: string;
  }) => void;
  onReview: (body: {
    verificationId: string;
    status: "VERIFIED" | "REJECTED";
    reviewNote: string;
  }) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [documentType, setDocumentType] = useState("citizenship");
  const [documentNumber, setDocumentNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-900">Identity review</p>
          <p className="mt-1 text-xs text-slate-500">
            The administration view shows evidence presence, not private
            document numbers.
          </p>
        </div>
        {canVerify ? (
          <button
            type="button"
            onClick={() => setIsCreating((current) => !current)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
          >
            {isCreating ? "Cancel" : "Record evidence"}
          </button>
        ) : null}
      </div>

      {isCreating ? (
        <form
          className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate({
              documentType: documentType.trim(),
              documentNumber: documentNumber.trim(),
              notes: notes.trim() || undefined,
            });
            setDocumentNumber("");
            setNotes("");
            setIsCreating(false);
          }}
        >
          <Field label="Document type">
            <input
              className={inputClass}
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
              required
              disabled={isSaving}
            />
          </Field>
          <Field label="Document number">
            <input
              className={inputClass}
              value={documentNumber}
              onChange={(event) => setDocumentNumber(event.target.value)}
              required
              disabled={isSaving}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Internal note"
              hint="Do not enter unnecessary sensitive family details."
            >
              <textarea
                className={inputClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                disabled={isSaving}
              />
            </Field>
          </div>
          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              className="rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              disabled={
                isSaving ||
                documentType.trim().length < 2 ||
                documentNumber.trim().length < 2
              }
            >
              Record for review
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-3 space-y-2">
        {data.identityVerifications.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            No identity review recorded.
          </p>
        ) : (
          data.identityVerifications.map((verification) => (
            <div
              key={verification.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {formatTokenLabel(verification.documentType)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Recorded {formatBsDate(verification.createdAt)} · Number{" "}
                    {verification.documentNumberRecorded
                      ? "recorded"
                      : "not recorded"}{" "}
                    · Evidence file{" "}
                    {verification.evidenceDocumentRecorded
                      ? "recorded"
                      : "not recorded"}
                  </p>
                </div>
                <Badge
                  variant={
                    verification.status === "VERIFIED"
                      ? "success"
                      : verification.status === "PENDING"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {formatTokenLabel(verification.status)}
                </Badge>
              </div>
              {verification.status === "PENDING" && canVerify ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <Field label="Review note">
                    <input
                      className={inputClass}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      disabled={isSaving}
                    />
                  </Field>
                  <Confirmation
                    checked={confirmed}
                    onChange={setConfirmed}
                    label="I reviewed the recorded evidence and will record this decision."
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={
                        isSaving || !confirmed || reviewNote.trim().length < 3
                      }
                      onClick={() =>
                        onReview({
                          verificationId: verification.id,
                          status: "REJECTED",
                          reviewNote: reviewNote.trim(),
                        })
                      }
                      className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={
                        isSaving || !confirmed || reviewNote.trim().length < 3
                      }
                      onClick={() =>
                        onReview({
                          verificationId: verification.id,
                          status: "VERIFIED",
                          reviewNote: reviewNote.trim(),
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      Approve identity
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function GuardianSessions({
  data,
  canAdminister,
  isSaving,
  onRevoke,
}: {
  data: GuardianAccessAdministration;
  canAdminister: boolean;
  isSaving: boolean;
  onRevoke: (body: {
    sessionId: string;
    reason: string;
    evidenceReference: string;
  }) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <Smartphone size={16} className="text-slate-500" aria-hidden="true" />
        <p className="text-sm font-black text-slate-900">
          Recent sessions and devices
        </p>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Only safe device labels and session state are shown.
      </p>
      <div className="mt-3 space-y-2">
        {data.sessions.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            No guardian sessions recorded.
          </p>
        ) : (
          data.sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {session.deviceLabel}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {session.lastUsedAt
                    ? `Last used ${formatBsDate(session.lastUsedAt)}`
                    : `Created ${formatBsDate(session.createdAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    session.status === "ACTIVE"
                      ? "success"
                      : session.status === "REVOKED"
                        ? "destructive"
                        : "neutral"
                  }
                >
                  {formatTokenLabel(session.status)}
                </Badge>
                {session.status === "ACTIVE" && canAdminister ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"
                  >
                    Revoke
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
      {selectedSessionId ? (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Revocation reason">
              <textarea
                className={inputClass}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                minLength={5}
                maxLength={500}
                disabled={isSaving}
              />
            </Field>
            <Field label="Evidence reference">
              <input
                className={inputClass}
                value={evidenceReference}
                onChange={(event) => setEvidenceReference(event.target.value)}
                minLength={3}
                maxLength={200}
                disabled={isSaving}
              />
            </Field>
          </div>
          <Confirmation
            checked={confirmed}
            onChange={setConfirmed}
            label="I confirm that this specific session must be revoked."
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
              onClick={() => setSelectedSessionId("")}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              disabled={
                isSaving ||
                !confirmed ||
                reason.trim().length < 5 ||
                evidenceReference.trim().length < 3
              }
              onClick={() => {
                onRevoke({
                  sessionId: selectedSessionId,
                  reason: reason.trim(),
                  evidenceReference: evidenceReference.trim(),
                });
                setSelectedSessionId("");
                setConfirmed(false);
              }}
            >
              Revoke session
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GuardianRecoveryForm({
  data,
  canAdminister,
  isSaving,
  onSubmit,
}: {
  data: GuardianAccessAdministration;
  canAdminister: boolean;
  isSaving: boolean;
  onSubmit: (body: GuardianRecoveryActionPayload) => void;
}) {
  const [action, setAction] = useState<GuardianRecoveryAction>(
    "REVOKE_ALL_SESSIONS",
  );
  const [verificationMethod, setVerificationMethod] =
    useState<GuardianRecoveryVerificationMethod>("TRUSTED_SESSION");
  const [coGuardianId, setCoGuardianId] = useState("");
  const [newPrimaryPhone, setNewPrimaryPhone] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  if (!canAdminister) {
    return (
      <PanelState text="Recovery, suspension, and revocation require guardian verification and account-recovery permission." />
    );
  }

  const methodAvailable = recoveryMethodAvailable(data, verificationMethod);
  const phoneValid =
    action !== "APPROVE_PHONE_CHANGE" ||
    Boolean(tryNormalizeNepalPhone(newPrimaryPhone));

  return (
    <form
      className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          action,
          verificationMethod,
          reason: reason.trim(),
          evidenceReference: evidenceReference.trim(),
          newPrimaryPhone:
            action === "APPROVE_PHONE_CHANGE"
              ? normalizeNepalPhone(newPrimaryPhone)
              : undefined,
          coGuardianId:
            verificationMethod === "APPROVED_CO_GUARDIAN"
              ? coGuardianId
              : undefined,
        });
        setConfirmed(false);
      }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle
          size={16}
          className="text-amber-700"
          aria-hidden="true"
        />
        <p className="text-sm font-black text-slate-900">
          Recovery and relationship actions
        </p>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Every action requires existing proof, a decision reason, and a safe
        evidence reference. Other guardians are not contacted unless a separate
        school policy authorizes communication.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Action">
          <select
            className={inputClass}
            value={action}
            onChange={(event) =>
              setAction(event.target.value as GuardianRecoveryAction)
            }
            disabled={isSaving}
          >
            {GUARDIAN_RECOVERY_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {recoveryActionLabel(item)}
              </option>
            ))}
          </select>
        </Field>
        <RecoveryMethodField
          data={data}
          value={verificationMethod}
          onChange={setVerificationMethod}
          disabled={isSaving}
        />
        {verificationMethod === "APPROVED_CO_GUARDIAN" ? (
          <CoGuardianField
            data={data}
            value={coGuardianId}
            onChange={setCoGuardianId}
            disabled={isSaving}
          />
        ) : null}
        {action === "APPROVE_PHONE_CHANGE" ? (
          <Field label="Approved new phone">
            <input
              className={inputClass}
              value={newPrimaryPhone}
              onChange={(event) => setNewPrimaryPhone(event.target.value)}
              disabled={isSaving}
              required
            />
          </Field>
        ) : null}
        <Field label="Decision reason">
          <textarea
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            minLength={5}
            maxLength={500}
            required
            disabled={isSaving}
          />
        </Field>
        <Field
          label="Evidence reference"
          hint="Use a safe case, register, or approved document reference."
        >
          <input
            className={inputClass}
            value={evidenceReference}
            onChange={(event) => setEvidenceReference(event.target.value)}
            minLength={3}
            maxLength={200}
            required
            disabled={isSaving}
          />
        </Field>
      </div>
      <Confirmation
        checked={confirmed}
        onChange={setConfirmed}
        label={`I reviewed the evidence and confirm: ${recoveryActionLabel(action)}.`}
      />
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={
            isSaving ||
            !confirmed ||
            !methodAvailable ||
            !phoneValid ||
            reason.trim().length < 5 ||
            evidenceReference.trim().length < 3 ||
            (verificationMethod === "APPROVED_CO_GUARDIAN" && !coGuardianId)
          }
        >
          {isSaving ? "Recording action…" : "Confirm access action"}
        </button>
      </div>
    </form>
  );
}

function GuardianDecisionHistory({
  history,
}: {
  history: GuardianAccessAdministration["history"];
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2">
        <History size={16} className="text-slate-500" aria-hidden="true" />
        <p className="text-sm font-black text-slate-900">Decision history</p>
      </div>
      <div className="mt-3 space-y-2">
        {history.length === 0 ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            No guardian access decisions recorded.
          </p>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {formatTokenLabel(entry.action)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {entry.actorLabel} · {formatBsDate(entry.createdAt)}
                  </p>
                </div>
                {entry.verificationMethod ? (
                  <Badge variant="info">
                    {recoveryMethodLabel(entry.verificationMethod)}
                  </Badge>
                ) : null}
              </div>
              {entry.reason ? (
                <p className="mt-2 text-xs text-slate-700">
                  Reason: {entry.reason}
                </p>
              ) : null}
              {entry.evidenceReference ? (
                <p className="mt-1 break-words text-xs text-slate-600">
                  Evidence: {entry.evidenceReference}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function RecoveryMethodField({
  data,
  value,
  onChange,
  disabled,
}: {
  data: GuardianAccessAdministration;
  value: GuardianRecoveryVerificationMethod;
  onChange: (value: GuardianRecoveryVerificationMethod) => void;
  disabled: boolean;
}) {
  return (
    <Field label="Verification method">
      <select
        className={inputClass}
        value={value}
        onChange={(event) =>
          onChange(event.target.value as GuardianRecoveryVerificationMethod)
        }
        disabled={disabled}
      >
        {GUARDIAN_RECOVERY_VERIFICATION_METHODS.map((method) => (
          <option
            key={method}
            value={method}
            disabled={!recoveryMethodAvailable(data, method)}
          >
            {recoveryMethodLabel(method)}
            {recoveryMethodAvailable(data, method) ? "" : " — unavailable"}
          </option>
        ))}
      </select>
    </Field>
  );
}

function CoGuardianField({
  data,
  value,
  onChange,
  disabled,
}: {
  data: GuardianAccessAdministration;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <Field label="Approved co-guardian">
      <select
        className={inputClass}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Select co-guardian</option>
        {data.recoveryPaths.approvedCoGuardians.map((guardian) => (
          <option key={guardian.id} value={guardian.id}>
            {guardian.fullName} · {formatGuardianRelation(guardian.relation)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Confirmation({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold leading-5 text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      {label}
    </label>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-widest text-slate-500">
      {label}
      {hint ? (
        <span className="ml-1 font-semibold normal-case tracking-normal text-slate-400">
          {hint}
        </span>
      ) : null}
      <div className="mt-2 normal-case tracking-normal">{children}</div>
    </label>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-slate-900">
        {formatTokenLabel(value)}
      </dd>
    </div>
  );
}

function PanelState({
  text,
  tone = "neutral",
}: {
  text: string;
  tone?: "neutral" | "success" | "error";
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-xs font-bold ${
        tone === "success"
          ? "border-emerald-100 bg-emerald-50 text-emerald-800"
          : tone === "error"
            ? "border-rose-100 bg-rose-50 text-rose-700"
            : "border-slate-100 bg-slate-50 text-slate-600"
      }`}
    >
      {text}
    </div>
  );
}

function recoveryMethodAvailable(
  data: GuardianAccessAdministration,
  method: GuardianRecoveryVerificationMethod,
) {
  if (method === "TRUSTED_SESSION") {
    return data.recoveryPaths.trustedSessionAvailable;
  }
  if (method === "VERIFIED_EMAIL") {
    return data.recoveryPaths.verifiedEmailAvailable;
  }
  if (method === "APPROVED_CO_GUARDIAN") {
    return data.recoveryPaths.approvedCoGuardians.length > 0;
  }
  return data.recoveryPaths.schoolIdentityReviewAvailable;
}

function recoveryMethodLabel(method: GuardianRecoveryVerificationMethod) {
  const labels: Record<GuardianRecoveryVerificationMethod, string> = {
    TRUSTED_SESSION: "Trusted existing session",
    VERIFIED_EMAIL: "Completed email recovery",
    APPROVED_CO_GUARDIAN: "Approved co-guardian",
    SCHOOL_IDENTITY_REVIEW: "School identity review",
  };
  return labels[method];
}

function recoveryActionLabel(action: GuardianRecoveryAction) {
  const labels: Record<GuardianRecoveryAction, string> = {
    REVOKE_ALL_SESSIONS: "Revoke all sessions",
    SUSPEND_COMPROMISED_ACCOUNT: "Place compromise hold",
    RESTORE_ACCOUNT: "Restore account",
    APPROVE_PHONE_CHANGE: "Approve phone change",
    EXPIRE_RELATIONSHIP: "Expire relationship",
    REVOKE_RELATIONSHIP: "Revoke relationship",
    MARK_DECEASED: "End access after death",
  };
  return labels[action];
}

function capabilityLabel(capability: GuardianCapability) {
  return (
    [...enabledCapabilities, ...deferredCapabilities].find(
      (item) => item.value === capability,
    )?.label ?? formatTokenLabel(capability)
  );
}

function relationshipStatusVariant(
  status: GuardianProfile["status"],
): "success" | "warning" | "destructive" | "neutral" {
  if (status === "ACTIVE") return "success";
  if (status === "SUSPENDED") return "warning";
  if (status === "REVOKED") return "destructive";
  return "neutral";
}

function guardianStatusOrder(status: GuardianProfile["status"]) {
  return {
    ACTIVE: 0,
    SUSPENDED: 1,
    EXPIRED: 2,
    REVOKED: 3,
  }[status];
}

function safeBsInput(value: Date | string) {
  try {
    return formatBsDateForInput(value);
  } catch {
    return "";
  }
}

function bsDateToApi(value: string) {
  const gregorian = toGregorianDateFromBs(value);
  return `${gregorian.year}-${String(gregorian.month).padStart(2, "0")}-${String(gregorian.day).padStart(2, "0")}T00:00:00.000Z`;
}

function formatGuardianRelation(value?: string | null) {
  if (!value) return "Relation not recorded";
  return formatTokenLabel(value);
}

function formatTokenLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

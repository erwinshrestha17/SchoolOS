"use client";

import type { CreateAdmissionCasePayload } from "@schoolos/core";
import {
  formatBsDateForInput,
  isValidDateOfBirth,
  isValidEmail,
  isValidPersonName,
  normalizeEmail,
  normalizeNepalPhone,
  normalizePersonName,
  toGregorianDateFromBs,
  tryNormalizeNepalPhone,
} from "@schoolos/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { api } from "../../lib/api";
import { admissionCasesApi } from "../../lib/api/admission-cases";
import { classOptionLabel } from "../../lib/education-program";
import { schoolFacingErrorMessage } from "../../lib/school-facing-error";
import { Button } from "../ui/button";
import { ErrorState } from "../ui/error-state";
import { SectionCard } from "../ui/section-card";

const emptyForm: CreateAdmissionCasePayload = {
  firstNameEn: "",
  lastNameEn: "",
  dateOfBirth: "",
  gender: undefined,
  guardianFullName: "",
  guardianRelation: "",
  guardianPhone: "",
  academicYearId: "",
  classId: "",
  sectionId: "",
  source: "PARENT_ONLINE",
  admissionDate: new Date().toISOString().slice(0, 10),
  notes: "",
};

export function AdmissionReviewCaseForm() {
  const router = useRouter();
  const admissionCaseIdRef = useRef<string | null>(null);
  const [form, setForm] = useState<CreateAdmissionCasePayload>(emptyForm);
  const [dateOfBirthBs, setDateOfBirthBs] = useState("");
  const [admissionDateBs, setAdmissionDateBs] = useState(() =>
    formatBsDateForInput(new Date()),
  );
  const [error, setError] = useState("");
  const years = useQuery({
    queryKey: ["academic-years"],
    queryFn: api.listAcademicYears,
  });
  const classes = useQuery({ queryKey: ["classes"], queryFn: api.listClasses });
  const sections = useQuery({
    queryKey: ["sections"],
    queryFn: api.listSections,
  });
  const sectionOptions = useMemo(
    () =>
      (sections.data ?? []).filter(
        (section) =>
          !form.classId ||
          (section.classId ?? section.class?.id) === form.classId,
      ),
    [form.classId, sections.data],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(
        Object.entries({
          ...form,
          firstNameEn: normalizePersonName(form.firstNameEn),
          lastNameEn: normalizePersonName(form.lastNameEn),
          guardianFullName: form.guardianFullName
            ? normalizePersonName(form.guardianFullName)
            : "",
          guardianPhone: form.guardianPhone
            ? normalizeNepalPhone(form.guardianPhone)
            : "",
          guardianEmail: form.guardianEmail
            ? normalizeEmail(form.guardianEmail)
            : "",
        }).filter(([, value]) => value !== "" && value !== undefined),
      ) as CreateAdmissionCasePayload;
      const admissionCase = admissionCaseIdRef.current
        ? await admissionCasesApi.updateCase(
            admissionCaseIdRef.current,
            payload,
          )
        : await admissionCasesApi.createCase(payload);
      admissionCaseIdRef.current = admissionCase.id;
      if (
        admissionCase.review.availableActions.includes("MARK_READY_FOR_REVIEW")
      ) {
        await admissionCasesApi.reviewCase(admissionCase.id, {
          action: "MARK_READY_FOR_REVIEW",
          reason: "Admission review requested from the school admission desk.",
        });
      }
      return admissionCase;
    },
    onSuccess: (admissionCase) =>
      router.push(`/dashboard/admissions/applications/${admissionCase.id}`),
    onError: (cause) =>
      setError(
        schoolFacingErrorMessage(cause, {
          fallback:
            "The admission review case could not be created. No student was enrolled. Try again.",
          invalid:
            "Review the applicant, guardian, and academic placement details before continuing.",
          forbidden:
            "You do not have permission to create an admission review case.",
          conflict:
            "A matching admission record changed while this case was being prepared. Refresh and try again.",
        }),
      ),
  });

  if (years.isError || classes.isError || sections.isError) {
    return (
      <ErrorState
        title="Admission setup could not load"
        message="No admission case was created. Retry after checking academic setup."
        onRetry={() => {
          void years.refetch();
          void classes.refetch();
          void sections.refetch();
        }}
      />
    );
  }

  const update = <K extends keyof CreateAdmissionCasePayload>(
    key: K,
    value: CreateAdmissionCasePayload[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };
  const validate = () => {
    if (
      !isValidPersonName(form.firstNameEn) ||
      !isValidPersonName(form.lastNameEn) ||
      !form.dateOfBirth
    )
      return "Enter a valid student name and date of birth.";
    if (!isValidDateOfBirth(form.dateOfBirth))
      return "Enter a valid date of birth.";
    if (
      !form.guardianFullName ||
      !isValidPersonName(form.guardianFullName) ||
      !form.guardianRelation?.trim() ||
      !form.guardianPhone
    )
      return "Enter a valid guardian name, relationship, and phone.";
    if (!tryNormalizeNepalPhone(form.guardianPhone))
      return "Enter a valid NTC or Ncell guardian number.";
    if (form.guardianEmail && !isValidEmail(form.guardianEmail))
      return "Enter a valid guardian email.";
    if (!form.academicYearId || !form.classId || !form.admissionDate)
      return "Choose academic year, class, and admission date.";
    return "";
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const validation = validate();
        if (validation) {
          setError(validation);
          return;
        }
        submit.mutate();
      }}
    >
      <SectionCard
        title="Admission review"
        description="For online applications, interviews, scholarships, transfer review, or any admission needing a school decision."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="First name (English)" required>
            <input
              value={form.firstNameEn}
              onChange={(event) => update("firstNameEn", event.target.value)}
            />
          </Field>
          <Field label="Last name (English)" required>
            <input
              value={form.lastNameEn}
              onChange={(event) => update("lastNameEn", event.target.value)}
            />
          </Field>
          <Field label="Date of birth (BS)" required>
            <input
              required
              inputMode="numeric"
              placeholder="2080-01-01"
              value={dateOfBirthBs}
              onChange={(event) => {
                const value = event.target.value;
                setDateOfBirthBs(value);
                update("dateOfBirth", toGregorianDateInput(value));
              }}
            />
          </Field>
          <Field label="Gender" required>
            <select
              required
              value={form.gender ?? ""}
              onChange={(event) =>
                update(
                  "gender",
                  event.target.value
                    ? (event.target
                        .value as CreateAdmissionCasePayload["gender"])
                    : undefined,
                )
              }
            >
              <option value="">Select gender</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Guardian full name" required>
            <input
              value={form.guardianFullName ?? ""}
              onChange={(event) =>
                update("guardianFullName", event.target.value)
              }
            />
          </Field>
          <Field label="Guardian relationship" required>
            <RelationshipSelect
              value={form.guardianRelation ?? ""}
              onChange={(value) => update("guardianRelation", value)}
            />
          </Field>
          <Field label="Guardian phone" required>
            <input
              value={form.guardianPhone ?? ""}
              onChange={(event) => update("guardianPhone", event.target.value)}
              inputMode="tel"
            />
          </Field>
          <Field label="Guardian email">
            <input
              type="email"
              value={form.guardianEmail ?? ""}
              onChange={(event) => update("guardianEmail", event.target.value)}
            />
          </Field>
        </div>
        <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-800">
            Additional student and emergency details
          </summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="IEMIS student ID">
              <input
                value={form.nationalStudentId ?? ""}
                onChange={(event) =>
                  update("nationalStudentId", event.target.value)
                }
              />
            </Field>
            <Field label="Emergency contact name">
              <input
                value={form.emergencyName ?? ""}
                onChange={(event) =>
                  update("emergencyName", event.target.value)
                }
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                value={form.emergencyPhone ?? ""}
                onChange={(event) =>
                  update("emergencyPhone", event.target.value)
                }
                inputMode="tel"
              />
            </Field>
          </div>
        </details>
      </SectionCard>
      <SectionCard
        title="Requested placement"
        description="The school saves these details once and reviewers only resolve missing or policy-required items."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Admission source" required>
            <select
              value={form.source}
              onChange={(event) =>
                update(
                  "source",
                  event.target.value as CreateAdmissionCasePayload["source"],
                )
              }
            >
              <option value="PARENT_ONLINE">Parent online application</option>
              <option value="PHONE_INQUIRY">Phone inquiry</option>
              <option value="TRANSFER_REQUEST">Transfer request</option>
              <option value="OFFICE_WALK_IN">Office / walk-in</option>
              <option value="IMPORT">Import</option>
            </select>
          </Field>
          <Field label="Academic year" required>
            <select
              value={form.academicYearId ?? ""}
              onChange={(event) => update("academicYearId", event.target.value)}
            >
              <option value="">Select academic year</option>
              {(years.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested class" required>
            <select
              value={form.classId ?? ""}
              onChange={(event) => {
                update("classId", event.target.value);
                update("sectionId", "");
              }}
            >
              <option value="">Select class</option>
              {(classes.data ?? []).map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>
                  {classOptionLabel(schoolClass)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Requested section">
            <select
              value={form.sectionId ?? ""}
              onChange={(event) => update("sectionId", event.target.value)}
            >
              <option value="">Select section</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Admission date (BS)" required>
            <input
              required
              inputMode="numeric"
              placeholder="2083-01-01"
              value={admissionDateBs}
              onChange={(event) => {
                const value = event.target.value;
                setAdmissionDateBs(value);
                update("admissionDate", toGregorianDateInput(value));
              }}
            />
          </Field>
          <Field label="Previous school">
            <input
              value={form.previousSchool ?? ""}
              onChange={(event) => update("previousSchool", event.target.value)}
            />
          </Field>
          <Field label="Review note" className="md:col-span-2">
            <textarea
              rows={4}
              value={form.notes ?? ""}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Scholarship, interview, Grade 11 marks, or transfer review."
            />
          </Field>
        </div>
      </SectionCard>
      {error ? (
        <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm font-semibold text-danger-800">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-4 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
        <Button type="submit" disabled={submit.isPending}>
          {submit.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ClipboardCheck className="h-4 w-4" />
          )}
          Send for review
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block space-y-2 text-sm font-bold text-slate-700 ${className}`}
    >
      <span>
        {label}
        {required ? <span className="text-danger-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function RelationshipSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = [
    "Mother",
    "Father",
    "Guardian",
    "Grandparent",
    "Sibling",
    "Other",
  ];
  return (
    <select
      required
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select relationship</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function toGregorianDateInput(bsDate: string) {
  try {
    const date = toGregorianDateFromBs(bsDate);
    return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

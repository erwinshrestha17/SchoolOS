"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, FileText, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { usersApi } from "@/lib/api/users";
import {
  communicationsApi,
  type NoticeRecipientPreview,
} from "@/lib/api/communications";
import { FileUploader } from "@/components/ui/file-uploader";
import { LoadingState } from "@/components/ui/loading-state";
import { ErrorState } from "@/components/ui/error-state";
import { PermissionDenied } from "@/components/ui/permission-denied";
import { useSession } from "@/components/session-provider";

const CATEGORY_OPTIONS = [
  "GENERAL",
  "HOLIDAY",
  "EMERGENCY",
  "FEES",
  "EXAMS",
  "TRANSPORT_DELAY",
  "EVENT",
] as const;

// GUARDIANS and RECIPIENTS are client-side-only audience choices. Neither
// maps to a distinct backend AudienceType: the resolver targets guardianIds
// or recipientUserIds directly whenever they're present (see
// resolveAudienceRecipients in communications.service.ts), so both send
// audienceType "ALL" alongside the relevant id list.
type ComposerAudienceType =
  | "ALL"
  | "CLASS"
  | "SECTION"
  | "ROLE"
  | "STAFF"
  | "STUDENT"
  | "GUARDIANS"
  | "RECIPIENTS";

type NoticeDraftForm = {
  title: string;
  titleNe: string;
  body: string;
  bodyNe: string;
  category: (typeof CATEGORY_OPTIONS)[number];
  isPinned: boolean;
  priority: "NORMAL" | "URGENT" | "EMERGENCY";
  audienceType: ComposerAudienceType;
  classId: string;
  sectionId: string;
  roleNames: string[];
  idListText: string;
  attachmentFileId: string;
  attachmentFileName: string;
};

const emptyDraft: NoticeDraftForm = {
  title: "",
  titleNe: "",
  body: "",
  bodyNe: "",
  category: "GENERAL",
  isPinned: false,
  priority: "NORMAL",
  audienceType: "ALL",
  classId: "",
  sectionId: "",
  roleNames: [],
  idListText: "",
  attachmentFileId: "",
  attachmentFileName: "",
};

function parseIdList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\s,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

export function NoticeComposerWorkspace({ noticeId }: { noticeId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const canCreate = permissions.has("notices:create");
  const canEdit = permissions.has("notices:edit");
  const [form, setForm] = useState<NoticeDraftForm>(emptyDraft);
  const [preview, setPreview] = useState<NoticeRecipientPreview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const idempotencyKey = useRef<string | undefined>(undefined);
  if (!idempotencyKey.current && typeof crypto !== "undefined") {
    idempotencyKey.current = crypto.randomUUID();
  }

  const detailQuery = useQuery({
    queryKey: ["notice-detail", noticeId],
    queryFn: () => communicationsApi.getNoticeDetail(noticeId!),
    enabled: Boolean(noticeId && canEdit),
  });
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.listClasses(),
    enabled: canCreate || canEdit,
  });
  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: () => api.listSections(),
    enabled: (canCreate || canEdit) && form.audienceType === "SECTION",
  });

  const rolesQuery = useQuery({
    queryKey: ["role-catalog"],
    queryFn: () => usersApi.listRoleCatalog(),
    enabled: canCreate || canEdit,
  });

  useEffect(() => {
    const notice = detailQuery.data;
    if (!notice) return;
    let audienceType: ComposerAudienceType =
      notice.audienceType as ComposerAudienceType;
    let idListText = "";
    if (notice.guardianIds.length > 0 && notice.studentIds.length === 0) {
      audienceType = "GUARDIANS";
      idListText = notice.guardianIds.join(", ");
    } else if (notice.recipientUserIds.length > 0) {
      audienceType = "RECIPIENTS";
      idListText = notice.recipientUserIds.join(", ");
    } else if (notice.audienceType === "STAFF") {
      idListText = notice.staffIds.join(", ");
    } else if (notice.audienceType === "STUDENT") {
      idListText = notice.studentIds.join(", ");
    }
    setForm({
      title: notice.title,
      titleNe: notice.titleNe ?? "",
      body: notice.body,
      bodyNe: notice.bodyNe ?? "",
      category: (notice.category ??
        "GENERAL") as NoticeDraftForm["category"],
      isPinned: notice.isPinned ?? false,
      priority: notice.priority as NoticeDraftForm["priority"],
      audienceType,
      classId: notice.classId ?? "",
      sectionId: notice.sectionId ?? "",
      roleNames: notice.roleNames ?? [],
      idListText,
      attachmentFileId: notice.attachmentFileId ?? "",
      attachmentFileName: notice.attachmentFileId ? "Protected attachment" : "",
    });
    setDirty(false);
  }, [detailQuery.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    setPreview(null);
  }, [
    form.audienceType,
    form.body,
    form.classId,
    form.idListText,
    form.priority,
    form.roleNames,
    form.sectionId,
    form.title,
  ]);

  const sections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter((section) => {
        const candidate = section as {
          classId?: string;
          class?: { id?: string };
        };
        return (
          !form.classId ||
          (candidate.classId ?? candidate.class?.id) === form.classId
        );
      }),
    [form.classId, sectionsQuery.data],
  );

  const previewMutation = useMutation({
    mutationFn: () => communicationsApi.previewNoticeRecipients(payload(form)),
    onSuccess: (result) => {
      setPreview(result);
      setFormError(null);
    },
    onError: () =>
      setFormError(
        "Recipient preview is unavailable. Your draft is still here; check the audience and try again.",
      ),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const draft = payload(form);
      return noticeId
        ? communicationsApi.updateNoticeDraft(noticeId, draft)
        : communicationsApi.createNoticeDraft({
            ...draft,
            idempotencyKey:
              idempotencyKey.current ?? `web-notice-${Date.now().toString(36)}`,
          });
    },
    onSuccess: async (saved) => {
      setDirty(false);
      setFormError(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["notice-detail", saved.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["notices"] }),
      ]);
      router.push(`/dashboard/notices/${saved.id}`);
    },
    onError: () =>
      setFormError(
        "The draft could not be saved. Your valid form entries have been preserved.",
      ),
  });

  if ((!noticeId && !canCreate) || (noticeId && !canEdit)) {
    return (
      <PermissionDenied
        showNavigation={false}
        title="Notice editing is restricted"
        description="Your role cannot create or edit school notice drafts."
      />
    );
  }
  if (detailQuery.isLoading)
    return <LoadingState label="Loading notice draft..." />;
  if (detailQuery.isError) {
    return (
      <ErrorState
        title="Draft unavailable"
        message="This draft could not be loaded. It may no longer be editable."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }
  if (detailQuery.data && detailQuery.data.lifecycleStatus !== "DRAFT") {
    return (
      <ErrorState
        title="This notice is no longer editable"
        message="Only notices in Draft state can be changed. Open the notice to review its current lifecycle."
      />
    );
  }

  const validationError = validate(form);

  return (
    <div
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
      data-testid="notice-composer"
    >
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
            Draft first
          </p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">
            {noticeId ? "Update notice draft" : "Create notice draft"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Saving never sends the notice. Publication and scheduling happen
            from the reviewed notice detail.
          </p>
        </div>

        <Field label="Title">
          <input
            value={form.title}
            maxLength={200}
            onChange={(event) =>
              change(setForm, setDirty, "title", event.target.value)
            }
            placeholder="A clear, actionable notice title"
            className="min-h-11"
          />
        </Field>
        <Field label="Title (Nepali, optional)">
          <input
            value={form.titleNe}
            maxLength={200}
            onChange={(event) =>
              change(setForm, setDirty, "titleNe", event.target.value)
            }
            placeholder="बिदाको सूचना"
            className="min-h-11"
          />
        </Field>
        <Field label="Concise message">
          <textarea
            value={form.body}
            maxLength={10_000}
            rows={8}
            onChange={(event) =>
              change(setForm, setDirty, "body", event.target.value)
            }
            placeholder="Write the school-facing message"
            className="min-h-44 rounded-xl border border-slate-200 px-3 py-2"
          />
        </Field>
        <Field label="Message (Nepali, optional)">
          <textarea
            value={form.bodyNe}
            maxLength={10_000}
            rows={6}
            onChange={(event) =>
              change(setForm, setDirty, "bodyNe", event.target.value)
            }
            placeholder="विद्यालय-सम्बन्धी सन्देश नेपालीमा लेख्नुहोस्"
            className="min-h-32 rounded-xl border border-slate-200 px-3 py-2"
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(event) =>
                change(
                  setForm,
                  setDirty,
                  "priority",
                  event.target.value as NoticeDraftForm["priority"],
                )
              }
              className="min-h-11"
            >
              <option value="NORMAL">Normal</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </Field>
          <Field label="Category">
            <select
              value={form.category}
              onChange={(event) =>
                change(
                  setForm,
                  setDirty,
                  "category",
                  event.target.value as NoticeDraftForm["category"],
                )
              }
              className="min-h-11"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {formatCategoryLabel(option)}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(event) =>
                change(setForm, setDirty, "isPinned", event.target.checked)
              }
              className="h-4 w-4"
            />
            Pin to top of notices list
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Audience">
            <select
              value={form.audienceType}
              onChange={(event) => {
                const audienceType = event.target
                  .value as ComposerAudienceType;
                setForm((current) => ({
                  ...current,
                  audienceType,
                  classId: "",
                  sectionId: "",
                  roleNames: [],
                  idListText: "",
                }));
                setDirty(true);
              }}
              className="min-h-11"
            >
              <option value="ALL">Whole school</option>
              <option value="CLASS">Class</option>
              <option value="SECTION">Section</option>
              <option value="ROLE">Role</option>
              <option value="STAFF">Specific staff</option>
              <option value="STUDENT">Specific students</option>
              <option value="GUARDIANS">Specific guardians (linked parents)</option>
              <option value="RECIPIENTS">Specific people</option>
            </select>
          </Field>
          {form.audienceType === "CLASS" || form.audienceType === "SECTION" ? (
            <Field label="Class">
              <select
                value={form.classId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    classId: event.target.value,
                    sectionId: "",
                  }));
                  setDirty(true);
                }}
                className="min-h-11"
              >
                <option value="">Select class</option>
                {(classesQuery.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {form.audienceType === "SECTION" ? (
            <Field label="Section">
              <select
                value={form.sectionId}
                onChange={(event) =>
                  change(setForm, setDirty, "sectionId", event.target.value)
                }
                className="min-h-11"
              >
                <option value="">Select section</option>
                {sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        {form.audienceType === "ROLE" ? (
          <Field label="Roles to notify">
            <select
              multiple
              value={form.roleNames}
              onChange={(event) => {
                const selected = Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                );
                change(setForm, setDirty, "roleNames", selected);
              }}
              className="min-h-28 rounded-xl border border-slate-200 px-3 py-2"
            >
              {(rolesQuery.data ?? []).map((role) => (
                <option key={role.id} value={role.name}>
                  {role.name}
                </option>
              ))}
            </select>
            <p className="text-xs font-normal text-slate-500">
              Hold Ctrl/Cmd to select multiple roles.
            </p>
          </Field>
        ) : null}

        {form.audienceType === "STAFF" ||
        form.audienceType === "STUDENT" ||
        form.audienceType === "GUARDIANS" ||
        form.audienceType === "RECIPIENTS" ? (
          <Field label={idListLabel(form.audienceType)}>
            <textarea
              value={form.idListText}
              rows={3}
              onChange={(event) =>
                change(setForm, setDirty, "idListText", event.target.value)
              }
              placeholder="Paste IDs separated by commas or new lines"
              className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs"
            />
            <p className="text-xs font-normal text-slate-500">
              {parseIdList(form.idListText).length} ID
              {parseIdList(form.idListText).length === 1 ? "" : "s"} entered.
            </p>
          </Field>
        ) : null}

        <Field label="Protected attachment">
          <FileUploader
            module="notices"
            maxFiles={1}
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onUploadComplete={(fileId, fileName) => {
              setForm((current) => ({
                ...current,
                attachmentFileId: fileId,
                attachmentFileName: fileName,
              }));
              setDirty(true);
            }}
            onRemove={(fileId) => {
              if (fileId !== form.attachmentFileId) return;
              setForm((current) => ({
                ...current,
                attachmentFileId: "",
                attachmentFileName: "",
              }));
              setDirty(true);
            }}
          />
          {form.attachmentFileName ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">
              <FileText className="mr-1 inline h-4 w-4" />{" "}
              {form.attachmentFileName}
            </p>
          ) : null}
        </Field>

        {formError ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700"
          >
            {formError}
          </p>
        ) : null}
        {validationError ? (
          <p className="text-sm font-medium text-warning-700">
            {validationError}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
          <button
            type="button"
            onClick={() => previewMutation.mutate()}
            disabled={Boolean(validationError) || previewMutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            <Eye size={16} />{" "}
            {previewMutation.isPending
              ? "Resolving audience..."
              : "Preview recipients"}
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={Boolean(validationError) || saveMutation.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save size={16} />{" "}
            {saveMutation.isPending ? "Saving draft..." : "Save draft"}
          </button>
        </div>
      </section>

      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-950">Recipient preview</h3>
          {preview ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Fact label="Resolved" value={preview.recipientCount} />
              <Fact label="Eligible" value={preview.allowedRecipientCount} />
              <Fact label="Excluded" value={preview.skippedRecipientCount} />
              <Fact
                label="Delivery rows"
                value={preview.estimatedDeliveryRows}
              />
              <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                <dt className="text-xs font-bold uppercase text-slate-500">
                  Backend-selected channels
                </dt>
                <dd className="mt-1 font-semibold text-slate-800">
                  {preview.channels.join(", ") || "Unavailable"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Preview uses the same backend audience resolver as publication.
              The browser never constructs the official audience.
            </p>
          )}
        </section>
        {form.priority !== "NORMAL" ? (
          <section className="rounded-2xl border border-warning-200 bg-warning-50 p-5 text-sm text-warning-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Urgent and emergency drafts cannot bypass approval. Saving this
                draft does not publish or queue delivery.
              </p>
            </div>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function payload(form: NoticeDraftForm) {
  const ids = parseIdList(form.idListText);
  // GUARDIANS and RECIPIENTS are composer-only concepts: the backend
  // resolver targets guardianIds/recipientUserIds directly whenever they're
  // present, regardless of audienceType, so both send audienceType "ALL".
  const audienceType =
    form.audienceType === "GUARDIANS" || form.audienceType === "RECIPIENTS"
      ? "ALL"
      : form.audienceType;

  return {
    title: form.title.trim(),
    titleNe: form.titleNe.trim() || undefined,
    body: form.body.trim(),
    bodyNe: form.bodyNe.trim() || undefined,
    category: form.category,
    isPinned: form.isPinned,
    priority: form.priority,
    audienceType,
    classId:
      form.audienceType === "CLASS" || form.audienceType === "SECTION"
        ? form.classId || null
        : null,
    sectionId: form.audienceType === "SECTION" ? form.sectionId || null : null,
    roleNames: form.audienceType === "ROLE" ? form.roleNames : undefined,
    staffIds: form.audienceType === "STAFF" ? ids : undefined,
    studentIds: form.audienceType === "STUDENT" ? ids : undefined,
    guardianIds: form.audienceType === "GUARDIANS" ? ids : undefined,
    recipientUserIds: form.audienceType === "RECIPIENTS" ? ids : undefined,
    attachmentFileId: form.attachmentFileId || undefined,
  };
}

function validate(form: NoticeDraftForm) {
  if (!form.title.trim()) return "Enter a notice title.";
  if (!form.body.trim()) return "Enter a concise notice message.";
  if (
    (form.audienceType === "CLASS" || form.audienceType === "SECTION") &&
    !form.classId
  )
    return "Select a class for this audience.";
  if (form.audienceType === "SECTION" && !form.sectionId)
    return "Select a section for this audience.";
  if (form.audienceType === "ROLE" && form.roleNames.length === 0)
    return "Select at least one role for this audience.";
  if (
    (form.audienceType === "STAFF" ||
      form.audienceType === "STUDENT" ||
      form.audienceType === "GUARDIANS" ||
      form.audienceType === "RECIPIENTS") &&
    parseIdList(form.idListText).length === 0
  )
    return "Enter at least one ID for this audience.";
  return null;
}

function formatCategoryLabel(category: string) {
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function idListLabel(audienceType: ComposerAudienceType) {
  switch (audienceType) {
    case "STAFF":
      return "Staff IDs";
    case "STUDENT":
      return "Student IDs";
    case "GUARDIANS":
      return "Guardian IDs";
    default:
      return "Recipient user IDs";
  }
}

function change<K extends keyof NoticeDraftForm>(
  setForm: React.Dispatch<React.SetStateAction<NoticeDraftForm>>,
  setDirty: (dirty: boolean) => void,
  key: K,
  value: NoticeDraftForm[K],
) {
  setForm((current) => ({ ...current, [key]: value }));
  setDirty(true);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-slate-950">{value}</dd>
    </div>
  );
}

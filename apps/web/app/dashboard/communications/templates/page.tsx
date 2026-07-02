"use client";

import type {
  CommunicationTemplateCategory,
  CommunicationTemplateChannel,
  CommunicationTemplateSummary,
} from "@schoolos/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  CheckCircle2,
  FileText,
  Mail,
  Plus,
  Save,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField, TextArea } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { ModuleHeader } from "@/components/ui/module-header";
import { ModuleTabs } from "@/components/ui/module-tabs";
import { PermissionState } from "@/components/ui/permission-state";
import { SectionCard } from "@/components/ui/section-card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { TablePagination } from "@/components/ui/table-pagination";
import { communicationsApi } from "@/lib/api/communications";

const PAGE_SIZE = 20;

const categories: CommunicationTemplateCategory[] = [
  "GENERAL",
  "HOLIDAY",
  "EMERGENCY",
  "FEES",
  "EXAMS",
  "TRANSPORT_DELAY",
  "EVENT",
];

const channels: CommunicationTemplateChannel[] = [
  "IN_APP",
  "PUSH",
  "SMS",
  "EMAIL",
];

type TemplateDraft = {
  key: string;
  category: CommunicationTemplateCategory;
  channel: CommunicationTemplateChannel;
  language: string;
  title: string;
  body: string;
};

type PendingTemplateAction = {
  action: "publish" | "archive";
  template: CommunicationTemplateSummary;
};

const emptyDraft: TemplateDraft = {
  key: "holiday-notice",
  category: "HOLIDAY",
  channel: "IN_APP",
  language: "en",
  title: "",
  body: "",
};

export default function CommunicationTemplatesPage() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const canManageTemplates = permissions.has("communications:manage_templates");
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] =
    useState<PendingTemplateAction | null>(null);

  const templatesQuery = useQuery({
    queryKey: ["communications", "templates", page],
    queryFn: () =>
      communicationsApi.listCommunicationTemplates({
        page,
        limit: PAGE_SIZE,
      }),
    enabled: canManageTemplates,
  });

  const selectedTemplate = useMemo(
    () =>
      templatesQuery.data?.items.find(
        (template) => template.id === editingTemplateId,
      ) ?? null,
    [editingTemplateId, templatesQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const validationError = validateDraft(draft);
      if (validationError) {
        throw new Error(validationError);
      }
      const payload = {
        key: draft.key.trim().toLowerCase(),
        category: draft.category,
        channel: draft.channel,
        language: draft.language.trim() || "en",
        title: draft.title.trim(),
        body: draft.body.trim(),
      };
      return editingTemplateId
        ? communicationsApi.updateCommunicationTemplate(
            editingTemplateId,
            payload,
          )
        : communicationsApi.createCommunicationTemplate(payload);
    },
    onSuccess: (template) => {
      setFeedback(
        editingTemplateId
          ? "Template draft updated."
          : `Draft version ${template.version} created.`,
      );
      setFormError(null);
      setEditingTemplateId(template.id);
      void queryClient.invalidateQueries({
        queryKey: ["communications", "templates"],
      });
    },
    onError: (error) => {
      setFeedback(null);
      setFormError(
        error instanceof Error
          ? error.message
          : "Template could not be saved. Review the fields and try again.",
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: communicationsApi.publishCommunicationTemplate,
    onSuccess: () => {
      setFeedback("Template published.");
      setPendingAction(null);
      void queryClient.invalidateQueries({
        queryKey: ["communications", "templates"],
      });
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : "Template could not be published. Try again.",
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: communicationsApi.archiveCommunicationTemplate,
    onSuccess: () => {
      setFeedback("Template archived.");
      setEditingTemplateId(null);
      setPendingAction(null);
      void queryClient.invalidateQueries({
        queryKey: ["communications", "templates"],
      });
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : "Template could not be archived. Try again.",
      );
    },
  });

  function loadDraft(template: CommunicationTemplateSummary) {
    setEditingTemplateId(template.id);
    setDraft({
      key: template.key,
      category: template.category,
      channel: template.channel,
      language: template.language,
      title: template.title,
      body: template.body,
    });
    setFeedback(null);
    setFormError(null);
  }

  function resetForm() {
    setEditingTemplateId(null);
    setDraft(emptyDraft);
    setFeedback(null);
    setFormError(null);
  }

  function publishTemplate(template: CommunicationTemplateSummary) {
    setPendingAction({ action: "publish", template });
  }

  function archiveTemplate(template: CommunicationTemplateSummary) {
    setPendingAction({ action: "archive", template });
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Communication Templates"
        description="Create, review, publish, and archive reusable notice templates."
        primaryAction={
          canManageTemplates ? (
            <Button type="button" onClick={resetForm}>
              <Plus className="h-4 w-4" />
              New Draft
            </Button>
          ) : undefined
        }
      />

      <ModuleTabs
        items={[
          {
            href: "/dashboard/communications",
            label: "Notices",
            icon: FileText,
          },
          {
            href: "/dashboard/communications/templates",
            label: "Templates",
            icon: Mail,
          },
        ]}
        accentColor="rose"
        variant="light"
      />

      {!canManageTemplates ? (
        <PermissionState
          className="mt-6"
          title="Templates are restricted"
          description="You do not have permission to create or manage communication templates."
        />
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard
            title="Template Library"
            description="Draft, published, and archived template versions for this school."
          >
            {templatesQuery.isLoading ? (
              <LoadingState label="Loading templates..." />
            ) : templatesQuery.isError ? (
              <ErrorState
                title="Templates unavailable"
                message="Communication templates could not be loaded. Try again."
                onRetry={() => void templatesQuery.refetch()}
              />
            ) : templatesQuery.data?.items.length ? (
              <div>
                <div className="divide-y divide-slate-100">
                  {templatesQuery.data.items.map((template) => (
                    <div
                      key={template.id}
                      className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <button
                        type="button"
                        onClick={() => loadDraft(template)}
                        className="min-w-0 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-black text-slate-950">
                            {template.title}
                          </p>
                          <StatusBadge status={template.status} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {template.key} · v{template.version} ·{" "}
                          {formatEnum(template.category)} ·{" "}
                          {formatEnum(template.channel)}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                          {template.body}
                        </p>
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        {template.status === "DRAFT" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => publishTemplate(template)}
                            isLoading={publishMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Publish
                          </Button>
                        ) : null}
                        {template.status !== "ARCHIVED" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => archiveTemplate(template)}
                            isLoading={archiveMutation.isPending}
                          >
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
                <TablePagination
                  page={templatesQuery.data.page ?? page}
                  pageSize={templatesQuery.data.limit ?? PAGE_SIZE}
                  total={templatesQuery.data.total}
                  onPageChange={setPage}
                />
              </div>
            ) : (
              <EmptyState
                title="No templates yet"
                description="Create a draft template for holiday, emergency, fees, exam, transport delay, event, or general notices."
              />
            )}
          </SectionCard>

          <div className="space-y-6">
            <SectionCard
              title={editingTemplateId ? "Edit Draft" : "New Draft Version"}
              description={
                selectedTemplate?.status && selectedTemplate.status !== "DRAFT"
                  ? "Published and archived templates are read-only. Create a new draft version before changing wording."
                  : "Draft templates can be edited until they are published."
              }
            >
              <div className="space-y-4">
                <FormField label="Key" description="Lowercase kebab-case key.">
                  <Input
                    value={draft.key}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        key: event.target.value,
                      }))
                    }
                    disabled={Boolean(editingTemplateId)}
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Category">
                    <Select
                      value={draft.category}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          category: event.target
                            .value as CommunicationTemplateCategory,
                        }))
                      }
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {formatEnum(category)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Channel">
                    <Select
                      value={draft.channel}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          channel: event.target
                            .value as CommunicationTemplateChannel,
                        }))
                      }
                    >
                      {channels.map((channel) => (
                        <option key={channel} value={channel}>
                          {formatEnum(channel)}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                </div>
                <FormField label="Language" description="Example: en or ne-NP.">
                  <Input
                    value={draft.language}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        language: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Title">
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="School closure notice"
                  />
                </FormField>
                <FormField label="Body">
                  <TextArea
                    rows={7}
                    value={draft.body}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Write approved notice wording..."
                  />
                </FormField>

                {formError ? (
                  <p className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
                    {formError}
                  </p>
                ) : null}
                {feedback ? (
                  <p className="rounded-xl border border-success-100 bg-success-50 px-3 py-2 text-sm font-semibold text-success-700">
                    {feedback}
                  </p>
                ) : null}

                <Button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  isLoading={saveMutation.isPending}
                  disabled={
                    selectedTemplate?.status !== undefined &&
                    selectedTemplate.status !== "DRAFT"
                  }
                >
                  <Save className="h-4 w-4" />
                  {editingTemplateId ? "Save Draft" : "Create Draft"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              title="Safe Preview"
              description="Review wording before using this template in a notice."
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-950">
                  {draft.title.trim() || "Template title"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {draft.body.trim() || "Template body preview"}
                </p>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={
          pendingAction?.action === "archive"
            ? "Archive communication template?"
            : "Publish communication template?"
        }
        description={
          pendingAction?.action === "archive"
            ? `Archive version ${pendingAction.template.version} of ${pendingAction.template.key}? Archived templates stay in history but should not be reused.`
            : pendingAction
              ? `Publish version ${pendingAction.template.version} of ${pendingAction.template.key}? Published templates are available to notice authors.`
              : ""
        }
        confirmLabel={
          pendingAction?.action === "archive" ? "Archive" : "Publish"
        }
        variant={pendingAction?.action === "archive" ? "warning" : "default"}
        isConfirming={
          pendingAction?.action === "archive"
            ? archiveMutation.isPending
            : publishMutation.isPending
        }
        onConfirm={() => {
          if (!pendingAction) return;
          if (pendingAction.action === "archive") {
            archiveMutation.mutate(pendingAction.template.id);
          } else {
            publishMutation.mutate(pendingAction.template.id);
          }
        }}
        onClose={() => {
          if (!archiveMutation.isPending && !publishMutation.isPending) {
            setPendingAction(null);
          }
        }}
      />
    </DashboardPageShell>
  );
}

function validateDraft(draft: TemplateDraft) {
  if (!/^[a-z0-9][a-z0-9-_]*[a-z0-9]$/.test(draft.key.trim())) {
    return "Use a lowercase key with letters, numbers, hyphens, or underscores.";
  }
  if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(draft.language.trim())) {
    return "Use a language code such as en or ne-NP.";
  }
  if (draft.title.trim().length < 2) return "Enter a template title.";
  if (draft.body.trim().length < 2) return "Enter template body text.";
  return null;
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, FileText, Link as LinkIcon, Plus, StickyNote } from 'lucide-react';
import { learningApi } from '../../lib/api/learning';
import type {
  LearningResource,
  LearningResourcePayload,
  LearningResourceType,
} from '../../lib/api/learning';
import { EmptyState } from '../ui/empty-state';
import { LoadingState } from '../ui/loading-state';
import { StatusBadge } from '../ui/status-badge';

const resourceTypes: LearningResourceType[] = ['LINK', 'NOTE', 'FILE'];

const emptyResourceForm: LearningResourcePayload = {
  type: 'LINK',
  title: '',
  url: '',
  fileAssetId: '',
  metadata: {},
};

export function LearningResourcesPanel({ activityId }: { activityId: string }) {
  const [form, setForm] = useState<LearningResourcePayload>(emptyResourceForm);
  const [notice, setNotice] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const resourcesQuery = useQuery({
    queryKey: ['learning-activity-resources', activityId],
    queryFn: () => learningApi.listActivityResources(activityId),
  });

  const attachMutation = useMutation({
    mutationFn: (body: LearningResourcePayload) =>
      learningApi.attachActivityResource(activityId, body),
    onSuccess: () => {
      setNotice('Resource attached.');
      setForm(emptyResourceForm);
      void queryClient.invalidateQueries({
        queryKey: ['learning-activity-resources', activityId],
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: learningApi.archiveResource,
    onSuccess: () => {
      setNotice('Resource archived.');
      void queryClient.invalidateQueries({
        queryKey: ['learning-activity-resources', activityId],
      });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    attachMutation.mutate(normalizeResourcePayload(form));
  }

  return (
    <section className="shell-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">
            Resource Library
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Attach file metadata, safe links, or teacher notes to this activity.
          </p>
        </div>
        {notice && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            {notice}
          </span>
        )}
      </div>

      <form className="mt-5 grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={submit}>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">
            Type
          </span>
          <select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                type: event.target.value as LearningResourceType,
              }))
            }
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {resourceTypes.map((type) => (
              <option key={type} value={type}>
                {labelize(type)}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Title"
          value={form.title}
          required
          onChange={(title) => setForm((current) => ({ ...current, title }))}
        />
        {form.type === 'FILE' ? (
          <Input
            label="File asset ID"
            value={form.fileAssetId ?? ''}
            required
            onChange={(fileAssetId) =>
              setForm((current) => ({ ...current, fileAssetId }))
            }
          />
        ) : form.type === 'LINK' ? (
          <Input
            label="URL"
            value={form.url ?? ''}
            required
            onChange={(url) => setForm((current) => ({ ...current, url }))}
          />
        ) : (
          <Input
            label="Note"
            value={String((form.metadata as { note?: string })?.note ?? '')}
            onChange={(note) =>
              setForm((current) => ({ ...current, metadata: { note } }))
            }
          />
        )}
        <button
          type="submit"
          disabled={attachMutation.isPending}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 md:mt-6"
        >
          <Plus size={16} />
          Attach
        </button>
      </form>

      {resourcesQuery.isLoading ? (
        <LoadingState label="Loading resources" />
      ) : resourcesQuery.data?.items.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="No resources attached"
          description="Attach resource metadata after files have been registered through the SchoolOS file pipeline."
          className="mt-5"
        />
      ) : (
        <div className="mt-5 grid gap-3">
          {resourcesQuery.data?.items.map((resource) => (
            <ResourceRow
              key={resource.id}
              resource={resource}
              onArchive={() => archiveMutation.mutate(resource.id)}
            />
          ))}
        </div>
      )}

      {(attachMutation.error || archiveMutation.error || resourcesQuery.error) && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {attachMutationErrorMessage(
            attachMutation.error,
            archiveMutation.error,
            resourcesQuery.error,
          )}
        </div>
      )}
    </section>
  );
}

function attachMutationErrorMessage(
  attachError: unknown,
  archiveError: unknown,
  queryError: unknown,
) {
  const error = attachError ?? archiveError ?? queryError;
  return error instanceof Error ? error.message : 'Learning resource request failed.';
}

function ResourceRow({
  resource,
  onArchive,
}: {
  resource: LearningResource;
  onArchive: () => void;
}) {
  const Icon =
    resource.type === 'LINK'
      ? LinkIcon
      : resource.type === 'NOTE'
        ? StickyNote
        : FileText;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">
            {resource.title}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {resource.type === 'FILE'
              ? resource.fileAsset?.fileName ?? resource.fileAssetId
              : resource.type === 'LINK'
                ? resource.url
                : String((resource.metadata as { note?: string })?.note ?? 'Teacher note')}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={resource.status} />
        <button
          type="button"
          onClick={onArchive}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 hover:bg-slate-50"
        >
          <Archive size={15} />
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function normalizeResourcePayload(
  payload: LearningResourcePayload,
): LearningResourcePayload {
  return {
    type: payload.type,
    title: payload.title.trim(),
    ...(payload.type === 'FILE'
      ? { fileAssetId: payload.fileAssetId?.trim() }
      : {}),
    ...(payload.type === 'LINK' ? { url: payload.url?.trim() } : {}),
    ...(payload.type === 'NOTE' ? { metadata: payload.metadata } : {}),
  };
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

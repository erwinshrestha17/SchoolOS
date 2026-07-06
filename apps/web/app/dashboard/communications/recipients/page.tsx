'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileText, Send, ShieldAlert, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { useSession } from '@/components/session-provider';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField, TextArea } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { KpiCard, KpiGrid } from '@/components/ui/kpi-card';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleTabs } from '@/components/ui/module-tabs';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { SectionCard } from '@/components/ui/section-card';
import { Select } from '@/components/ui/select';
import { communicationsApi } from '@/lib/api/communications';
import { api } from '@/lib/api';

type AudienceType = 'ALL' | 'CLASS' | 'SECTION';
type NoticePriority = 'NORMAL' | 'URGENT' | 'EMERGENCY';

type SectionSummaryForUi = {
  id: string;
  name: string;
  classId?: string | null;
  class?: { id: string } | null;
};

export default function CommunicationRecipientsPage() {
  const { session } = useSession();
  const permissions = new Set(session?.user.permissions ?? []);
  const canPreviewRecipients = permissions.has('notices:create');
  const [form, setForm] = useState({
    title: 'Recipient preview',
    body: 'Preview audience reach before sending this notice.',
    priority: 'NORMAL' as NoticePriority,
    audienceType: 'ALL' as AudienceType,
    classId: '',
    sectionId: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ['communications', 'recipient-preview', 'classes'],
    queryFn: api.listClasses,
    enabled: canPreviewRecipients,
  });
  const sectionsQuery = useQuery({
    queryKey: ['communications', 'recipient-preview', 'sections'],
    queryFn: api.listSections,
    enabled: canPreviewRecipients,
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];
    if (firstClass && !form.classId) {
      setForm((current) => ({ ...current, classId: firstClass.id }));
    }
  }, [classesQuery.data, form.classId]);

  const sections = useMemo(
    () =>
      ((sectionsQuery.data ?? []) as SectionSummaryForUi[]).filter(
        (section) =>
          section.classId === form.classId ||
          section.class?.id === form.classId,
      ),
    [form.classId, sectionsQuery.data],
  );

  const previewMutation = useMutation({
    mutationFn: () => {
      const validationError = validatePreview(form);
      if (validationError) throw new Error(validationError);
      return communicationsApi.previewNoticeRecipients({
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        audienceType: form.audienceType,
        classId: form.audienceType === 'ALL' ? null : form.classId || null,
        sectionId:
          form.audienceType === 'SECTION' ? form.sectionId || null : null,
      });
    },
    onSuccess: () => setFormError(null),
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Recipient preview could not be generated.',
      );
    },
  });

  const preview = previewMutation.data;

  return (
    <DashboardPageShell>
      <ModuleHeader
        title="Recipient Preview"
        description="Preview audience reach before publishing a notice."
      >
        <KpiGrid className="sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Eligible Recipients"
            value={preview?.recipientCount ?? 'Preview'}
            icon={<Users size={20} />}
            tone="neutral"
            description="People matched by the selected audience."
          />
          <KpiCard
            title="Allowed"
            value={preview?.allowedRecipientCount ?? 'Preview'}
            icon={<CheckCircle2 size={20} />}
            tone="success"
            description="Recipients allowed after communication policy checks."
          />
          <KpiCard
            title="Skipped"
            value={preview?.skippedRecipientCount ?? 'Preview'}
            icon={<ShieldAlert size={20} />}
            tone={
              (preview?.skippedRecipientCount ?? 0) > 0 ? 'warning' : 'neutral'
            }
            description="Skipped by missing consent or communication policy."
          />
          <KpiCard
            title="Delivery Rows"
            value={preview?.estimatedDeliveryRows ?? 'Preview'}
            icon={<Send size={20} />}
            tone="info"
            description="Estimated delivery attempts across channels."
          />
        </KpiGrid>
      </ModuleHeader>

      <ModuleTabs
        items={[
          {
            href: '/dashboard/communications',
            label: 'Notices',
            icon: FileText,
          },
          {
            href: '/dashboard/communications/recipients',
            label: 'Recipients',
            icon: Users,
          },
        ]}
        accentColor="rose"
        variant="light"
      />

      {!canPreviewRecipients ? (
        <PermissionDenied
          showNavigation={false}
          className="mt-6"
          title="Recipient preview is restricted"
          description="You need notice creation permission to preview recipients."
        />
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SectionCard
            title="Preview Audience"
            description="Use confirmed notice targeting scopes only: school-wide, class, or section."
          >
            <div className="space-y-5">
              <FormField label="Preview Title">
                <Input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField label="Preview Body">
                <TextArea
                  rows={4}
                  value={form.body}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                />
              </FormField>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField label="Priority">
                  <Select
                    value={form.priority}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value as NoticePriority,
                      }))
                    }
                  >
                    {['NORMAL', 'URGENT', 'EMERGENCY'].map((priority) => (
                      <option key={priority} value={priority}>
                        {formatEnum(priority)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Audience">
                  <Select
                    value={form.audienceType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        audienceType: event.target.value as AudienceType,
                        sectionId: '',
                      }))
                    }
                  >
                    {['ALL', 'CLASS', 'SECTION'].map((audience) => (
                      <option key={audience} value={audience}>
                        {formatEnum(audience)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Class">
                  <Select
                    value={form.classId}
                    disabled={form.audienceType === 'ALL'}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        classId: event.target.value,
                        sectionId: '',
                      }))
                    }
                  >
                    <option value="">Select class</option>
                    {(classesQuery.data ?? []).map((classroom) => (
                      <option key={classroom.id} value={classroom.id}>
                        {classroom.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              {form.audienceType === 'SECTION' ? (
                <FormField label="Section">
                  <Select
                    value={form.sectionId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        sectionId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}

              {formError ? (
                <p className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-700">
                  {formError}
                </p>
              ) : null}

              <Button
                type="button"
                onClick={() => previewMutation.mutate()}
                isLoading={previewMutation.isPending}
              >
                <Users className="h-4 w-4" />
                Preview Recipients
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Preview Result"
            description="The preview shows counts and channels only."
          >
            {classesQuery.isLoading || sectionsQuery.isLoading ? (
              <LoadingState label="Loading audience filters..." />
            ) : classesQuery.isError || sectionsQuery.isError ? (
              <ErrorState
                title="Audience filters unavailable"
                message="Classes or sections could not be loaded. Try again."
                onRetry={() => {
                  void classesQuery.refetch();
                  void sectionsQuery.refetch();
                }}
              />
            ) : preview ? (
              <div className="space-y-4">
                <ResultRow
                  label="Audience"
                  value={formatEnum(preview.audienceType)}
                />
                <ResultRow
                  label="Priority"
                  value={formatEnum(preview.priority)}
                />
                <ResultRow
                  label="Channels"
                  value={preview.channels.map(formatEnum).join(', ')}
                />
                <ResultRow label="Recipients" value={preview.recipientCount} />
                <ResultRow
                  label="Allowed"
                  value={preview.allowedRecipientCount}
                />
                <ResultRow
                  label="Skipped"
                  value={preview.skippedRecipientCount}
                />
                <ResultRow
                  label="Estimated delivery rows"
                  value={preview.estimatedDeliveryRows}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-600">
                Generate a preview to see recipient counts.
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </DashboardPageShell>
  );
}

function validatePreview(form: {
  title: string;
  body: string;
  audienceType: AudienceType;
  classId: string;
  sectionId: string;
}) {
  if (form.title.trim().length < 2) return 'Enter a preview title.';
  if (form.body.trim().length < 2) return 'Enter preview body text.';
  if (form.audienceType !== 'ALL' && !form.classId) {
    return 'Select a class for this audience.';
  }
  if (form.audienceType === 'SECTION' && !form.sectionId) {
    return 'Select a section for this audience.';
  }
  return null;
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-black text-slate-950">{value}</span>
    </div>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

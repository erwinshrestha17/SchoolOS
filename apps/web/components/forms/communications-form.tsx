'use client';

import type {
  AdmissionSummary,
  EventSummary,
  GuardianConsentStatus,
  NoticeSummary,
  NotificationDelivery,
} from '@schoolos/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { FormField } from '../ui/form-field';
import { LoadingState } from '../ui/loading-state';
import { EmptyState } from '../ui/empty-state';
import { Tabs, TabsContent } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { FileUploader } from '../ui/file-uploader';
import { ModuleTabs } from '../dashboard/module-tabs';
import { cn } from '../../lib/utils';
import { RefreshCcw, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const communicationSections = [
  'Notices',
  'Events',
  'Delivery Records',
  'Consent Management',
] as const;

const noticePriorities = ['NORMAL', 'URGENT', 'EMERGENCY'] as const;
const audienceTypes = ['ALL', 'CLASS', 'SECTION'] as const;
const eventTypes = ['GENERAL', 'EXAM', 'MEETING', 'HOLIDAY'] as const;
const deliveryStatuses = [
  'QUEUED',
  'SENT',
  'FAILED',
  'SKIPPED',
  'PENDING',
  'RETRYING',
] as const;
const consentTypes = [
  'PRIVACY',
  'DATA_PROCESSING',
  'MEDICAL',
  'PHOTO_USAGE',
  'MESSAGING',
] as const;

type CommunicationSection = (typeof communicationSections)[number];
type AudienceType = (typeof audienceTypes)[number];
type NoticePriority = (typeof noticePriorities)[number];
type EventType = (typeof eventTypes)[number];

type SectionSummaryForUi = {
  id: string;
  name: string;
  classId?: string | null;
  class?: { id: string } | null;
};

type GuardianOption = AdmissionSummary['guardians'][number] & {
  studentName: string;
  studentSystemId: string;
};

type NoticeState = {
  title: string;
  body: string;
  priority: NoticePriority;
  audienceType: AudienceType;
  classId: string;
  sectionId: string;
  scheduleMode: 'NOW' | 'LATER';
  scheduledFor: string;
  attachmentFileId: string;
  attachmentFileName: string;
};

type EventState = {
  title: string;
  description: string;
  eventType: EventType;
  audienceType: AudienceType;
  classId: string;
  sectionId: string;
  startsAt: string;
  location: string;
};

const sectionMeta: Record<
  CommunicationSection,
  {
    title: string;
    description: string;
    badge: string;
  }
> = {
  Notices: {
    title: 'Notice Center',
    description:
      'Publish notices instantly or schedule them for selected classes, sections, or the whole school.',
    badge: 'Announcements',
  },
  Events: {
    title: 'Event Publisher',
    description:
      'Create school events, meetings, exams, and holidays with audience-aware delivery.',
    badge: 'Calendar Updates',
  },
  'Delivery Records': {
    title: 'Delivery Records',
    description:
      'Track queued, sent, skipped, failed, and retrying notification records across channels.',
    badge: 'Audit Trail',
  },
  'Consent Management': {
    title: 'Consent Management',
    description:
      'Capture and revoke guardian consent for privacy, messaging, medical, and photo usage workflows.',
    badge: 'Guardian Controls',
  },
};

export function CommunicationsForm({
  initialSection = 'Notices',
}: {
  initialSection?: CommunicationSection;
}) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] =
    useState<CommunicationSection>(initialSection);
  const [notice, setNotice] = useState<NoticeState>({
    title: '',
    body: '',
    priority: 'NORMAL',
    audienceType: 'ALL',
    classId: '',
    sectionId: '',
    scheduleMode: 'NOW',
    scheduledFor: '',
    attachmentFileId: '',
    attachmentFileName: '',
  });
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeSuccess, setNoticeSuccess] = useState<string | null>(null);
  const [event, setEvent] = useState<EventState>({
    title: '',
    description: '',
    eventType: 'GENERAL',
    audienceType: 'ALL',
    classId: '',
    sectionId: '',
    startsAt: new Date().toISOString().slice(0, 16),
    location: '',
  });
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventSuccess, setEventSuccess] = useState<string | null>(null);
  const [deliveryFilters, setDeliveryFilters] = useState({
    status: '',
    channel: '',
    sourceType: '',
  });
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [selectedConsentType, setSelectedConsentType] = useState('PHOTO_USAGE');

  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
  });
  const deliveriesQuery = useQuery({
    queryKey: ['notification-deliveries'],
    queryFn: api.listNotificationDeliveries,
  });
  const noticesQuery = useQuery({
    queryKey: ['notices'],
    queryFn: api.listNotices,
  });
  const eventsQuery = useQuery({
    queryKey: ['events'],
    queryFn: api.listEvents,
  });
  const admissionsQuery = useQuery({
    queryKey: ['admissions'],
    queryFn: () => api.listAdmissions(),
  });
  const guardianConsentStatusQuery = useQuery({
    queryKey: ['guardian-consent-status', selectedGuardianId],
    queryFn: () => api.getGuardianConsentStatus(selectedGuardianId),
    enabled: Boolean(selectedGuardianId),
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setNotice((current) =>
        current.classId ? current : { ...current, classId: firstClass.id },
      );
      setEvent((current) =>
        current.classId ? current : { ...current, classId: firstClass.id },
      );
    }
  }, [classesQuery.data]);

  const classes = classesQuery.data ?? [];
  const sections = (sectionsQuery.data ?? []) as SectionSummaryForUi[];

  const guardians = useMemo(
    () =>
      (admissionsQuery.data?.items ?? []).flatMap((admission) =>
        admission.guardians.map((guardian) => ({
          ...guardian,
          studentName: admission.fullNameEn,
          studentSystemId: admission.studentSystemId,
        })),
      ),
    [admissionsQuery.data],
  );

  useEffect(() => {
    const firstGuardian = guardians[0];

    if (firstGuardian && !selectedGuardianId) {
      setSelectedGuardianId(firstGuardian.id);
    }
  }, [guardians, selectedGuardianId]);

  const noticeSections = filterSectionsForClass(sections, notice.classId);
  const eventSections = filterSectionsForClass(sections, event.classId);
  const filteredDeliveries = (deliveriesQuery.data ?? []).filter((delivery) => {
    return (
      (!deliveryFilters.status || delivery.status === deliveryFilters.status) &&
      (!deliveryFilters.channel ||
        delivery.channel === deliveryFilters.channel) &&
      (!deliveryFilters.sourceType ||
        delivery.sourceType === deliveryFilters.sourceType)
    );
  });
  const deliveryChannels = uniqueValues(
    (deliveriesQuery.data ?? []).map((delivery) => delivery.channel),
  );
  const deliverySourceTypes = uniqueValues(
    (deliveriesQuery.data ?? []).map((delivery) => delivery.sourceType),
  );

  const deliveryStats = useMemo(() => {
    const deliveries = deliveriesQuery.data ?? [];
    return {
      total: deliveries.length,
      sent: deliveries.filter((item) => item.status === 'SENT').length,
      failed: deliveries.filter((item) => item.status === 'FAILED').length,
      pending: deliveries.filter((item) =>
        ['QUEUED', 'PENDING', 'RETRYING'].includes(item.status),
      ).length,
    };
  }, [deliveriesQuery.data]);

  const activeMeta = sectionMeta[activeSection];

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const noticeMutation = useMutation({
    mutationFn: api.createNotice,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
      void queryClient.invalidateQueries({ queryKey: ['notices'] });
      setNoticeSuccess(
        notice.scheduleMode === 'LATER'
          ? 'Notice scheduled successfully.'
          : 'Notice published. Delivery records have been queued.',
      );
      setNoticeError(null);
      setNotice((current) => ({
        ...current,
        title: '',
        body: '',
        scheduledFor:
          current.scheduleMode === 'LATER' ? current.scheduledFor : '',
        attachmentFileId: '',
        attachmentFileName: '',
      }));
    },
    onError: (error) => {
      setNoticeError(error.message);
      setNoticeSuccess(null);
    },
  });

  const eventMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setEventSuccess(
        'Event created. Delivery records were queued where audience rules apply.',
      );
      setEventError(null);
      setEvent((current) => ({
        ...current,
        title: '',
        description: '',
        location: '',
      }));
    },
    onError: (error) => {
      setEventError(error.message);
      setEventSuccess(null);
    },
  });
  const captureConsentMutation = useMutation({
    mutationFn: () =>
      api.captureGuardianConsent(selectedGuardianId, {
        consentType: selectedConsentType,
        version: 'v1-admin',
        metadata: {
          source: 'admin-web',
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['guardian-consent-status'],
      });
      void queryClient.invalidateQueries({ queryKey: ['consents'] });
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
    },
  });
  const revokeConsentMutation = useMutation({
    mutationFn: () =>
      api.revokeGuardianConsent(selectedGuardianId, {
        consentType: selectedConsentType,
        version: 'v1-admin',
        metadata: {
          source: 'admin-web',
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['guardian-consent-status'],
      });
      void queryClient.invalidateQueries({ queryKey: ['consents'] });
      void queryClient.invalidateQueries({
        queryKey: ['notification-deliveries'],
      });
    },
  });

  function submitNotice() {
    const validationError = validateAudienceFields({
      title: notice.title,
      body: notice.body,
      audienceType: notice.audienceType,
      classId: notice.classId,
      sectionId: notice.sectionId,
      scheduledFor:
        notice.scheduleMode === 'LATER' ? notice.scheduledFor : null,
    });

    if (validationError) {
      setNoticeError(validationError);
      setNoticeSuccess(null);
      return;
    }

    noticeMutation.mutate({
      title: notice.title.trim(),
      body: notice.body.trim(),
      priority: notice.priority,
      audienceType: notice.audienceType,
      classId: notice.audienceType === 'ALL' ? null : notice.classId || null,
      sectionId:
        notice.audienceType === 'SECTION' ? notice.sectionId || null : null,
      attachmentFileId: notice.attachmentFileId || null,
      scheduledFor:
        notice.scheduleMode === 'LATER' && notice.scheduledFor
          ? new Date(notice.scheduledFor).toISOString()
          : null,
    });
  }

  function submitEvent() {
    const validationError = validateAudienceFields({
      title: event.title,
      body: event.description || event.title,
      audienceType: event.audienceType,
      classId: event.classId,
      sectionId: event.sectionId,
      scheduledFor: event.startsAt,
    });

    if (validationError) {
      setEventError(validationError);
      setEventSuccess(null);
      return;
    }

    eventMutation.mutate({
      title: event.title.trim(),
      description: event.description.trim() || null,
      eventType: event.eventType,
      audienceType: event.audienceType,
      classId: event.audienceType === 'ALL' ? null : event.classId || null,
      sectionId:
        event.audienceType === 'SECTION' ? event.sectionId || null : null,
      startsAt: new Date(event.startsAt).toISOString(),
      location: event.location.trim() || null,
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
              {activeMeta.badge}
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-950">
              {activeMeta.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              {activeMeta.description}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[440px]">
            <CommunicationMetric
              label="Notices"
              value={String(noticesQuery.data?.length ?? 0)}
              tone="neutral"
            />
            <CommunicationMetric
              label="Events"
              value={String(eventsQuery.data?.length ?? 0)}
              tone="info"
            />
            <CommunicationMetric
              label="Sent"
              value={String(deliveryStats.sent)}
              tone="success"
            />
            <CommunicationMetric
              label="Failed"
              value={String(deliveryStats.failed)}
              tone="danger"
            />
          </div>
        </div>
      </section>

      <Tabs
        value={activeSection}
        onValueChange={(val) => setActiveSection(val as CommunicationSection)}
        className="space-y-8"
      >
        <div className="sticky top-4 z-20 rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur">
          <ModuleTabs
            items={communicationSections.map((section) => ({
              value: section,
              label: section,
            }))}
            activeValue={activeSection}
            onValueChange={(value) =>
              setActiveSection(value as CommunicationSection)
            }
            accentColor="rose"
            variant="light"
          />
        </div>

        {deliveryStats.pending > 0 && (
          <div className="bg-[var(--color-mod-notices-bg)] border border-[var(--color-mod-notices-border)] p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="h-2 w-2 rounded-full bg-[var(--color-mod-notices-accent)] animate-pulse" />
            <p className="text-sm font-bold text-[var(--color-mod-notices-text)]">
              {deliveryStats.pending} delivery records are currently queued or
              retrying.
            </p>
          </div>
        )}

        <TabsContent value="Notices" className="mt-0">
          <NoticesSection
            notice={notice}
            setNotice={setNotice}
            classes={classes}
            sections={noticeSections}
            notices={noticesQuery.data ?? []}
            noticesLoading={noticesQuery.isLoading}
            noticesError={
              noticesQuery.isError ? noticesQuery.error.message : null
            }
            submitNotice={submitNotice}
            isPending={noticeMutation.isPending}
            noticeError={noticeError}
            noticeSuccess={noticeSuccess}
          />
        </TabsContent>

        <TabsContent value="Events" className="mt-0">
          <EventsSection
            event={event}
            setEvent={setEvent}
            classes={classes}
            sections={eventSections}
            events={eventsQuery.data ?? []}
            eventsLoading={eventsQuery.isLoading}
            eventsError={eventsQuery.isError ? eventsQuery.error.message : null}
            submitEvent={submitEvent}
            isPending={eventMutation.isPending}
            eventError={eventError}
            eventSuccess={eventSuccess}
          />
        </TabsContent>

        <TabsContent value="Delivery Records" className="mt-0">
          <DeliveryRecordsSection
            deliveries={filteredDeliveries}
            isLoading={deliveriesQuery.isLoading}
            error={
              deliveriesQuery.isError ? deliveriesQuery.error.message : null
            }
            filters={deliveryFilters}
            setFilters={setDeliveryFilters}
            channels={deliveryChannels}
            sourceTypes={deliverySourceTypes}
            totalDeliveries={deliveriesQuery.data?.length ?? 0}
          />
        </TabsContent>

        <TabsContent value="Consent Management" className="mt-0">
          <ConsentManagementSection
            guardians={guardians}
            selectedGuardianId={selectedGuardianId}
            setSelectedGuardianId={setSelectedGuardianId}
            selectedConsentType={selectedConsentType}
            setSelectedConsentType={setSelectedConsentType}
            statuses={guardianConsentStatusQuery.data ?? []}
            statusesLoading={guardianConsentStatusQuery.isLoading}
            captureConsent={() => captureConsentMutation.mutate()}
            revokeConsent={() => revokeConsentMutation.mutate()}
            capturePending={captureConsentMutation.isPending}
            revokePending={revokeConsentMutation.isPending}
            captureError={
              captureConsentMutation.isError
                ? captureConsentMutation.error.message
                : null
            }
            revokeError={
              revokeConsentMutation.isError
                ? revokeConsentMutation.error.message
                : null
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoticesSection({
  notice,
  setNotice,
  classes,
  sections,
  notices,
  noticesLoading,
  noticesError,
  submitNotice,
  isPending,
  noticeError,
  noticeSuccess,
}: {
  notice: NoticeState;
  setNotice: Dispatch<SetStateAction<NoticeState>>;
  classes: Array<{ id: string; name: string }>;
  sections: SectionSummaryForUi[];
  notices: NoticeSummary[];
  noticesLoading: boolean;
  noticesError: string | null;
  submitNotice: () => void;
  isPending: boolean;
  noticeError: string | null;
  noticeSuccess: string | null;
}) {
  const characterCount = notice.body.trim().length;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="shell-card rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <SectionHeader
          eyebrow="Notice Composer"
          title="Publish school notice"
          description="Create clear, audience-targeted announcements for guardians, students, and staff."
        />

        <div className="mt-6 space-y-6">
          <FormField
            label="Title"
            description="Give your notice a clear, actionable title."
          >
            <Input
              value={notice.title}
              onChange={(event) =>
                setNotice((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Example: Parent-Teacher Association Meeting"
              className="h-12"
            />
          </FormField>

          <FormField
            label="Notice Content"
            description={`${characterCount} characters`}
          >
            <textarea
              rows={6}
              value={notice.body}
              onChange={(event) =>
                setNotice((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              placeholder="Write the notice body for guardians, students, or staff..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium transition-all focus:border-[var(--color-mod-notices-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--color-mod-notices-border)]/40 min-h-[160px] resize-none"
            />
          </FormField>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Priority">
              <Select
                value={notice.priority}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    priority: event.target.value as NoticePriority,
                  }))
                }
              >
                {noticePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatEnumLabel(priority)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Audience">
              <Select
                value={notice.audienceType}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    audienceType: event.target.value as AudienceType,
                    sectionId: '',
                  }))
                }
              >
                {audienceTypes.map((audienceType) => (
                  <option key={audienceType} value={audienceType}>
                    {formatEnumLabel(audienceType)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Class">
              <Select
                value={notice.classId}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    classId: event.target.value,
                    sectionId: '',
                  }))
                }
                disabled={notice.audienceType === 'ALL'}
              >
                <option value="">Select class</option>
                {classes.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {notice.audienceType === 'SECTION' ? (
            <label>
              <span className="label mb-2 block">Section</span>
              <select
                value={notice.sectionId}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    sectionId: event.target.value,
                  }))
                }
                className="min-h-11"
              >
                <option value="">Select section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <FormField
            label="Attachment"
            description="Uploads use File Registry and return protected preview/download URLs."
          >
            <FileUploader
              module="notices"
              maxFiles={1}
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onUploadComplete={(fileId, fileName) =>
                setNotice((current) => ({
                  ...current,
                  attachmentFileId: fileId,
                  attachmentFileName: fileName,
                }))
              }
              onRemove={(fileId) =>
                setNotice((current) =>
                  current.attachmentFileId === fileId
                    ? {
                        ...current,
                        attachmentFileId: '',
                        attachmentFileName: '',
                      }
                    : current,
                )
              }
            />
            {notice.attachmentFileName ? (
              <p className="mt-2 text-xs font-semibold text-slate-500">
                Attached through File Registry: {notice.attachmentFileName}
              </p>
            ) : null}
          </FormField>

          <fieldset className="rounded-3xl border border-[var(--line)] bg-gray-50/70 p-4">
            <legend className="label px-2">Schedule option</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <ScheduleOption
                title="Publish now"
                description="Queue delivery immediately."
                checked={notice.scheduleMode === 'NOW'}
                name="notice-schedule-mode"
                onChange={() =>
                  setNotice((current) => ({
                    ...current,
                    scheduleMode: 'NOW',
                    scheduledFor: '',
                  }))
                }
              />
              <ScheduleOption
                title="Schedule later"
                description="Publish at a selected date and time."
                checked={notice.scheduleMode === 'LATER'}
                name="notice-schedule-mode"
                onChange={() =>
                  setNotice((current) => ({
                    ...current,
                    scheduleMode: 'LATER',
                  }))
                }
              />
            </div>
            {notice.scheduleMode === 'LATER' ? (
              <Input
                type="datetime-local"
                value={notice.scheduledFor}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    scheduledFor: event.target.value,
                  }))
                }
                className="mt-4"
              />
            ) : null}
          </fieldset>

          {notice.priority === 'EMERGENCY' ? (
            <InlineMessage
              tone="error"
              message="Emergency notices may trigger forced delivery channels depending on school settings."
            />
          ) : null}
          {noticeError ? (
            <InlineMessage tone="error" message={noticeError} />
          ) : null}
          {noticeSuccess ? (
            <InlineMessage tone="success" message={noticeSuccess} />
          ) : null}

          <button
            type="button"
            className="min-h-12 rounded-2xl bg-gradient-to-r from-slate-950 to-slate-800 px-5 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isPending}
            onClick={submitNotice}
          >
            {isPending
              ? 'Submitting...'
              : notice.scheduleMode === 'LATER'
                ? 'Schedule notice'
                : 'Publish notice'}
          </button>
        </div>
      </div>

      <NoticeList
        notices={notices}
        isLoading={noticesLoading}
        error={noticesError}
      />
    </section>
  );
}

function NoticeList({
  notices,
  isLoading,
  error,
}: {
  notices: NoticeSummary[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <section className="shell-card rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:sticky xl:top-28 xl:self-start">
      <SectionHeader
        eyebrow="Recent Notices"
        title="Published & scheduled notices"
        description="Quickly review the latest school communication records."
      />

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : notices.length > 0 ? (
          notices.slice(0, 8).map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-950">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatEnumLabel(item.audienceType)} /{' '}
                    {resolveNoticeState(item)}
                  </p>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="No notices yet"
            description="Publish your first notice to start building the communication timeline."
          />
        )}
      </div>
    </section>
  );
}

function EventsSection({
  event,
  setEvent,
  classes,
  sections,
  events,
  eventsLoading,
  eventsError,
  submitEvent,
  isPending,
  eventError,
  eventSuccess,
}: {
  event: EventState;
  setEvent: Dispatch<SetStateAction<EventState>>;
  classes: Array<{ id: string; name: string }>;
  sections: SectionSummaryForUi[];
  events: EventSummary[];
  eventsLoading: boolean;
  eventsError: string | null;
  submitEvent: () => void;
  isPending: boolean;
  eventError: string | null;
  eventSuccess: string | null;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
      <div className="shell-card rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
        <SectionHeader
          eyebrow="Event Publisher"
          title="Create school event"
          description="Add calendar-ready events and notify the correct audience."
        />

        <div className="mt-6 space-y-6">
          <FormField
            label="Event Title"
            description="Keep it short and descriptive."
          >
            <Input
              value={event.title}
              onChange={(inputEvent) =>
                setEvent((current) => ({
                  ...current,
                  title: inputEvent.target.value,
                }))
              }
              placeholder="Example: First Terminal Examination 2081"
              className="h-12"
            />
          </FormField>
          <FormField
            label="Description"
            description="Provide full details about the event."
          >
            <textarea
              rows={5}
              value={event.description}
              onChange={(inputEvent) =>
                setEvent((current) => ({
                  ...current,
                  description: inputEvent.target.value,
                }))
              }
              placeholder="Event details, instructions, or preparation notes..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium transition-all focus:border-[var(--color-mod-notices-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--color-mod-notices-border)]/40 min-h-[140px] resize-none"
            />
          </FormField>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label mb-2 block">Starts at</span>
              <input
                type="datetime-local"
                value={event.startsAt}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    startsAt: inputEvent.target.value,
                  }))
                }
                className="min-h-11"
              />
            </label>
            <label>
              <span className="label mb-2 block">Location</span>
              <input
                value={event.location}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    location: inputEvent.target.value,
                  }))
                }
                placeholder="School hall, playground, online, etc."
                className="min-h-11"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Event Type">
              <Select
                value={event.eventType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    eventType: inputEvent.target.value as EventType,
                  }))
                }
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatEnumLabel(type)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Starts At">
              <Input
                type="datetime-local"
                value={event.startsAt}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    startsAt: inputEvent.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Audience">
              <Select
                value={event.audienceType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    audienceType: inputEvent.target.value as AudienceType,
                    sectionId: '',
                  }))
                }
              >
                {audienceTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatEnumLabel(type)}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Class">
              <Select
                value={event.classId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    classId: inputEvent.target.value,
                    sectionId: '',
                  }))
                }
                disabled={event.audienceType === 'ALL'}
              >
                <option value="">Select class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Section">
              <Select
                value={event.sectionId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    sectionId: inputEvent.target.value,
                  }))
                }
                disabled={event.audienceType !== 'SECTION'}
              >
                <option value="">Select section</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <FormField
            label="Location"
            description="Physical room or digital link."
          >
            <Input
              value={event.location}
              onChange={(inputEvent) =>
                setEvent((current) => ({
                  ...current,
                  location: inputEvent.target.value,
                }))
              }
              placeholder="Example: School Auditorium or Zoom Link"
              className="h-12"
            />
          </FormField>

          {eventError ? (
            <InlineMessage tone="error" message={eventError} />
          ) : null}
          {eventSuccess ? (
            <InlineMessage tone="success" message={eventSuccess} />
          ) : null}

          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[var(--color-mod-notices-accent)] px-8 font-black text-xs uppercase tracking-widest text-white transition-all hover:bg-[var(--color-mod-notices-text)] shadow-sm active:scale-95 disabled:opacity-50"
            disabled={isPending}
            onClick={submitEvent}
          >
            {isPending ? 'Creating...' : 'Create event'}
          </button>
        </div>
      </div>

      <EventList
        events={events}
        isLoading={eventsLoading}
        error={eventsError}
      />
    </section>
  );
}

function EventList({
  events,
  isLoading,
  error,
}: {
  events: EventSummary[];
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <section className="shell-card rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm xl:sticky xl:top-28 xl:self-start">
      <SectionHeader
        eyebrow="Events"
        title="Upcoming communication events"
        description="Review school events created from this communication module."
      />

      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : events.length > 0 ? (
          events.slice(0, 8).map((item) => (
            <article
              key={item.id}
              className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-950">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatEnumLabel(item.eventType)} /{' '}
                    {formatEnumLabel(item.audienceType)} /{' '}
                    {formatDateTime(item.startsAt)}
                    {item.location ? ` / ${item.location}` : ''}
                  </p>
                </div>
                <EventTypeBadge type={item.eventType} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="No events yet"
            description="Create your first school event and notify the selected audience."
          />
        )}
      </div>
    </section>
  );
}

function DeliveryRecordsSection({
  deliveries,
  isLoading,
  error,
  filters,
  setFilters,
  channels,
  sourceTypes,
  totalDeliveries,
}: {
  deliveries: NotificationDelivery[];
  isLoading: boolean;
  error: string | null;
  filters: { status: string; channel: string; sourceType: string };
  setFilters: Dispatch<
    SetStateAction<{ status: string; channel: string; sourceType: string }>
  >;
  channels: string[];
  sourceTypes: string[];
  totalDeliveries: number;
}) {
  return (
    <section className="shell-card rounded-2xl border border-[var(--line)] bg-white/90 p-6 shadow-sm backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Delivery Records"
          title="Recent provider-neutral deliveries"
          description="Local and development providers are stubbed/logged; no real external SMS, FCM, or email is sent by the frontend."
        />

        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Showing {deliveries.length} of {totalDeliveries}
        </span>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <select
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              status: event.target.value,
            }))
          }
          className="min-h-11"
        >
          <option value="">All statuses</option>
          {deliveryStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnumLabel(status)}
            </option>
          ))}
        </select>
        <select
          value={filters.channel}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              channel: event.target.value,
            }))
          }
          className="min-h-11"
        >
          <option value="">All channels</option>
          {channels.map((channel) => (
            <option key={channel} value={channel}>
              {formatEnumLabel(channel)}
            </option>
          ))}
        </select>
        <select
          value={filters.sourceType}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              sourceType: event.target.value,
            }))
          }
          className="min-h-11"
        >
          <option value="">All source types</option>
          {sourceTypes.map((sourceType) => (
            <option key={sourceType} value={sourceType}>
              {sourceType}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : deliveries.length > 0 ? (
          deliveries.slice(0, 12).map((delivery) => (
            <article
              key={delivery.id}
              className="rounded-3xl border border-[var(--line)] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-gray-950">{delivery.title}</p>
                <StatusBadge status={delivery.status} />
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--muted)]">
                <p>
                  <span className="font-semibold text-gray-700">
                    {delivery.channel}
                  </span>{' '}
                  / {delivery.destination ?? 'no destination'}
                </p>
                <p className="text-xs">
                  {delivery.sourceType} / {delivery.sourceId}
                </p>
              </div>
            </article>
          ))
        ) : (
          <EmptyState
            title="No delivery records found"
            description="No records match the current filter selection."
          />
        )}
      </div>
    </section>
  );
}

function ConsentManagementSection({
  guardians,
  selectedGuardianId,
  setSelectedGuardianId,
  selectedConsentType,
  setSelectedConsentType,
  statuses,
  statusesLoading,
  captureConsent,
  revokeConsent,
  capturePending,
  revokePending,
  captureError,
  revokeError,
}: {
  guardians: GuardianOption[];
  selectedGuardianId: string;
  setSelectedGuardianId: (value: string) => void;
  selectedConsentType: string;
  setSelectedConsentType: (value: string) => void;
  statuses: GuardianConsentStatus[];
  statusesLoading: boolean;
  captureConsent: () => void;
  revokeConsent: () => void;
  capturePending: boolean;
  revokePending: boolean;
  captureError: string | null;
  revokeError: string | null;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
      <div className="shell-card rounded-2xl border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur-sm">
        <SectionHeader
          eyebrow="Consent Management"
          title="Guardian controls"
          description="Manage and capture legally binding guardian consent for school workflows. Photo usage consent affects Activity Feed visibility."
        />

        <div className="mt-8 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FormField
              label="Select Guardian"
              description="Find guardian by student."
            >
              <Select
                value={selectedGuardianId}
                onChange={(event) => setSelectedGuardianId(event.target.value)}
              >
                {guardians.map((guardian) => (
                  <option key={guardian.id} value={guardian.id}>
                    {guardian.fullName} ({guardian.studentName})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Consent Type" description="Workflow category.">
              <Select
                value={selectedConsentType}
                onChange={(event) => setSelectedConsentType(event.target.value)}
              >
                {consentTypes.map((type) => (
                  <option key={type} value={type}>
                    {formatEnumLabel(type)}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end pt-6 border-t border-slate-100">
            <button
              type="button"
              className="min-h-12 rounded-2xl border-2 border-rose-100 bg-rose-50 px-6 font-black text-xs uppercase tracking-widest text-rose-600 transition-all hover:bg-rose-100 active:scale-95 disabled:opacity-50"
              disabled={revokePending || !selectedGuardianId}
              onClick={revokeConsent}
            >
              {revokePending ? 'Revoking...' : 'Revoke consent'}
            </button>
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-[var(--color-mod-notices-accent)] px-8 font-black text-xs uppercase tracking-widest text-white transition-all hover:bg-[var(--color-mod-notices-text)] shadow-sm active:scale-95 disabled:opacity-50"
              disabled={capturePending || !selectedGuardianId}
              onClick={captureConsent}
            >
              {capturePending ? 'Capturing...' : 'Capture consent'}
            </button>
          </div>

          {captureError || revokeError ? (
            <InlineMessage
              tone="error"
              message={captureError || revokeError || ''}
            />
          ) : null}
        </div>
      </div>

      <div className="shell-card rounded-2xl border border-slate-200 bg-slate-50/50 p-8 shadow-sm xl:sticky xl:top-28 xl:self-start">
        <SectionHeader
          eyebrow="Active Consents"
          title="Guardian status"
          description="Current legal standing for selected guardian."
        />

        <div className="mt-6 space-y-4">
          {statusesLoading ? (
            <LoadingState variant="spinner" label="Fetching status..." />
          ) : statuses.length > 0 ? (
            statuses.map((status: any) => (
              <div
                key={status.consentType}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 transition-all hover:border-[var(--color-mod-notices-border)]"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900">
                    {formatEnumLabel(status.consentType)}
                  </p>
                  <Badge
                    variant={status.granted ? 'success' : 'destructive'}
                    className="font-black uppercase tracking-widest text-[10px]"
                  >
                    {status.granted ? 'Granted' : 'Revoked'}
                  </Badge>
                </div>
                <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Version {status.version ?? 'Version not recorded'}
                  </p>
                  <p className="text-[10px] font-black text-slate-400">
                    {status.capturedAt
                      ? formatDateTime(status.capturedAt)
                      : 'Never captured'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={
                selectedGuardianId ? 'No consent records' : 'Select a guardian'
              }
              description={
                selectedGuardianId
                  ? 'No consent records have been captured for this guardian yet.'
                  : 'Choose a guardian to review consent status.'
              }
            />
          )}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="label">{eyebrow}</p>
      <h2 className="mt-2 text-xl font-bold text-gray-950">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function CommunicationMetric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'info' | 'success' | 'danger';
}) {
  const toneClass = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
    </div>
  );
}

function ScheduleOption({
  title,
  description,
  checked,
  name,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  name: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
        checked
          ? 'border-[var(--color-mod-notices-accent)] bg-white shadow-sm ring-2 ring-[var(--color-mod-notices-border)]/40'
          : 'border-[var(--line)] bg-white/70 hover:bg-white'
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-semibold text-gray-950">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
          {description}
        </span>
      </span>
    </label>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const className =
    priority === 'EMERGENCY'
      ? 'bg-red-50 text-red-700 ring-red-100'
      : priority === 'URGENT'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-emerald-50 text-emerald-700 ring-emerald-100';

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      {formatEnumLabel(priority)}
    </span>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const className =
    type === 'EXAM'
      ? 'bg-indigo-50 text-indigo-700 ring-indigo-100'
      : type === 'HOLIDAY'
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
        : type === 'MEETING'
          ? 'bg-amber-50 text-amber-700 ring-amber-100'
          : 'bg-gray-100 text-gray-700 ring-gray-200';

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      {formatEnumLabel(type)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'SENT'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : status === 'FAILED'
        ? 'bg-red-50 text-red-700 ring-red-100'
        : status === 'SKIPPED'
          ? 'bg-gray-100 text-gray-700 ring-gray-200'
          : status === 'RETRYING'
            ? 'bg-blue-50 text-blue-700 ring-blue-100'
            : 'bg-amber-50 text-amber-700 ring-amber-100';

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function InlineMessage({
  tone,
  message,
}: {
  tone: 'success' | 'error' | 'info';
  message: string;
}) {
  const className = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];

  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${className}`}
    >
      {message}
    </p>
  );
}

// Removed local EmptyState

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-24 animate-pulse rounded-3xl bg-gray-100"
        />
      ))}
    </div>
  );
}

function filterSectionsForClass(
  sections: SectionSummaryForUi[],
  classId: string,
) {
  return sections.filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !classId || sectionClassId === classId;
  });
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function validateAudienceFields(input: {
  title: string;
  body: string;
  audienceType: AudienceType;
  classId: string;
  sectionId: string;
  scheduledFor: string | null;
}) {
  if (!input.title.trim()) {
    return 'Title is required.';
  }

  if (!input.body.trim()) {
    return 'Body is required.';
  }

  if (
    (input.audienceType === 'CLASS' || input.audienceType === 'SECTION') &&
    !input.classId
  ) {
    return 'Class is required for class or section audiences.';
  }

  if (input.audienceType === 'SECTION' && !input.sectionId) {
    return 'Section is required for section audience.';
  }

  if (input.scheduledFor !== null && !input.scheduledFor) {
    return 'Scheduled date and time is required.';
  }

  return null;
}

function resolveNoticeState(notice: NoticeSummary) {
  if (notice.publishedAt) {
    return `Published ${formatDateTime(notice.publishedAt)}`;
  }

  if (notice.scheduledFor) {
    return `Scheduled ${formatDateTime(notice.scheduledFor)}`;
  }

  return 'Draft';
}

function formatEnumLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

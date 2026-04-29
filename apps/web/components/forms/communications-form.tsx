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
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const communicationSections = [
  'Notices',
  'Events',
  'Delivery Records',
  'Consent Management',
] as const;

const noticePriorities = ['NORMAL', 'URGENT', 'EMERGENCY'] as const;
const audienceTypes = ['ALL', 'CLASS', 'SECTION'] as const;
const eventTypes = ['GENERAL', 'EXAM', 'MEETING', 'HOLIDAY'] as const;
const deliveryStatuses = ['QUEUED', 'SENT', 'FAILED', 'SKIPPED', 'PENDING', 'RETRYING'] as const;
const consentTypes = ['PRIVACY', 'DATA_PROCESSING', 'MEDICAL', 'PHOTO_USAGE', 'MESSAGING'] as const;

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

export function CommunicationsForm() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<CommunicationSection>('Notices');
  const [notice, setNotice] = useState<NoticeState>({
    title: '',
    body: '',
    priority: 'NORMAL',
    audienceType: 'ALL',
    classId: '',
    sectionId: '',
    scheduleMode: 'NOW',
    scheduledFor: '',
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
    queryFn: api.listAdmissions,
  });
  const guardianConsentStatusQuery = useQuery({
    queryKey: ['guardian-consent-status', selectedGuardianId],
    queryFn: () => api.getGuardianConsentStatus(selectedGuardianId),
    enabled: Boolean(selectedGuardianId),
  });

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setNotice((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
      setEvent((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
    }
  }, [classesQuery.data]);

  const classes = classesQuery.data ?? [];
  const sections = (sectionsQuery.data ?? []) as SectionSummaryForUi[];
  const guardians = (admissionsQuery.data ?? []).flatMap((admission) =>
    admission.guardians.map((guardian) => ({
      ...guardian,
      studentName: admission.fullNameEn,
      studentSystemId: admission.studentSystemId,
    })),
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
      (!deliveryFilters.channel || delivery.channel === deliveryFilters.channel) &&
      (!deliveryFilters.sourceType || delivery.sourceType === deliveryFilters.sourceType)
    );
  });
  const deliveryChannels = uniqueValues((deliveriesQuery.data ?? []).map((delivery) => delivery.channel));
  const deliverySourceTypes = uniqueValues(
    (deliveriesQuery.data ?? []).map((delivery) => delivery.sourceType),
  );

  const noticeMutation = useMutation({
    mutationFn: api.createNotice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['notices'] });
      setNoticeSuccess(
        notice.scheduleMode === 'LATER'
          ? 'Notice scheduled.'
          : 'Notice published. Delivery records queued.',
      );
      setNoticeError(null);
    },
    onError: (error) => {
      setNoticeError(error.message);
      setNoticeSuccess(null);
    },
  });

  const eventMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
      setEventSuccess('Event created. Delivery records queued where audience rules apply.');
      setEventError(null);
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
      void queryClient.invalidateQueries({ queryKey: ['guardian-consent-status'] });
      void queryClient.invalidateQueries({ queryKey: ['consents'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
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
      void queryClient.invalidateQueries({ queryKey: ['guardian-consent-status'] });
      void queryClient.invalidateQueries({ queryKey: ['consents'] });
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
    },
  });

  function submitNotice() {
    const validationError = validateAudienceFields({
      title: notice.title,
      body: notice.body,
      audienceType: notice.audienceType,
      classId: notice.classId,
      sectionId: notice.sectionId,
      scheduledFor: notice.scheduleMode === 'LATER' ? notice.scheduledFor : null,
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
      sectionId: notice.audienceType === 'SECTION' ? notice.sectionId || null : null,
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
      sectionId: event.audienceType === 'SECTION' ? event.sectionId || null : null,
      startsAt: new Date(event.startsAt).toISOString(),
      location: event.location.trim() || null,
    });
  }

  return (
    <div className="space-y-6">
      <section className="shell-card rounded-[28px] p-4 sm:p-5">
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Communications sections">
          {communicationSections.map((section) => (
            <button
              key={section}
              type="button"
              className={`min-h-11 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition ${
                activeSection === section
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'border border-[var(--line)] bg-white text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
              onClick={() => setActiveSection(section)}
            >
              {section}
            </button>
          ))}
        </div>
      </section>

      {activeSection === 'Notices' ? (
        <NoticesSection
          notice={notice}
          setNotice={setNotice}
          classes={classes}
          sections={noticeSections}
          notices={noticesQuery.data ?? []}
          noticesLoading={noticesQuery.isLoading}
          noticesError={noticesQuery.isError ? noticesQuery.error.message : null}
          submitNotice={submitNotice}
          isPending={noticeMutation.isPending}
          noticeError={noticeError}
          noticeSuccess={noticeSuccess}
        />
      ) : null}

      {activeSection === 'Events' ? (
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
      ) : null}

      {activeSection === 'Delivery Records' ? (
        <DeliveryRecordsSection
          deliveries={filteredDeliveries}
          isLoading={deliveriesQuery.isLoading}
          error={deliveriesQuery.isError ? deliveriesQuery.error.message : null}
          filters={deliveryFilters}
          setFilters={setDeliveryFilters}
          channels={deliveryChannels}
          sourceTypes={deliverySourceTypes}
        />
      ) : null}

      {activeSection === 'Consent Management' ? (
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
          captureError={captureConsentMutation.isError ? captureConsentMutation.error.message : null}
          revokeError={revokeConsentMutation.isError ? revokeConsentMutation.error.message : null}
        />
      ) : null}
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
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label">Notice Composer</p>
        <h2 className="mt-2 text-xl font-bold text-gray-950">Publish school notice</h2>
        <div className="mt-5 grid gap-4">
          <label>
            <span className="label mb-2 block">Title</span>
            <input
              value={notice.title}
              onChange={(event) => setNotice((current) => ({ ...current, title: event.target.value }))}
              placeholder="Notice title"
              className="min-h-11"
            />
          </label>
          <label>
            <span className="label mb-2 block">Body</span>
            <textarea
              rows={5}
              value={notice.body}
              onChange={(event) => setNotice((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write the notice body for guardians, students, or staff."
            />
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="label mb-2 block">Priority</span>
              <select
                value={notice.priority}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    priority: event.target.value as NoticePriority,
                  }))
                }
                className="min-h-11"
              >
                {noticePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {formatEnumLabel(priority)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-2 block">Audience</span>
              <select
                value={notice.audienceType}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    audienceType: event.target.value as AudienceType,
                    sectionId: '',
                  }))
                }
                className="min-h-11"
              >
                {audienceTypes.map((audienceType) => (
                  <option key={audienceType} value={audienceType}>
                    {formatEnumLabel(audienceType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-2 block">Class</span>
              <select
                value={notice.classId}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    classId: event.target.value,
                    sectionId: '',
                  }))
                }
                disabled={notice.audienceType === 'ALL'}
                className="min-h-11"
              >
                <option value="">Select class</option>
                {classes.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {notice.audienceType === 'SECTION' ? (
            <label>
              <span className="label mb-2 block">Section</span>
              <select
                value={notice.sectionId}
                onChange={(event) =>
                  setNotice((current) => ({ ...current, sectionId: event.target.value }))
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

          <fieldset className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
            <legend className="label px-2">Schedule option</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] px-4">
                <input
                  type="radio"
                  name="notice-schedule-mode"
                  checked={notice.scheduleMode === 'NOW'}
                  onChange={() =>
                    setNotice((current) => ({ ...current, scheduleMode: 'NOW', scheduledFor: '' }))
                  }
                />
                Publish now
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] px-4">
                <input
                  type="radio"
                  name="notice-schedule-mode"
                  checked={notice.scheduleMode === 'LATER'}
                  onChange={() => setNotice((current) => ({ ...current, scheduleMode: 'LATER' }))}
                />
                Schedule for later
              </label>
            </div>
            {notice.scheduleMode === 'LATER' ? (
              <input
                type="datetime-local"
                value={notice.scheduledFor}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    scheduledFor: event.target.value,
                  }))
                }
                className="mt-3 min-h-11"
              />
            ) : null}
          </fieldset>

          {notice.priority === 'EMERGENCY' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              Emergency notices may trigger forced delivery channels depending on school settings.
            </div>
          ) : null}
          {noticeError ? <InlineMessage tone="error" message={noticeError} /> : null}
          {noticeSuccess ? <InlineMessage tone="success" message={noticeSuccess} /> : null}

          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
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

      <NoticeList notices={notices} isLoading={noticesLoading} error={noticesError} />
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
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Recent Notices</p>
      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : notices.length > 0 ? (
          notices.slice(0, 8).map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-950">{item.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatEnumLabel(item.audienceType)} / {resolveNoticeState(item)}
                  </p>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="No notices yet" body="No notices yet. Publish your first notice." />
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
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label">Event Publisher</p>
        <div className="mt-5 grid gap-4">
          <label>
            <span className="label mb-2 block">Event title</span>
            <input
              value={event.title}
              onChange={(inputEvent) =>
                setEvent((current) => ({ ...current, title: inputEvent.target.value }))
              }
              placeholder="Event title"
              className="min-h-11"
            />
          </label>
          <label>
            <span className="label mb-2 block">Description</span>
            <textarea
              rows={4}
              value={event.description}
              onChange={(inputEvent) =>
                setEvent((current) => ({ ...current, description: inputEvent.target.value }))
              }
              placeholder="Event description"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label>
              <span className="label mb-2 block">Starts at</span>
              <input
                type="datetime-local"
                value={event.startsAt}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, startsAt: inputEvent.target.value }))
                }
                className="min-h-11"
              />
            </label>
            <label>
              <span className="label mb-2 block">Location</span>
              <input
                value={event.location}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, location: inputEvent.target.value }))
                }
                placeholder="Location"
                className="min-h-11"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="label mb-2 block">Event type</span>
              <select
                value={event.eventType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    eventType: inputEvent.target.value as EventType,
                  }))
                }
                className="min-h-11"
              >
                {eventTypes.map((eventType) => (
                  <option key={eventType} value={eventType}>
                    {formatEnumLabel(eventType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-2 block">Audience</span>
              <select
                value={event.audienceType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    audienceType: inputEvent.target.value as AudienceType,
                    sectionId: '',
                  }))
                }
                className="min-h-11"
              >
                {audienceTypes.map((audienceType) => (
                  <option key={audienceType} value={audienceType}>
                    {formatEnumLabel(audienceType)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label mb-2 block">Class</span>
              <select
                value={event.classId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({
                    ...current,
                    classId: inputEvent.target.value,
                    sectionId: '',
                  }))
                }
                disabled={event.audienceType === 'ALL'}
                className="min-h-11"
              >
                <option value="">Select class</option>
                {classes.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {event.audienceType === 'SECTION' ? (
            <label>
              <span className="label mb-2 block">Section</span>
              <select
                value={event.sectionId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, sectionId: inputEvent.target.value }))
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
          {eventError ? <InlineMessage tone="error" message={eventError} /> : null}
          {eventSuccess ? <InlineMessage tone="success" message={eventSuccess} /> : null}
          <button
            type="button"
            className="min-h-12 rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
            disabled={isPending}
            onClick={submitEvent}
          >
            {isPending ? 'Creating...' : 'Create event'}
          </button>
        </div>
      </div>

      <EventList events={events} isLoading={eventsLoading} error={eventsError} />
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
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Events</p>
      <div className="mt-5 grid gap-3">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : events.length > 0 ? (
          events.slice(0, 8).map((item) => (
            <article key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <p className="font-semibold text-gray-950">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {formatEnumLabel(item.eventType)} / {formatEnumLabel(item.audienceType)} /{' '}
                {formatDateTime(item.startsAt)}
                {item.location ? ` / ${item.location}` : ''}
              </p>
            </article>
          ))
        ) : (
          <EmptyState title="No events yet" body="Create the first school event." />
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
}: {
  deliveries: NotificationDelivery[];
  isLoading: boolean;
  error: string | null;
  filters: { status: string; channel: string; sourceType: string };
  setFilters: Dispatch<SetStateAction<{ status: string; channel: string; sourceType: string }>>;
  channels: string[];
  sourceTypes: string[];
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label">Delivery Records</p>
      <h2 className="mt-2 text-xl font-bold text-gray-950">Recent provider-neutral deliveries</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Local and development providers are stubbed/logged; no real external SMS, FCM, or email is sent by the frontend.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
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
          onChange={(event) => setFilters((current) => ({ ...current, channel: event.target.value }))}
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
            setFilters((current) => ({ ...current, sourceType: event.target.value }))
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

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <InlineMessage tone="error" message={error} />
        ) : deliveries.length > 0 ? (
          deliveries.slice(0, 12).map((delivery) => (
            <article key={delivery.id} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-gray-950">{delivery.title}</p>
                <StatusBadge status={delivery.status} />
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {delivery.channel} / {delivery.destination ?? 'no destination'}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {delivery.sourceType} / {delivery.sourceId}
              </p>
            </article>
          ))
        ) : (
          <EmptyState title="No delivery records yet" body="No delivery records yet." />
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
    <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="shell-card rounded-[28px] p-6">
        <p className="label">Consent Management</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Privacy/data processing consent is mandatory for parent app access. Photo usage consent affects Activity Feed visibility.
        </p>
        <div className="mt-5 grid gap-3">
          <select
            value={selectedGuardianId}
            onChange={(inputEvent) => setSelectedGuardianId(inputEvent.target.value)}
            className="min-h-11"
          >
            <option value="">Select guardian</option>
            {guardians.map((guardian) => (
              <option key={`${guardian.id}-${guardian.studentSystemId}`} value={guardian.id}>
                {guardian.fullName} / {guardian.studentName}
              </option>
            ))}
          </select>
          <select
            value={selectedConsentType}
            onChange={(inputEvent) => setSelectedConsentType(inputEvent.target.value)}
            className="min-h-11"
          >
            {consentTypes.map((consentType) => (
              <option key={consentType} value={consentType}>
                {formatEnumLabel(consentType)}
              </option>
            ))}
          </select>
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!selectedGuardianId || capturePending}
              onClick={captureConsent}
            >
              Capture consent
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={!selectedGuardianId || revokePending}
              onClick={revokeConsent}
            >
              Revoke consent
            </button>
          </div>
          {captureError ? <InlineMessage tone="error" message={captureError} /> : null}
          {revokeError ? <InlineMessage tone="error" message={revokeError} /> : null}
          {guardians.length === 0 ? (
            <EmptyState
              title="No guardians yet"
              body="Admit a student with guardian details first."
            />
          ) : null}
        </div>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label">Consent Status</p>
        <div className="mt-5 grid gap-3">
          {statusesLoading ? (
            <SkeletonList />
          ) : statuses.length > 0 ? (
            statuses.map((status) => (
              <article
                key={status.consentType}
                className="rounded-2xl border border-[var(--line)] bg-white/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-gray-950">{formatEnumLabel(status.consentType)}</p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      status.granted
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {status.granted ? 'Granted' : 'Not granted'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Version: {status.version ?? 'no version'}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {status.capturedAt ? `Captured ${formatDateTime(status.capturedAt)}` : 'Not captured'}
                  {status.revokedAt ? ` / Revoked ${formatDateTime(status.revokedAt)}` : ''}
                </p>
              </article>
            ))
          ) : selectedGuardianId ? (
            <EmptyState title="No consent records" body="No consent records yet." />
          ) : (
            <EmptyState
              title="Select a guardian"
              body="Admit a student with guardian details first."
            />
          )}
        </div>
      </section>
    </section>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const className =
    priority === 'EMERGENCY'
      ? 'bg-red-50 text-red-700'
      : priority === 'URGENT'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-emerald-50 text-emerald-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {formatEnumLabel(priority)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === 'SENT'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'FAILED'
        ? 'bg-red-50 text-red-700'
        : status === 'SKIPPED'
          ? 'bg-gray-100 text-gray-700'
          : status === 'RETRYING'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {formatEnumLabel(status)}
    </span>
  );
}

function InlineMessage({ tone, message }: { tone: 'success' | 'error'; message: string }) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-red-200 bg-red-50 text-red-700'
      }`}
    >
      {message}
    </p>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 p-5 text-sm">
      <p className="font-semibold text-gray-950">{title}</p>
      <p className="mt-1 text-[var(--muted)]">{body}</p>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}

function filterSectionsForClass(sections: SectionSummaryForUi[], classId: string) {
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

  if ((input.audienceType === 'CLASS' || input.audienceType === 'SECTION') && !input.classId) {
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

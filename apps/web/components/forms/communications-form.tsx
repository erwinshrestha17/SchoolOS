'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function CommunicationsForm() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState({
    title: 'Emergency holiday notice',
    body: 'School will remain closed tomorrow due to weather conditions.',
    priority: 'EMERGENCY',
    audienceType: 'ALL',
    classId: '',
    sectionId: '',
    scheduledFor: '',
  });
  const [event, setEvent] = useState({
    title: 'Parent-teacher meeting',
    description: 'Monthly guardian conversation for the selected group.',
    eventType: 'MEETING',
    audienceType: 'ALL',
    classId: '',
    sectionId: '',
    startsAt: new Date().toISOString().slice(0, 16),
    location: 'Main hall',
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

  const noticeSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !notice.classId || sectionClassId === notice.classId;
  });
  const eventSections = (sectionsQuery.data ?? []).filter((section) => {
    const sectionClassId = section.classId ?? section.class?.id;
    return !event.classId || sectionClassId === event.classId;
  });

  const noticeMutation = useMutation({
    mutationFn: api.createNotice,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['notices'] });
    },
  });

  const eventMutation = useMutation({
    mutationFn: api.createEvent,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notification-deliveries'] });
      void queryClient.invalidateQueries({ queryKey: ['events'] });
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

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Notice Composer</p>
          <div className="grid gap-3">
            <input
              value={notice.title}
              onChange={(event) => setNotice((current) => ({ ...current, title: event.target.value }))}
            />
            <textarea
              rows={5}
              value={notice.body}
              onChange={(event) => setNotice((current) => ({ ...current, body: event.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={notice.priority}
                onChange={(event) => setNotice((current) => ({ ...current, priority: event.target.value }))}
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
              <select
                value={notice.audienceType}
                onChange={(event) =>
                  setNotice((current) => ({ ...current, audienceType: event.target.value }))
                }
              >
                <option value="ALL">All school</option>
                <option value="CLASS">Class</option>
                <option value="SECTION">Section</option>
              </select>
              <select
                value={notice.classId}
                onChange={(event) =>
                  setNotice((current) => ({ ...current, classId: event.target.value, sectionId: '' }))
                }
                disabled={notice.audienceType === 'ALL'}
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>
            {notice.audienceType === 'SECTION' ? (
              <select
                value={notice.sectionId}
                onChange={(event) =>
                  setNotice((current) => ({ ...current, sectionId: event.target.value }))
                }
              >
                <option value="">Section</option>
                {noticeSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="grid gap-2 text-sm text-[var(--muted)]">
              Schedule for later
              <input
                type="datetime-local"
                value={notice.scheduledFor}
                onChange={(event) =>
                  setNotice((current) => ({
                    ...current,
                    scheduledFor: event.target.value,
                  }))
                }
              />
            </label>
            <button
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white"
              onClick={() =>
                noticeMutation.mutate({
                  title: notice.title,
                  body: notice.body,
                  priority: notice.priority,
                  audienceType: notice.audienceType,
                  classId: notice.audienceType === 'ALL' ? null : notice.classId || null,
                  sectionId: notice.audienceType === 'SECTION' ? notice.sectionId || null : null,
                  scheduledFor: notice.scheduledFor
                    ? new Date(notice.scheduledFor).toISOString()
                    : null,
                })
              }
            >
              {noticeMutation.isPending
                ? 'Publishing...'
                : notice.scheduledFor
                  ? 'Schedule notice'
                  : 'Publish notice'}
            </button>
          </div>
        </div>

        <div className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Event Publisher</p>
          <div className="grid gap-3">
            <input
              value={event.title}
              onChange={(inputEvent) =>
                setEvent((current) => ({ ...current, title: inputEvent.target.value }))
              }
            />
            <textarea
              rows={4}
              value={event.description}
              onChange={(inputEvent) =>
                setEvent((current) => ({ ...current, description: inputEvent.target.value }))
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              <input
                type="datetime-local"
                value={event.startsAt}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, startsAt: inputEvent.target.value }))
                }
              />
              <input
                value={event.location}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, location: inputEvent.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={event.eventType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, eventType: inputEvent.target.value }))
                }
              >
                <option value="GENERAL">General</option>
                <option value="EXAM">Exam</option>
                <option value="MEETING">Meeting</option>
                <option value="HOLIDAY">Holiday</option>
              </select>
              <select
                value={event.audienceType}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, audienceType: inputEvent.target.value }))
                }
              >
                <option value="ALL">All school</option>
                <option value="CLASS">Class</option>
                <option value="SECTION">Section</option>
              </select>
              <select
                value={event.classId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, classId: inputEvent.target.value, sectionId: '' }))
                }
                disabled={event.audienceType === 'ALL'}
              >
                <option value="">Class</option>
                {(classesQuery.data ?? []).map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </div>
            {event.audienceType === 'SECTION' ? (
              <select
                value={event.sectionId}
                onChange={(inputEvent) =>
                  setEvent((current) => ({ ...current, sectionId: inputEvent.target.value }))
                }
              >
                <option value="">Section</option>
                {eventSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white"
              onClick={() =>
                eventMutation.mutate({
                  title: event.title,
                  description: event.description,
                  eventType: event.eventType,
                  audienceType: event.audienceType,
                  classId: event.audienceType === 'ALL' ? null : event.classId || null,
                  sectionId: event.audienceType === 'SECTION' ? event.sectionId || null : null,
                  startsAt: new Date(event.startsAt).toISOString(),
                  location: event.location,
                })
              }
            >
              {eventMutation.isPending ? 'Creating...' : 'Create event'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Notices</p>
          <div className="grid gap-3">
            {(noticesQuery.data ?? []).slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {item.priority} / {item.audienceType} /{' '}
                  {item.publishedAt
                    ? `published ${new Date(item.publishedAt).toLocaleString()}`
                    : item.scheduledFor
                      ? `scheduled ${new Date(item.scheduledFor).toLocaleString()}`
                      : 'draft'}
                </p>
              </div>
            ))}
            {noticesQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No notices yet.</p>
            ) : null}
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Events</p>
          <div className="grid gap-3">
            {(eventsQuery.data ?? []).slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-[var(--muted)]">
                  {item.eventType} / {item.audienceType} /{' '}
                  {new Date(item.startsAt).toLocaleString()}
                  {item.location ? ` / ${item.location}` : ''}
                </p>
              </div>
            ))}
            {eventsQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No events yet.</p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Recent Delivery Records</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(deliveriesQuery.data ?? []).slice(0, 6).map((delivery) => (
            <div key={delivery.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{delivery.title}</p>
              <p className="text-sm text-[var(--muted)]">
                {delivery.channel} / {delivery.status} / {delivery.destination ?? 'no destination'}
              </p>
            </div>
          ))}
          {deliveriesQuery.data?.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No delivery records yet.</p>
          ) : null}
        </div>
      </section>

      <section className="shell-card rounded-[28px] p-6">
        <p className="label mb-4">Guardian Consent Status</p>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3">
            <select
              value={selectedGuardianId}
              onChange={(inputEvent) => setSelectedGuardianId(inputEvent.target.value)}
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
            >
              <option value="PRIVACY">Privacy</option>
              <option value="DATA_PROCESSING">Data processing</option>
              <option value="MEDICAL">Medical</option>
              <option value="PHOTO_USAGE">Photo usage</option>
              <option value="MESSAGING">Messaging</option>
            </select>
            <div className="grid gap-2 md:grid-cols-2">
              <button
                type="button"
                className="rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                disabled={!selectedGuardianId || captureConsentMutation.isPending}
                onClick={() => captureConsentMutation.mutate()}
              >
                Capture consent
              </button>
              <button
                type="button"
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={!selectedGuardianId || revokeConsentMutation.isPending}
                onClick={() => revokeConsentMutation.mutate()}
              >
                Revoke consent
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {(guardianConsentStatusQuery.data ?? []).map((status) => (
              <div
                key={status.consentType}
                className="rounded-2xl border border-[var(--line)] bg-white/55 p-4"
              >
                <p className="font-semibold">
                  {status.consentType} / {status.granted ? 'granted' : 'not granted'}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {status.version ?? 'no version'}
                  {status.capturedAt
                    ? ` / captured ${new Date(status.capturedAt).toLocaleString()}`
                    : ''}
                  {status.revokedAt
                    ? ` / revoked ${new Date(status.revokedAt).toLocaleString()}`
                    : ''}
                </p>
              </div>
            ))}
            {selectedGuardianId && guardianConsentStatusQuery.data?.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No consent records yet.</p>
            ) : null}
            {!selectedGuardianId ? (
              <p className="text-sm text-[var(--muted)]">
                Admit a student with guardian details first, then consent controls will appear here.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {[
        noticeMutation,
        eventMutation,
        captureConsentMutation,
        revokeConsentMutation,
      ].map((mutationState, index) =>
        mutationState.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutationState.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

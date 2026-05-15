'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

export function MessagingForm() {
  const queryClient = useQueryClient();
  const [conversation, setConversation] = useState({
    type: 'DIRECT',
    title: 'Parent check-in',
    classId: '',
    sectionId: '',
    studentId: '',
    guardianId: '',
  });
  const [message, setMessage] = useState({
    conversationId: '',
    body: 'Namaste, sharing a quick update from school today.',
  });
  const [readReceipt, setReadReceipt] = useState({
    messageId: '',
    guardianId: '',
  });

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: api.listClasses });
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: api.listSections });
  const admissionsQuery = useQuery({
    queryKey: ['admissions'],
    queryFn: () => api.listAdmissions(),
  });
  const conversationsQuery = useQuery({
    queryKey: ['conversations'],
    queryFn: api.listConversations,
  });
  const messagesQuery = useQuery({
    queryKey: ['messages'],
    queryFn: api.listMessages,
  });
  const receiptsQuery = useQuery({
    queryKey: ['message-read-receipts'],
    queryFn: api.listMessageReadReceipts,
  });
  const deliveriesQuery = useQuery({
    queryKey: ['deliveries'],
    queryFn: api.listNotificationDeliveries,
  });

  const guardianOptions = (admissionsQuery.data?.items ?? []).flatMap((admission) =>
    admission.guardians.map((guardian) => ({
      guardianId: guardian.id,
      studentId: admission.id,
      label: `${guardian.fullName} / ${admission.fullNameEn}`,
    })),
  );

  useEffect(() => {
    const firstClass = classesQuery.data?.[0];

    if (firstClass) {
      setConversation((current) => (current.classId ? current : { ...current, classId: firstClass.id }));
    }
  }, [classesQuery.data]);

  useEffect(() => {
    const firstGuardian = guardianOptions[0];

    if (firstGuardian) {
      setConversation((current) =>
        current.guardianId
          ? current
          : {
              ...current,
              guardianId: firstGuardian.guardianId,
              studentId: firstGuardian.studentId,
            },
      );
      setReadReceipt((current) =>
        current.guardianId ? current : { ...current, guardianId: firstGuardian.guardianId },
      );
    }
  }, [guardianOptions]);

  useEffect(() => {
    const firstConversation = conversationsQuery.data?.[0];

    if (firstConversation) {
      setMessage((current) =>
        current.conversationId ? current : { ...current, conversationId: firstConversation.id },
      );
    }
  }, [conversationsQuery.data]);

  useEffect(() => {
    const firstMessage = messagesQuery.data?.[0];

    if (firstMessage) {
      setReadReceipt((current) =>
        current.messageId ? current : { ...current, messageId: firstMessage.id },
      );
    }
  }, [messagesQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['messages'] });
    void queryClient.invalidateQueries({ queryKey: ['message-read-receipts'] });
    void queryClient.invalidateQueries({ queryKey: ['deliveries'] });
  };
  const conversationMutation = useMutation({
    mutationFn: api.createConversation,
    onSuccess: invalidate,
  });
  const messageMutation = useMutation({
    mutationFn: api.createMessage,
    onSuccess: invalidate,
  });
  const readMutation = useMutation({
    mutationFn: api.markMessageRead,
    onSuccess: invalidate,
  });

  const sectionsForClass = (sectionsQuery.data ?? []).filter(
    (item) => item.classId === conversation.classId,
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Conversation</p>
          <div className="grid gap-3">
            <select
              value={conversation.type}
              onChange={(event) =>
                setConversation((current) => ({ ...current, type: event.target.value }))
              }
            >
              <option value="DIRECT">Direct guardian</option>
              <option value="CLASS">Class broadcast</option>
              <option value="SECTION">Section broadcast</option>
            </select>
            <input
              value={conversation.title}
              onChange={(event) =>
                setConversation((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Title"
            />
            {conversation.type === 'DIRECT' ? (
              <select
                value={conversation.guardianId}
                onChange={(event) => {
                  const selected = guardianOptions.find((item) => item.guardianId === event.target.value);
                  setConversation((current) => ({
                    ...current,
                    guardianId: event.target.value,
                    studentId: selected?.studentId ?? current.studentId,
                  }));
                }}
              >
                <option value="">Guardian</option>
                {guardianOptions.map((item) => (
                  <option key={`${item.guardianId}-${item.studentId}`} value={item.guardianId}>
                    {item.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  value={conversation.classId}
                  onChange={(event) =>
                    setConversation((current) => ({ ...current, classId: event.target.value }))
                  }
                >
                  <option value="">Class</option>
                  {(classesQuery.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {conversation.type === 'SECTION' ? (
                  <select
                    value={conversation.sectionId}
                    onChange={(event) =>
                      setConversation((current) => ({ ...current, sectionId: event.target.value }))
                    }
                  >
                    <option value="">Section</option>
                    {sectionsForClass.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                ) : null}
              </>
            )}
            <button
              type="button"
              className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={
                !conversation.title ||
                (conversation.type === 'DIRECT' && !conversation.guardianId) ||
                (conversation.type !== 'DIRECT' && !conversation.classId) ||
                conversationMutation.isPending
              }
              onClick={() =>
                conversationMutation.mutate({
                  type: conversation.type,
                  title: conversation.title,
                  classId: conversation.type === 'DIRECT' ? null : conversation.classId,
                  sectionId: conversation.type === 'SECTION' ? conversation.sectionId : null,
                  studentId: conversation.type === 'DIRECT' ? conversation.studentId : null,
                  guardianId: conversation.type === 'DIRECT' ? conversation.guardianId : null,
                })
              }
            >
              {conversationMutation.isPending ? 'Creating...' : 'Create conversation'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Message</p>
          <div className="grid gap-3">
            <select
              value={message.conversationId}
              onChange={(event) => setMessage((current) => ({ ...current, conversationId: event.target.value }))}
            >
              <option value="">Conversation</option>
              {(conversationsQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title ?? item.type}
                </option>
              ))}
            </select>
            <textarea
              rows={5}
              value={message.body}
              onChange={(event) => setMessage((current) => ({ ...current, body: event.target.value }))}
            />
            <button
              type="button"
              className="rounded-2xl bg-[var(--teal)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!message.conversationId || !message.body || messageMutation.isPending}
              onClick={() => messageMutation.mutate(message)}
            >
              {messageMutation.isPending ? 'Sending...' : 'Send message'}
            </button>
          </div>
        </section>

        <section className="shell-card rounded-[28px] p-6">
          <p className="label mb-4">Read Receipt</p>
          <div className="grid gap-3">
            <select
              value={readReceipt.messageId}
              onChange={(event) =>
                setReadReceipt((current) => ({ ...current, messageId: event.target.value }))
              }
            >
              <option value="">Message</option>
              {(messagesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.body.slice(0, 36)}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-semibold text-white disabled:opacity-50"
              disabled={!readReceipt.messageId || readMutation.isPending}
              onClick={() => readMutation.mutate(readReceipt)}
            >
              {readMutation.isPending ? 'Marking...' : 'Mark as read'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SummaryList
          title="Conversations"
          items={(conversationsQuery.data ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            primary: item.title ?? item.type,
            secondary: `${item.type} / ${item.messages?.length ?? 0} recent messages`,
          }))}
        />
        <SummaryList
          title="Messages"
          items={(messagesQuery.data ?? []).slice(0, 6).map((item) => ({
            id: item.id,
            primary: item.status,
            secondary: item.body,
          }))}
        />
        <SummaryList
          title="Delivery Records"
          items={(deliveriesQuery.data ?? [])
            .filter((item) => item.sourceType === 'message')
            .slice(0, 6)
            .map((item) => ({
              id: item.id,
              primary: `${item.channel} / ${item.status}`,
              secondary: item.destination ?? item.title,
            }))}
        />
      </div>

      <SummaryList
        title="Read Receipts"
        items={(receiptsQuery.data ?? []).slice(0, 6).map((item) => ({
          id: item.id,
          primary: item.guardianId ?? item.readerUserId ?? 'Reader',
          secondary: new Date(item.readAt).toLocaleString(),
        }))}
      />

      {[conversationMutation, messageMutation, readMutation].map((mutation, index) =>
        mutation.isError ? (
          <p key={index} className="text-sm text-[var(--accent-dark)]">
            {mutation.error.message}
          </p>
        ) : null,
      )}
    </div>
  );
}

function SummaryList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; primary: string; secondary: string }>;
}) {
  return (
    <section className="shell-card rounded-[28px] p-6">
      <p className="label mb-4">{title}</p>
      <div className="grid gap-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-white/55 p-4">
              <p className="font-semibold">{item.primary}</p>
              <p className="text-sm text-[var(--muted)]">{item.secondary}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">No records yet.</p>
        )}
      </div>
    </section>
  );
}

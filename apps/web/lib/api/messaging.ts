import type {
  ChatAvailabilityRuleSummary,
  ChatAvailabilityStatus,
  ConversationSummary,
  MessageReadReceiptSummary,
  MessageSummary,
  PaginatedResult,
  ParentTeacherMessageSummary,
  ParentTeacherThreadCreateResult,
  ParentTeacherThreadSummary,
  SendParentTeacherMessageResult,
} from '@schoolos/core';
import {
  JsonBody,
  request,
  withQuery,
} from './client';

export const messagingApi = {
  listConversations: () =>
    request<ConversationSummary[]>('/messaging/conversations'),
  createConversation: (body: JsonBody) =>
    request<ConversationSummary>('/messaging/conversations', {
      method: 'POST',
      json: body,
    }),
  listMessages: () => request<MessageSummary[]>('/messaging/messages'),
  createMessage: (body: JsonBody) =>
    request<MessageSummary>('/messaging/messages', {
      method: 'POST',
      json: body,
    }),
  listMessageReadReceipts: () =>
    request<MessageReadReceiptSummary[]>('/messaging/read-receipts'),
  markMessageRead: (body: JsonBody) =>
    request<MessageReadReceiptSummary>('/messaging/read-receipts', {
      method: 'POST',
      json: body,
    }),
  listParentTeacherThreads: (params?: {
    status?: string;
    studentId?: string;
    guardianId?: string;
    classTeacherId?: string;
    search?: string;
    page?: string;
    limit?: string;
  }) =>
    request<PaginatedResult<ParentTeacherThreadSummary>>(
      withQuery('/messaging/parent-teacher/threads', params ?? {}),
    ),
  getParentTeacherThread: (threadId: string) =>
    request<ParentTeacherThreadSummary>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}`,
    ),
  createParentTeacherThread: (body: JsonBody) =>
    request<ParentTeacherThreadCreateResult>(
      '/messaging/parent-teacher/threads',
      {
        method: 'POST',
        json: body,
      },
    ),
  closeParentTeacherThread: (threadId: string, body: JsonBody) =>
    request<ParentTeacherThreadSummary>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/close`,
      { method: 'PATCH', json: body },
    ),
  escalateParentTeacherThread: (threadId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/escalate`,
      { method: 'PATCH', json: body },
    ),
  listParentTeacherMessages: (
    threadId: string,
    params?: { page?: string; limit?: string },
  ) =>
    request<PaginatedResult<ParentTeacherMessageSummary>>(
      withQuery(
        `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/messages`,
        params ?? {},
      ),
    ),
  sendParentTeacherMessage: (threadId: string, body: JsonBody) =>
    request<SendParentTeacherMessageResult>(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/messages`,
      { method: 'POST', json: body },
    ),
  markParentTeacherThreadRead: (threadId: string) =>
    request(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/read`,
      {
        method: 'PATCH',
        json: {},
      },
    ),
  markParentTeacherMessageRead: (messageId: string) =>
    request<ParentTeacherMessageSummary>(
      `/messaging/parent-teacher/messages/${encodeURIComponent(messageId)}/read`,
      { method: 'PATCH', json: {} },
    ),
  listChatAvailability: () =>
    request<ChatAvailabilityRuleSummary[]>(
      '/messaging/parent-teacher/availability',
    ),
  updateChatAvailability: (body: JsonBody) =>
    request<ChatAvailabilityRuleSummary[]>(
      '/messaging/parent-teacher/availability',
      {
        method: 'PUT',
        json: body,
      },
    ),
  getChatAvailabilityStatus: () =>
    request<ChatAvailabilityStatus>(
      '/messaging/parent-teacher/availability/status',
    ),
  createChatAbuseReport: (threadId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/threads/${encodeURIComponent(threadId)}/abuse-report`,
      { method: 'POST', json: body },
    ),
  listChatAbuseReports: () =>
    request('/messaging/parent-teacher/abuse-reports'),
  reviewChatAbuseReport: (reportId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/abuse-reports/${encodeURIComponent(reportId)}/review`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  resolveChatEscalation: (escalationId: string, body: JsonBody) =>
    request(
      `/messaging/parent-teacher/escalations/${encodeURIComponent(escalationId)}/resolve`,
      { method: 'PATCH', json: body },
    ),
};

import type {
  ActivityGalleryItem,
  ActivityPost,
  ActivityReaction,
  DevelopmentalMilestone,
  MoodLog,
} from '@schoolos/core';
import {
  API_BASE_URL,
  JsonBody,
  parseApiErrorMessage,
  request,
  withQuery,
} from './client';

export const activityApi = {
  listActivityPosts: () => request<ActivityPost[]>('/activity-feed/posts'),
  listActivityGallery: (params?: {
    studentId?: string | null;
    classId?: string | null;
    sectionId?: string | null;
    category?: string | null;
    limit?: number | null;
    offset?: number | null;
  }) =>
    request<ActivityGalleryItem[]>(
      withQuery('/activity-feed/gallery', params ?? {}),
    ),
  listParentActivityPosts: (params?: {
    studentId?: string | null;
    category?: string | null;
    month?: string | null;
  }) =>
    request<ActivityPost[]>(withQuery('/activity-feed/parent', params ?? {})),
  getActivityPost: (postId: string) =>
    request<ActivityPost>(`/activity-feed/posts/${encodeURIComponent(postId)}`),
  updateActivityPost: (postId: string, body: JsonBody) =>
    request<ActivityPost>(
      `/activity-feed/posts/${encodeURIComponent(postId)}`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  deleteActivityPost: (postId: string, body: JsonBody) =>
    request<ActivityPost>(
      `/activity-feed/posts/${encodeURIComponent(postId)}`,
      {
        method: 'DELETE',
        json: body,
      },
    ),
  restoreActivityPost: (postId: string) =>
    request<ActivityPost>(
      `/activity-feed/posts/${encodeURIComponent(postId)}/restore`,
      {
        method: 'PATCH',
      },
    ),
  moderateActivityPost: (postId: string, body: JsonBody) =>
    request<ActivityPost>(
      `/activity-feed/posts/${encodeURIComponent(postId)}/moderation`,
      {
        method: 'PATCH',
        json: body,
      },
    ),
  previewActivityAttachment: async (attachmentId: string) => {
    const response = await fetch(
      `${API_BASE_URL}/activity-feed/attachments/${encodeURIComponent(attachmentId)}/preview`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        parseApiErrorMessage(text) ||
          `Preview failed with status ${response.status}`,
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000); // Cleanup after a minute
  },
  downloadActivityAttachment: async (
    attachmentId: string,
    fileName: string,
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/activity-feed/attachments/${encodeURIComponent(attachmentId)}/download`,
      { credentials: 'include' },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        parseApiErrorMessage(text) ||
          `Download failed with status ${response.status}`,
      );
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  createActivityPost: (body: JsonBody) =>
    request('/activity-feed/posts', { method: 'POST', json: body }),
  createActivityReaction: (postId: string, body: JsonBody) =>
    request<ActivityReaction>(
      `/activity-feed/posts/${encodeURIComponent(postId)}/reactions`,
      { method: 'POST', json: body },
    ),
  listMoodLogs: () => request<MoodLog[]>('/activity-feed/mood-logs'),
  createMoodLog: (body: JsonBody) =>
    request('/activity-feed/mood-logs', { method: 'POST', json: body }),
  listDevelopmentalMilestones: (params?: {
    studentId?: string | null;
    month?: string | null;
  }) =>
    request<DevelopmentalMilestone[]>(
      withQuery('/activity-feed/milestones', params ?? {}),
    ),
  createDevelopmentalMilestone: (body: JsonBody) =>
    request<DevelopmentalMilestone>('/activity-feed/milestones', {
      method: 'POST',
      json: body,
    }),
};

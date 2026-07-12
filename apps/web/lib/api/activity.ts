import type {
  ActivityGalleryItem,
  ActivityPost,
  ActivityReaction,
  ActivityReactionAnalytics,
  DevelopmentalMilestone,
  MoodLog,
} from '@schoolos/core';
import {
  API_BASE_URL,
  downloadBlob,
  JsonBody,
  openImageBlob,
  request,
  withQuery,
} from './client';

export type PhotoConsentStatus =
  | 'ALLOWED'
  | 'NOT_ALLOWED'
  | 'RESTRICTED'
  | 'NOT_RECORDED';

export type ActivityAudiencePreview = {
  audienceType: 'CLASS' | 'SECTION' | 'STUDENT';
  classId: string;
  sectionId: string | null;
  studentCount: number;
  mediaConsent: {
    grantedStudentCount: number;
    blockedStudentCount: number;
    allowedCount: number;
    notAllowedCount: number;
    restrictedCount: number;
    notRecordedCount: number;
  };
  students: Array<{
    id: string;
    fullName: string;
    mediaConsentGranted: boolean;
    mediaConsentStatus: PhotoConsentStatus;
  }>;
};

export const activityApi = {
  listActivityPosts: (params?: {
    studentId?: string | null;
    classId?: string | null;
    sectionId?: string | null;
    category?: string | null;
    month?: string | null;
    status?: string | null;
    limit?: number | null;
    offset?: number | null;
  }) =>
    request<ActivityPost[]>(
      withQuery('/activity-feed/posts', params ?? {}),
    ),
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
  previewActivityAudience: (params: {
    classId: string;
    sectionId?: string | null;
    studentIds?: string[];
  }) =>
    request<ActivityAudiencePreview>(
      withQuery('/activity-feed/audience-preview', {
        classId: params.classId,
        sectionId: params.sectionId,
        studentIds: params.studentIds?.join(','),
      }),
    ),
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
    await openImageBlob(response);
  },
  downloadActivityAttachment: async (
    attachmentId: string,
    fileName: string,
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/activity-feed/attachments/${encodeURIComponent(attachmentId)}/download`,
      { credentials: 'include' },
    );
    await downloadBlob(response, fileName);
  },
  createActivityPost: (body: JsonBody) =>
    request<ActivityPost>('/activity-feed/posts', {
      method: 'POST',
      json: body,
    }),
  createActivityReaction: (postId: string, body: JsonBody) =>
    request<ActivityReaction>(
      `/activity-feed/posts/${encodeURIComponent(postId)}/reactions`,
      { method: 'POST', json: body },
    ),
  getReactionAnalytics: () =>
    request<ActivityReactionAnalytics>('/activity-feed/reactions/analytics'),
  listMoodLogs: () => request<MoodLog[]>('/activity-feed/mood-logs'),
  createMoodLog: (body: JsonBody) =>
    request<MoodLog>('/activity-feed/mood-logs', {
      method: 'POST',
      json: body,
    }),
  listDevelopmentalMilestones: (params?: {
    studentId?: string | null;
    month?: string | null;
  }) =>
    request<DevelopmentalMilestone[]>(
      withQuery('/activity-feed/milestones', params ?? {}),
    ),
  listMilestoneTemplates: (params?: {
    stage?: string | null;
    domain?: string | null;
  }) =>
    request<
      Array<{
        key: string;
        stage: string;
        domain: string;
        milestone: string;
        suggestedStatus: string;
        observationPrompt: string;
      }>
    >(withQuery('/activity-feed/milestone-templates', params ?? {})),
  createDevelopmentalMilestone: (body: JsonBody) =>
    request<DevelopmentalMilestone>('/activity-feed/milestones', {
      method: 'POST',
      json: body,
    }),
};

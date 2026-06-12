import { JsonBody, request, withQuery } from './client';

export type LearningActivityType =
  | 'PRACTICE'
  | 'QUIZ'
  | 'EXPLANATION'
  | 'REVISION'
  | 'OBSERVATION';
export type LearningDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type LearningMode =
  | 'SMART_BOARD'
  | 'GROUP'
  | 'COMPUTER_LAB'
  | 'WORKSHEET'
  | 'HYBRID';
export type LearningAccessType = 'SCHOOL_ONLY' | 'CLASS_ONLY';
export type LearningLanguageMode = 'ENGLISH' | 'NEPALI' | 'MIXED';
export type LearningActivityStatus =
  | 'DRAFT'
  | 'READY'
  | 'ARCHIVED';
export type LearningSessionStatus = 'LIVE' | 'PAUSED' | 'ENDED' | 'EXPIRED';
export type LearningAttemptStatus = 'IN_PROGRESS' | 'SUBMITTED';
export type LearningQuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING'
  | 'ORDERING';
export type LearningProgressLabel =
  | 'NEEDS_PRACTICE'
  | 'IMPROVING'
  | 'READY'
  | 'STRONG';
export type LearningResourceType = 'FILE' | 'LINK' | 'NOTE';
export type LearningResourceStatus = 'ACTIVE' | 'ARCHIVED';

export type LearningLookup = {
  id: string;
  name?: string | null;
  code?: string | null;
};

export type LearningTeacherLookup = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
};

export type LearningQuestion = {
  id?: string;
  type: LearningQuestionType;
  prompt: string;
  options?: unknown;
  correctAnswer?: unknown;
  explanation?: string | null;
  points?: number;
  sortOrder?: number;
  metadata?: unknown;
};

export type LearningMatchingOptions = {
  pairs: Array<{
    leftId: string;
    leftText: string;
    rightId: string;
    rightText: string;
  }>;
};

export type LearningOrderingOptions = {
  items: Array<{ id: string; text: string }>;
};

export type LearningActivity = {
  id: string;
  title: string;
  description?: string | null;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  chapterId?: string | null;
  topicId?: string | null;
  teacherId: string;
  activityType: LearningActivityType;
  difficulty: LearningDifficulty;
  mode: LearningMode;
  accessType: LearningAccessType;
  languageMode: LearningLanguageMode;
  estimatedMinutes?: number | null;
  status: LearningActivityStatus;
  createdAt?: string;
  updatedAt?: string;
  class?: LearningLookup | null;
  section?: LearningLookup | null;
  subject?: LearningLookup | null;
  teacher?: LearningTeacherLookup | null;
  questions?: LearningQuestion[];
  resources?: unknown[];
  _count?: {
    questions?: number;
    sessions?: number;
  };
};

export type LearningActivityListResponse = {
  items: LearningActivity[];
  total: number;
  page: number;
  limit: number;
};

export type LearningActivityFilters = {
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  difficulty?: LearningDifficulty | null;
  mode?: LearningMode | null;
  status?: LearningActivityStatus | null;
  page?: number;
  limit?: number;
};

export type LearningActivityPayload = {
  title: string;
  description?: string;
  classId: string;
  sectionId?: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  teacherId?: string;
  activityType: LearningActivityType;
  difficulty: LearningDifficulty;
  mode: LearningMode;
  accessType?: LearningAccessType;
  languageMode?: LearningLanguageMode;
  estimatedMinutes?: number;
  status?: LearningActivityStatus;
  questions?: LearningQuestion[];
};

export type LearningSession = {
  id: string;
  activityId: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  teacherId?: string;
  mode: LearningMode;
  sessionCode?: string;
  status: LearningSessionStatus;
  schoolOnly: boolean;
  startedAt: string;
  endedAt?: string | null;
  expiresAt: string;
  teacherHeartbeatAt?: string | null;
  activity: LearningActivity;
  participantCount?: number;
  attemptCount?: number;
  submittedCount?: number;
  class?: LearningLookup | null;
  section?: LearningLookup | null;
  subject?: LearningLookup | null;
};

export type LearningLaunchSessionResponse = LearningSession & {
  qrToken?: string;
};

export type LearningSessionPayload = {
  mode?: LearningMode;
  schoolOnly?: boolean;
  expiresInMinutes?: number;
  expiresAt?: string;
};

export type LearningSessionFilters = {
  classId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  teacherId?: string | null;
  activityId?: string | null;
  status?: LearningSessionStatus | null;
  startedFrom?: string | null;
  startedTo?: string | null;
  page?: number;
  limit?: number;
};

export type LearningSessionListResponse = {
  items: LearningSession[];
  total: number;
  page: number;
  limit: number;
};

export type LearningSessionParticipantsResponse = {
  session: LearningSession;
  items: Array<{
    participant: {
      id: string;
      status: string;
      joinedAt: string;
      leftAt?: string | null;
    };
    student: {
      id: string;
      name: string;
      classId: string;
      sectionId?: string | null;
    };
    attempt: {
      id: string;
      status: LearningAttemptStatus;
      attemptNumber: number;
      submittedAt?: string | null;
      accuracy?: number | null;
      score?: number | null;
      lastActivityAt?: string | null;
    } | null;
  }>;
};

export type LearningJoinSessionResponse = {
  participant: unknown;
  session: LearningSession;
};

export type LearningAnswer = {
  questionId: string;
  answer?: unknown;
};

export type LearningAttempt = {
  id: string;
  sessionId: string;
  activityId: string;
  studentId: string;
  startedAt: string;
  submittedAt?: string | null;
  score?: number | null;
  accuracy?: number | null;
  timeSpentSeconds: number;
  hintsUsed: number;
  attemptNumber: number;
  status: LearningAttemptStatus;
  answers: Array<{
    id: string;
    questionId: string;
    answer?: unknown;
    isCorrect?: boolean | null;
    score?: number | null;
    answeredAt?: string;
  }>;
};

export type LearningAttemptPayload = {
  answers?: LearningAnswer[];
  timeSpentSeconds?: number;
  hintsUsed?: number;
};

export type LearningProgressItem = {
  id: string;
  subject: LearningLookup | null;
  activity?: Pick<LearningActivity, 'id' | 'title' | 'difficulty'> | null;
  completedCount: number;
  averageAccuracy: number;
  label: LearningProgressLabel;
  labelText: string;
  lastAttemptAt?: string | null;
};

export type LearningProgressFilters = {
  sectionId?: string | null;
  subjectId?: string | null;
  from?: string | null;
  to?: string | null;
};

export type LearningClassProgress = {
  class: LearningLookup;
  items: Array<{
    student: {
      id: string;
      name: string;
      classId: string;
      sectionId?: string | null;
    };
    progress: LearningProgressItem[];
  }>;
};

export type LearningStudentProgress = {
  student: {
    id: string;
    name: string;
    classId: string;
    sectionId?: string | null;
  };
  items: LearningProgressItem[];
};

export type ParentLearningSummary = {
  items: Array<{
    child: {
      id: string;
      name: string;
      class?: LearningLookup | null;
      section?: LearningLookup | null;
    };
    activityCount: number;
    supportiveLabel: {
      label: LearningProgressLabel;
      text: string;
    };
    recentCompletedActivities: Array<{
      id: string;
      title: string;
      subject: LearningLookup | null;
      difficulty: LearningDifficulty;
      submittedAt?: string | null;
      score?: number | null;
      accuracy?: number | null;
    }>;
    strongTopics: LearningProgressItem[];
    needsPracticeTopics: LearningProgressItem[];
  }>;
};

export type LearningResource = {
  id: string;
  activityId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  fileAssetId?: string | null;
  type: LearningResourceType;
  title: string;
  url?: string | null;
  metadata?: unknown;
  status: LearningResourceStatus;
  createdBy: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  activity?: Pick<LearningActivity, 'id' | 'title' | 'classId' | 'sectionId' | 'subjectId' | 'teacherId'> | null;
  subject?: LearningLookup | null;
  topic?: { id: string; title?: string | null } | null;
  fileAsset?: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    module?: string | null;
    entityId?: string | null;
  } | null;
};

export type LearningResourceListResponse = {
  items: LearningResource[];
  total: number;
  page: number;
  limit: number;
};

export type LearningActivityResourcesResponse = {
  items: LearningResource[];
};

export type LearningResourceFilters = {
  activityId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  type?: LearningResourceType | null;
  status?: LearningResourceStatus | null;
  page?: number;
  limit?: number;
};

export type LearningResourcePayload = {
  activityId?: string;
  subjectId?: string;
  topicId?: string;
  fileAssetId?: string;
  type: LearningResourceType;
  title: string;
  url?: string;
  metadata?: unknown;
};

export const learningApi = {
  listActivities: (params?: LearningActivityFilters) =>
    request<LearningActivityListResponse>(
      withQuery('/learning/activities', params ?? {}),
    ),
  createActivity: (body: LearningActivityPayload) =>
    request<LearningActivity>('/learning/activities', {
      method: 'POST',
      json: body as unknown as JsonBody,
    }),
  getActivity: (activityId: string) =>
    request<LearningActivity>(
      `/learning/activities/${encodeURIComponent(activityId)}`,
    ),
  updateActivity: (
    activityId: string,
    body: Partial<LearningActivityPayload>,
  ) =>
    request<LearningActivity>(
      `/learning/activities/${encodeURIComponent(activityId)}`,
      {
        method: 'PATCH',
        json: body as unknown as JsonBody,
      },
    ),
  archiveActivity: (activityId: string) =>
    request<LearningActivity>(
      `/learning/activities/${encodeURIComponent(activityId)}`,
      { method: 'DELETE' },
    ),
  launchSession: (activityId: string, body: LearningSessionPayload) =>
    request<LearningLaunchSessionResponse>(
      `/learning/activities/${encodeURIComponent(activityId)}/sessions`,
      { method: 'POST', json: body as unknown as JsonBody },
    ),
  listSessions: (params?: LearningSessionFilters) =>
    request<LearningSessionListResponse>(
      withQuery('/learning/sessions', params ?? {}),
    ),
  getSession: (sessionId: string) =>
    request<LearningSession>(
      `/learning/sessions/${encodeURIComponent(sessionId)}`,
    ),
  pauseSession: (sessionId: string) =>
    request<LearningSession>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/pause`,
      { method: 'POST', json: {} },
    ),
  heartbeatSession: (sessionId: string) =>
    request<LearningSession>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/heartbeat`,
      { method: 'POST', json: {} },
    ),
  listParticipants: (sessionId: string) =>
    request<LearningSessionParticipantsResponse>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/participants`,
    ),
  resumeSession: (sessionId: string) =>
    request<LearningSession>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/resume`,
      { method: 'POST', json: {} },
    ),
  endSession: (sessionId: string) =>
    request<LearningSession>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/end`,
      { method: 'POST', json: {} },
    ),
  joinSession: (body: { sessionCode?: string; qrToken?: string }) =>
    request<LearningJoinSessionResponse>('/learning/sessions/join', {
      method: 'POST',
      json: body,
    }),
  startAttempt: (sessionId: string) =>
    request<LearningAttempt>(
      `/learning/sessions/${encodeURIComponent(sessionId)}/attempts`,
      { method: 'POST', json: {} },
    ),
  autosaveAttempt: (attemptId: string, body: LearningAttemptPayload) =>
    request<LearningAttempt>(
      `/learning/attempts/${encodeURIComponent(attemptId)}/autosave`,
      { method: 'PATCH', json: body as unknown as JsonBody },
    ),
  submitAttempt: (attemptId: string, body: LearningAttemptPayload) =>
    request<LearningAttempt>(
      `/learning/attempts/${encodeURIComponent(attemptId)}/submit`,
      { method: 'POST', json: body as unknown as JsonBody },
    ),
  getClassProgress: (classId: string, params?: LearningProgressFilters) =>
    request<LearningClassProgress>(
      withQuery(
        `/learning/progress/class/${encodeURIComponent(classId)}`,
        params ?? {},
      ),
    ),
  getStudentProgress: (studentId: string, params?: LearningProgressFilters) =>
    request<LearningStudentProgress>(
      withQuery(
        `/learning/progress/student/${encodeURIComponent(studentId)}`,
        params ?? {},
      ),
    ),
  getParentSummary: (params?: { studentId?: string | null }) =>
    request<ParentLearningSummary>(
      withQuery('/parent/learning/summary', params ?? {}),
    ),
  listResources: (params?: LearningResourceFilters) =>
    request<LearningResourceListResponse>(
      withQuery('/learning/resources', params ?? {}),
    ),
  createResource: (body: LearningResourcePayload) =>
    request<LearningResource>('/learning/resources', {
      method: 'POST',
      json: body as unknown as JsonBody,
    }),
  getResource: (resourceId: string) =>
    request<LearningResource>(
      `/learning/resources/${encodeURIComponent(resourceId)}`,
    ),
  updateResource: (resourceId: string, body: Partial<LearningResourcePayload>) =>
    request<LearningResource>(
      `/learning/resources/${encodeURIComponent(resourceId)}`,
      { method: 'PATCH', json: body as unknown as JsonBody },
    ),
  archiveResource: (resourceId: string) =>
    request<LearningResource>(
      `/learning/resources/${encodeURIComponent(resourceId)}`,
      { method: 'DELETE' },
    ),
  listActivityResources: (activityId: string) =>
    request<LearningActivityResourcesResponse>(
      `/learning/activities/${encodeURIComponent(activityId)}/resources`,
    ),
  attachActivityResource: (activityId: string, body: LearningResourcePayload) =>
    request<LearningResource>(
      `/learning/activities/${encodeURIComponent(activityId)}/resources`,
      { method: 'POST', json: body as unknown as JsonBody },
    ),
};

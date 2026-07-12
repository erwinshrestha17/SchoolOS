export type ActivityAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  previewUrl?: string | null;
  accessBlockedReason?: string | null;
  processingStatus?: string | null;
  sortOrder: number;
};

export type ActivityGalleryItem = ActivityAttachment & {
  postId: string;
  postTitle: string;
  createdAt: string;
};

export type ActivityPost = {
  id: string;
  title: string;
  body?: string;
  caption?: string;
  askAtHome?: string | null;
  teacherName?: string | null;
  category: string;
  audienceType: string;
  status?:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'NEEDS_CORRECTION'
    | 'ARCHIVED';
  moderationReason?: string | null;
  moderatedAt?: string | null;
  editedAt?: string | null;
  softDeletedAt?: string | null;
  classId: string | null;
  sectionId: string | null;
  publishedAt: string | null;
  attachments: ActivityAttachment[];
  studentTags: Array<{
    studentId: string;
    student?: {
      id: string;
      studentSystemId: string;
      firstNameEn: string;
      lastNameEn: string;
    };
  }>;
  reactions?: ActivityReaction[];
};

export type ActivityReaction = {
  id: string;
  activityPostId: string;
  guardianId: string | null;
  studentId: string | null;
  reaction: 'HEART' | 'CLAP' | 'STAR';
  createdAt: string;
};

export type ActivityReactionAnalytics = {
  byReaction: Array<{ reaction: string; count: number }>;
  topPosts: Array<{
    postId: string;
    title: string;
    category: string;
    reactionCount: number;
  }>;
};

export type DevelopmentalMilestone = {
  id: string;
  classId: string;
  sectionId: string | null;
  studentId: string;
  domain: string;
  milestone: string;
  status: 'EMERGING' | 'PROGRESSING' | 'ACHIEVED' | 'NEEDS_SUPPORT';
  observationNote: string | null;
  photoObjectKey: string | null;
  photoUrl: string | null;
  observedAt: string;
  createdAt: string;
};

export type MoodLog = {
  id: string;
  classId?: string;
  sectionId?: string | null;
  studentId: string | null;
  mood: string;
  logDate: string;
  note: string | null;
  student?: {
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
  } | null;
};

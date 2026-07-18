import { z } from 'zod';
import { studentDocumentFormSchema } from './student.js';

export const activityCategoryValues = [
  'CLASSROOM_LEARNING',
  'ART_AND_CRAFT',
  'MUSIC_AND_DANCE',
  'SPORTS',
  'SCIENCE_AND_PRACTICAL',
  'PROJECT_WORK',
  'EDUCATIONAL_TOUR',
  'HEALTH_AND_HYGIENE',
  'COMPETITION',
  'ASSEMBLY',
  'CLUB_ACTIVITY',
  'COMMUNITY_SERVICE',
  'FESTIVAL_AND_CULTURE',
  'NATIONAL_PROGRAMME',
  'ACHIEVEMENT',
  'OTHER',
  // Legacy values kept for backward compatibility with existing posts.
  'LEARNING',
  'OUTDOOR_PLAY',
  'CELEBRATION',
  'GENERAL',
] as const;

export const activityPostFormSchema = z.object({
  clientSubmissionId: z.string().uuid().optional(),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  title: z.string().min(2),
  caption: z.string().min(2),
  askAtHome: z.string().max(280).optional().nullable(),
  activityDate: z.string().optional(),
  parentVisible: z.boolean().default(true),
  language: z.enum(['ENGLISH', 'NEPALI', 'BOTH']).default('ENGLISH'),
  category: z.enum(activityCategoryValues).default('OTHER'),
  studentIds: z.array(z.string()).default([]),
  attachments: z.array(studentDocumentFormSchema.pick({
    fileName: true,
    contentType: true,
    base64Content: true
  })).min(1).max(6)
});

export const moodLogFormSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  studentId: z.string().optional().nullable(),
  mood: z.enum(['CALM', 'ENGAGED', 'EXCITED', 'UNSETTLED', 'TIRED']),
  note: z.string().optional().nullable(),
  logDate: z.string().min(1)
});

export type ActivityPostFormInput = z.input<typeof activityPostFormSchema>;

export type MoodLogFormInput = z.input<typeof moodLogFormSchema>;

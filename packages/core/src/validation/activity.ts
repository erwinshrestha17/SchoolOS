import { z } from 'zod';
import { studentDocumentFormSchema } from './student.js';

export const activityPostFormSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  title: z.string().min(2),
  caption: z.string().min(2),
  category: z
    .enum(['LEARNING', 'OUTDOOR_PLAY', 'ART_AND_CRAFT', 'CELEBRATION', 'SPORTS', 'GENERAL'])
    .default('GENERAL'),
  studentIds: z.array(z.string()).default([]),
  attachments: z.array(studentDocumentFormSchema.pick({
    fileName: true,
    contentType: true,
    base64Content: true
  })).min(1).max(5)
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

import { z } from 'zod';

export const academicYearFormSchema = z.object({
  name: z.string().min(2),
  startsOn: z.string().min(1),
  endsOn: z.string().min(1),
  isCurrent: z.boolean().default(false)
});

export const classFormSchema = z.object({
  name: z.string().min(1),
  level: z.coerce.number().int().min(0)
});

export const sectionFormSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  capacity: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.number().int().positive().nullable()
  ).optional()
});

export type AcademicYearFormInput = z.input<typeof academicYearFormSchema>;

export type ClassFormInput = z.input<typeof classFormSchema>;

export type SectionFormInput = z.input<typeof sectionFormSchema>;

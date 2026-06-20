import { z } from 'zod';
import { dateOfBirthSchema, normalizedEmailSchema, nepalPhoneSchema, personNameSchema } from './contact-profile.js';

export const guardianSchema = z.object({
  fullName: personNameSchema,
  relation: z.string().min(2),
  primaryPhone: nepalPhoneSchema,
  secondaryPhone: z
    .string()
    .pipe(nepalPhoneSchema)
    .or(z.literal(''))
    .optional()
    .nullable(),
  email: normalizedEmailSchema.optional().nullable(),
  occupation: z.string().optional().nullable(),
  wardNumber: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false)
});

export const studentDocumentFormSchema = z.object({
  kind: z
    .enum([
      'BIRTH_CERTIFICATE',
      'TRANSFER_CERTIFICATE',
      'PHOTO',
      'ID_CARD',
      'ENROLLMENT_CONFIRMATION',
      'OTHER'
    ])
    .default('BIRTH_CERTIFICATE'),
  title: z.string().optional().nullable(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  base64Content: z.string().min(1),
  expiryDate: z.iso.datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  reason: z.string().optional().nullable()
});

export const admissionFormSchema = z.object({
  firstNameEn: personNameSchema,
  lastNameEn: personNameSchema,
  firstNameNp: personNameSchema.optional().nullable(),
  lastNameNp: personNameSchema.optional().nullable(),
  dateOfBirth: dateOfBirthSchema,
  gender: z.string().min(1),
  disabilityFlag: z.string().optional().nullable(),
  confirmNoDisability: z.boolean().default(false),
  admissionDate: z.string().min(1),
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  rollNumber: z.preprocess(
    (value) => (value === '' ? null : value),
    z.coerce.number().int().positive().nullable()
  ).optional(),
  admissionNumber: z.string().optional().nullable(),
  mediumOfInstruction: z.string().default('English'),
  guardians: z.array(guardianSchema).min(1),
  documents: z.array(studentDocumentFormSchema).optional()
}).superRefine((value, ctx) => {
  if (!value.disabilityFlag?.trim() && !value.confirmNoDisability) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Confirm no known disability or enter disability/support details.',
      path: ['confirmNoDisability']
    });
  }
});

export type AdmissionFormInput = z.input<typeof admissionFormSchema>;

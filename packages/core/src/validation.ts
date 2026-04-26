import { z } from 'zod';

export const tenantRegistrationSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  plan: z.string().min(2),
  adminEmail: z.email(),
  adminPassword: z.string().min(8)
});

export const loginSchema = z.object({
  tenantSlug: z.string().min(2),
  email: z.email(),
  password: z.string().min(8)
});

export const guardianSchema = z.object({
  fullName: z.string().min(2),
  relation: z.string().min(2),
  primaryPhone: z.string().min(7),
  secondaryPhone: z.string().optional().nullable(),
  email: z.email().optional().nullable(),
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
  base64Content: z.string().min(1)
});

export const admissionFormSchema = z.object({
  firstNameEn: z.string().min(1),
  lastNameEn: z.string().min(1),
  firstNameNp: z.string().optional().nullable(),
  lastNameNp: z.string().optional().nullable(),
  dateOfBirth: z.string().min(1),
  gender: z.string().min(1),
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
});

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

export const attendanceExceptionSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(['ABSENT', 'LATE', 'LEAVE']),
  remark: z.string().optional().nullable(),
  lateAt: z.string().optional().nullable()
});

export const attendanceSubmissionSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().optional().nullable(),
  attendanceDate: z.string().min(1),
  exceptions: z.array(attendanceExceptionSchema).default([])
});

export const feeHeadFormSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  frequency: z.enum(['ONE_TIME', 'MONTHLY', 'TERM', 'ANNUAL']).default('MONTHLY'),
  defaultAmount: z.coerce.number().positive(),
  vatApplicable: z.boolean().default(true)
});

export const feePlanFormSchema = z.object({
  academicYearId: z.string().min(1),
  classId: z.string().optional().nullable(),
  code: z.string().min(2),
  name: z.string().min(2),
  feeHeadId: z.string().min(1),
  amount: z.coerce.number().positive()
});

export const paymentCollectionSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'BANK', 'CHEQUE', 'TRANSFER', 'MOBILE']).default('CASH'),
  referenceNumber: z.string().optional().nullable(),
  narration: z.string().optional().nullable()
});

export const discountRuleFormSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['SIBLING', 'SCHOLARSHIP', 'STAFF_CHILD', 'MANUAL']),
  feeHeadId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  feePlanId: z.string().optional().nullable(),
  percentOff: z.coerce.number().min(0).optional().nullable(),
  amountOff: z.coerce.number().min(0).optional().nullable()
});

export const feeWaiverFormSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  feeHeadId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  reason: z.string().min(2)
});

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

export type TenantRegistrationInput = z.input<typeof tenantRegistrationSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type AdmissionFormInput = z.input<typeof admissionFormSchema>;
export type AcademicYearFormInput = z.input<typeof academicYearFormSchema>;
export type ClassFormInput = z.input<typeof classFormSchema>;
export type SectionFormInput = z.input<typeof sectionFormSchema>;
export type AttendanceSubmissionInput = z.input<typeof attendanceSubmissionSchema>;
export type FeeHeadFormInput = z.input<typeof feeHeadFormSchema>;
export type FeePlanFormInput = z.input<typeof feePlanFormSchema>;
export type PaymentCollectionInput = z.input<typeof paymentCollectionSchema>;
export type DiscountRuleFormInput = z.input<typeof discountRuleFormSchema>;
export type FeeWaiverFormInput = z.input<typeof feeWaiverFormSchema>;
export type ActivityPostFormInput = z.input<typeof activityPostFormSchema>;
export type MoodLogFormInput = z.input<typeof moodLogFormSchema>;

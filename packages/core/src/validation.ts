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
  mediumOfInstruction: z.string().default('English'),
  guardians: z.array(guardianSchema).min(1)
});

export type TenantRegistrationInput = z.input<typeof tenantRegistrationSchema>;
export type LoginInput = z.input<typeof loginSchema>;
export type AdmissionFormInput = z.input<typeof admissionFormSchema>;

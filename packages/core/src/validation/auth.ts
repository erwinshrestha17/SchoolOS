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

export type TenantRegistrationInput = z.input<typeof tenantRegistrationSchema>;

export type LoginInput = z.input<typeof loginSchema>;

import { z } from 'zod';

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

export const paymentRefundSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().min(1),
  refundDate: z.string().optional().nullable(),
  referenceNumber: z.string().optional().nullable(),
  narration: z.string().optional().nullable()
});

export const cashierCloseWindowSchema = z.object({
  openedAt: z.string().min(1),
  closedAt: z.string().min(1),
  collectorUserId: z.string().optional().nullable(),
  paymentMethod: z.enum(['CASH', 'BANK', 'CHEQUE', 'TRANSFER', 'MOBILE']).optional().nullable()
});

export const cashierCloseCreateSchema = cashierCloseWindowSchema.extend({
  actualCashAmount: z.coerce.number().min(0).optional().nullable(),
  varianceReason: z.string().optional().nullable(),
  denominationBreakdown: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable()
});

export const reconciliationQuerySchema = cashierCloseWindowSchema.extend({
  studentId: z.string().optional().nullable(),
  classId: z.string().optional().nullable(),
  format: z.enum(['json', 'csv']).optional().nullable()
});

export const discountRuleFormSchema = z.object({
  name: z.string().min(2),
  reason: z.string().min(2),
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

export type FeeHeadFormInput = z.input<typeof feeHeadFormSchema>;

export type FeePlanFormInput = z.input<typeof feePlanFormSchema>;

export type PaymentCollectionInput = z.input<typeof paymentCollectionSchema>;

export type PaymentRefundInput = z.input<typeof paymentRefundSchema>;

export type CashierCloseWindowInput = z.input<typeof cashierCloseWindowSchema>;

export type CashierCloseCreateInput = z.input<typeof cashierCloseCreateSchema>;

export type ReconciliationQueryInput = z.input<typeof reconciliationQuerySchema>;

export type DiscountRuleFormInput = z.input<typeof discountRuleFormSchema>;

export type FeeWaiverFormInput = z.input<typeof feeWaiverFormSchema>;

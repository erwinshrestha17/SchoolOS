export const PARENT_SANDBOX_PAYMENT_PROVIDERS = [
  'ESEWA',
  'KHALTI',
  'CONNECT_IPS',
] as const;

export type ParentSandboxPaymentProvider =
  (typeof PARENT_SANDBOX_PAYMENT_PROVIDERS)[number];

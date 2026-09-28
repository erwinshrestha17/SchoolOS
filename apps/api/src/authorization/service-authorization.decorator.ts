import { SetMetadata } from '@nestjs/common';

/** Reviewed dynamic policies retained in their authoritative domain paths. */
export const SERVICE_AUTHORIZATION_POLICIES = Object.freeze([
  'FILE_MODULE_UPLOAD',
  'FILE_UPLOAD_OWNER',
  'FILE_RESOURCE_ACCESS',
  'FINANCE_DASHBOARD',
  'PAYMENT_ALLOCATIONS',
  'PAYMENT_CORRECTION_SOURCE_READ',
  'FINANCE_REQUEST_REVIEW',
  'SETTING_KEY_WRITE',
] as const);
export type ServiceAuthorizationPolicy =
  (typeof SERVICE_AUTHORIZATION_POLICIES)[number];
export const SERVICE_AUTHORIZATION_KEY = 'schoolos:service-authorization';

// Method-only metadata: a new handler cannot inherit an ambient class bypass.
export const ServiceAuthorization = (policy: ServiceAuthorizationPolicy) =>
  SetMetadata(SERVICE_AUTHORIZATION_KEY, policy);

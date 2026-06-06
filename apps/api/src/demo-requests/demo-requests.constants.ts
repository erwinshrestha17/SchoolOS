export const DEMO_REQUEST_STATUSES = [
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'CONVERTED',
  'CLOSED',
  'SPAM',
] as const;

export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export const DEMO_REQUEST_RATE_LIMIT = 5;
export const DEMO_REQUEST_RATE_TTL_MS = 60_000;

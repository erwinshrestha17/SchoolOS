import type { PaginatedResponse, TenantSummary } from './common.js';

export type PlatformTenantSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
  staffCount: number;
};

export type PlatformTenantUsage = {
  tenantId: string;
  studentCount: number;
  staffCount: number;
  userCount: number;
  activeStudents?: number;
  activeStaff?: number;
  storageSizeBytes?: number;
  lastActivityAt?: string | null;
};

export type PlatformTenantDetail = PlatformTenantSummary & {
  usage: PlatformTenantUsage;
  panNumber?: string | null;
  subscription?: PlatformTenantSubscriptionSummary | null;
  billingProfile?: PlatformBillingProfile | null;
  recentAudit?: PlatformAuditLog[];
  onboarding?: PlatformOnboardingChecklist;
  overrides?: Array<{ featureKey: string; enabled: boolean; reason: string }>;
  enabledFeatures?: string[];
  usageCounters?: PlatformUsageCounterSummary[];
  providerReadiness?: Array<{
    providerId: string;
    type: string;
    name: string;
    status: 'ready' | 'degraded' | 'not_configured' | 'failed';
    message: string;
  }>;
  supportOverrideHistory?: Array<{
    id: string;
    platformUserId: string;
    platformUserEmail: string | null;
    reason: string;
    startsAt: string;
    expiresAt: string;
    isActive: boolean;
    createdAt: string;
  }>;
};

export type PlatformDashboardSummary = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  pendingOnboarding: number;
  usage: {
    totalActiveStudents: number;
    totalActiveStaff: number;
    totalUsers: number;
    totalStorageBytes: number;
  };
  healthStatus: 'ready' | 'degraded';
  failedJobsCount: number;
  recentAudit: PlatformAuditLog[];
  providerReadinessStatus: Record<string, 'ready' | 'degraded' | 'not_configured' | 'failed'>;
  subscriptionSummary?: {
    activeSubscriptions: number;
    graceSubscriptions: number;
    expiredSubscriptions: number;
  };
  invoiceSummary?: {
    totalUnpaidAmount: number;
    overdueCount: number;
  };
  usageWarnings?: Array<{
    tenantId: string;
    tenantName: string;
    usageKey: string;
    value: number;
    limit: number;
  }>;
};

export type PlatformPlanSummary = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  priceNpr: string;
  billingCycle: string;
  features: Array<{ featureKey: string; enabled: boolean }>;
  limits: Array<{ usageKey: string; limit: number; period: string }>;
};

export type PlatformTenantSubscriptionSummary = {
  id: string;
  tenantId: string;
  planId: string;
  planKey: string;
  planName: string;
  status: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';
  startsAt: string;
  endsAt?: string | null;
  renewsAt?: string | null;
  trialEndsAt?: string | null;
  addOns?: string[];
};

export type PlatformEntitlementCheck = {
  allowed: boolean;
  tenantId: string;
  featureKey: string;
  reason:
    | 'allowed'
    | 'tenant_inactive'
    | 'no_subscription'
    | 'subscription_inactive'
    | 'feature_locked';
  source?: 'plan' | 'override' | 'none';
  subscriptionStatus?: string | null;
  limit?: number | null;
  currentValue?: number | null;
};

export type PlatformUsageCounterSummary = {
  tenantId: string;
  usageKey: string;
  value: number;
  limit?: number | null;
  period: string;
  periodStart: string;
  exceeded: boolean;
};

export type PlatformBillingProfile = {
  tenantId: string;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingAddress?: string | null;
  panVatNumber?: string | null;
  preferredBillingCycle: string;
  notes?: string | null;
};

export type PlatformSaaSInvoiceSummary = {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  amount: string;
  paidAmount: string;
  balanceAmount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'CANCELLED';
  lines: Array<{
    id: string;
    lineType: string;
    description: string;
    quantity: number;
    unitAmount: string;
    totalAmount: string;
  }>;
};

export type PlatformApiKeySummary = {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  keyPreview: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformApiKeyCreated = PlatformApiKeySummary & {
  secret: string;
};

export type PlatformProviderConfigSummary = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  environment: string;
  config: Record<string, unknown>;
  secretKeys: string[];
  validationStatus?: string | null;
  lastValidatedAt?: string | null;
  updatedAt: string;
};

export type PlatformProviderReadinessDetail = {
  provider: PlatformProviderConfigSummary;
  status: 'ready' | 'degraded' | 'not_configured' | 'failed';
  mode: 'disabled' | 'dry_run';
  message: string;
  missingKeys: string[];
  paidExternalCallSkipped: boolean;
  secretKeysMasked: string[];
  checkedAt: string;
  recentAudit: Array<{
    id: string;
    action: string;
    createdAt: string;
    status?: string | null;
    message?: string | null;
  }>;
};

export type PlatformWebhookEndpointSummary = {
  id: string;
  ownerType: 'PLATFORM' | 'TENANT';
  tenantId?: string | null;
  url: string;
  eventTypes: string[];
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
};

export type PlatformWebhookDeliverySummary = {
  id: string;
  endpointId: string;
  tenantId?: string | null;
  eventType: string;
  payloadChecksum: string;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  retryCount: number;
  responseCode?: number | null;
  responseMessageSummary?: string | null;
  createdAt: string;
  lastAttemptAt?: string | null;
  deliveredAt?: string | null;
};

export type PlatformQueueSummary = {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  workerHealth: 'healthy' | 'degraded' | 'unknown';
  error?: string;
};

export type PlatformFailedJobSummary = {
  id: string;
  queueName: string;
  name: string;
  failedReason?: string | null;
  attemptsMade: number;
  timestamp?: number;
  data: Record<string, unknown>;
  processedOn?: number | null;
  finishedOn?: number | null;
  stacktrace?: string[];
  retryHistory?: Array<{
    id: string;
    userId?: string | null;
    reason?: string | null;
    attemptsMade?: number | null;
    createdAt: string;
  }>;
};

export type PlatformHealthSummary = {
  status: 'ready' | 'degraded';
  checks: Record<string, { status: 'ok' | 'error'; message?: string }>;
  timestamp: string;
};

export type PlatformOnboardingChecklist = {
  tenantId: string;
  completed: number;
  total: number;
  progressPercent: number;
  items: Array<{
    key: string;
    label: string;
    completed: boolean;
    source: 'computed' | 'manual';
    href: string;
    required: boolean;
  }>;
};

export type PlatformDemoRequestStatus =
  | "NEW"
  | "CONTACTED"
  | "SCHEDULED"
  | "CONVERTED"
  | "CLOSED"
  | "SPAM";

export type PlatformDemoRequestSummary = {
  id: string;
  schoolName: string;
  schoolType: string;
  location: string;
  studentsCount: string;
  contactName: string;
  role: string;
  phone: string;
  email: string;
  expectedTimeline: string;
  status: PlatformDemoRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type PlatformDemoRequestDetail = PlatformDemoRequestSummary & {
  branchesCount?: string | null;
  preferredContact?: string | null;
  currentSystem?: string | null;
  interestedModules: string[];
  message?: string | null;
  internalNotes?: string | null;
};

export type PlatformAuditLog = {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  tenantId: string;
  userId?: string | null;
  before?: any;
  after?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

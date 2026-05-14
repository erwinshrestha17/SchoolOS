import type { PaginatedResponse, TenantSummary } from "./types.js";

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
  status:
    | 'TRIAL'
    | 'ACTIVE'
    | 'GRACE'
    | 'SUSPENDED'
    | 'EXPIRED'
    | 'CANCELLED';
  startsAt: string;
  endsAt?: string | null;
  renewsAt?: string | null;
  trialEndsAt?: string | null;
};

export type PlatformEntitlementCheck = {
  allowed: boolean;
  tenantId: string;
  featureKey: string;
  reason: 'allowed' | 'tenant_inactive' | 'no_subscription' | 'subscription_inactive' | 'feature_disabled';
  subscriptionStatus?: string | null;
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
  createdAt: string;
  user?: {
    id: string;
    email?: string | null;
    phone?: string | null;
  } | null;
};

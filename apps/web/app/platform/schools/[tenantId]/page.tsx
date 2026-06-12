'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PlatformTenantDetail, PlatformAuditLog, PlatformSaaSInvoiceSummary, PlatformApiKeyCreated, PlatformApiKeySummary } from '@schoolos/core';
import { 
  ArrowLeft, 
  Shield, 
  ShieldOff,
  Activity,
  Users,
  Calendar,
  Settings,
  AlertTriangle,
  ExternalLink,
  History,
  CreditCard,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Layers,
  FileText,
  Lock,
  Eye,
  RefreshCw,
  Plus,
  MoreVertical,
  ChevronRight,
  Database,
  KeyRound,
  Copy,
  Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type InvoiceDialogMode = 'view' | 'payment' | 'cancel';

export default function PlatformSchoolDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [invoices, setInvoices] = useState<PlatformSaaSInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Status Change Dialog State
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [supportReason, setSupportReason] = useState('');
  const [supportDuration, setSupportDuration] = useState('30');
  const [supportSaving, setSupportSaving] = useState(false);
  const [cancelSubscriptionDialogOpen, setCancelSubscriptionDialogOpen] = useState(false);
  
  // Feature Override State
  const [overrideTarget, setOverrideTarget] = useState<{ key: string; enabled: boolean } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceAction, setInvoiceAction] = useState<{ mode: InvoiceDialogMode; invoice: PlatformSaaSInvoiceSummary } | null>(null);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState(() => makeDefaultInvoiceForm());
  const [paymentForm, setPaymentForm] = useState(() => makeDefaultPaymentForm());
  const [cancelReason, setCancelReason] = useState('');
  const [billingDialogOpen, setBillingDialogOpen] = useState(false);
  const [billingForm, setBillingForm] = useState(() => makeDefaultBillingForm());
  const [onboardingDialogOpen, setOnboardingDialogOpen] = useState(false);
  const [onboardingOverride, setOnboardingOverride] = useState<{ key: string; completed: boolean; label: string } | null>(null);
  const [onboardingReason, setOnboardingReason] = useState('');
  const [tenantAuditLogs, setTenantAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [apiKeys, setApiKeys] = useState<PlatformApiKeySummary[]>([]);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyForm, setApiKeyForm] = useState(() => makeDefaultApiKeyForm());
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<PlatformApiKeyCreated | null>(null);
  const [revokeApiKeyTarget, setRevokeApiKeyTarget] = useState<PlatformApiKeySummary | null>(null);
  const [revokeApiKeyReason, setRevokeApiKeyReason] = useState('');
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    resource: '',
    resourceId: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  const handleFeatureToggle = async () => {
    if (!overrideTarget || !overrideReason.trim()) return;
    
    setUpdating(true);
    try {
      await api.setPlatformFeatureOverride(tenantId, {
        featureKey: overrideTarget.key,
        enabled: overrideTarget.enabled,
        reason: overrideReason
      });
      await loadTenantData();
      setOverrideTarget(null);
      setOverrideReason('');
    } catch (error: any) {
      setActionError(error.message || 'Failed to update feature override');
    } finally {
      setUpdating(false);
    }
  };

  const loadTenantData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, invData, keyResult] = await Promise.all([
        api.getPlatformTenantDetail(tenantId),
        api.listPlatformSaaSInvoices(tenantId),
        api
          .listPlatformApiKeys(tenantId)
          .then((items) => ({ items, error: null }))
          .catch((error) => ({
            items: [] as PlatformApiKeySummary[],
            error: getErrorMessage(error),
          })),
      ]);
      setTenant(data);
      setInvoices(invData);
      setTenantAuditLogs(data.recentAudit ?? []);
      setApiKeys(keyResult.items);
      setApiKeysError(keyResult.error);
    } catch (err) {
      console.error('Failed to load tenant', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadTenantData();
    }
  }, [tenantId, loadTenantData]);

  const [cancellingSubscription, setCancellingSubscription] = useState(false);

  const handleCancelSubscription = async () => {
    if (!tenant || !tenant.subscription) return;
    setCancellingSubscription(true);
    setActionError(null);
    setMessage(null);
    try {
      await api.updatePlatformSubscriptionStatus(tenant.id, tenant.subscription.id, {
        status: 'CANCELLED',
        notes: 'Cancelled from platform dashboard by operator',
      });
      setMessage('Subscription cancelled successfully.');
      setCancelSubscriptionDialogOpen(false);
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to cancel subscription');
    } finally {
      setCancellingSubscription(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!tenant) return;
    if (statusReason.trim().length < 5) {
      setStatusError('Reason must be at least 5 characters.');
      return;
    }

    setUpdating(true);
    setStatusError(null);
    setActionError(null);
    setMessage(null);
    try {
      await api.updatePlatformTenantStatus(tenant.id, !tenant.isActive, statusReason);
      const actionText = !tenant.isActive ? 'activated' : 'suspended';
      setMessage(`Tenant has been successfully ${actionText}.`);
      await loadTenantData();
      setStatusDialogOpen(false);
      setStatusReason('');
    } catch (error: any) {
      setStatusError(error.message || 'Failed to update status');
      setActionError(error.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleEnterSupportMode = async () => {
    if (!tenant || supportReason.trim().length < 5) return;
    setSupportSaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await api.enterPlatformSupportOverride({
        tenantId: tenant.id,
        reason: supportReason.trim(),
        durationMinutes: Number(supportDuration) || 30,
      });
      setMessage('Support override is active. Redirecting to the school workspace.');
      setSupportDialogOpen(false);
      router.push(`/dashboard?tenantOverride=${encodeURIComponent(tenant.id)}`);
    } catch (error: any) {
      setActionError(error.message || 'Failed to enter support mode');
    } finally {
      setSupportSaving(false);
    }
  };

  const openBillingDialog = () => {
    if (!tenant) return;
    setBillingForm({
      billingContactName: tenant.billingProfile?.billingContactName ?? '',
      billingEmail: tenant.billingProfile?.billingEmail ?? '',
      billingPhone: tenant.billingProfile?.billingPhone ?? '',
      billingAddress: tenant.billingProfile?.billingAddress ?? '',
      panVatNumber: tenant.billingProfile?.panVatNumber ?? tenant.panNumber ?? '',
      preferredBillingCycle: tenant.billingProfile?.preferredBillingCycle ?? 'MONTHLY',
      notes: tenant.billingProfile?.notes ?? '',
    });
    setBillingDialogOpen(true);
  };

  const saveBillingProfile = async () => {
    if (!tenant) return;
    if (billingForm.billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingForm.billingEmail)) {
      setActionError('Enter a valid billing email address.');
      return;
    }
    setUpdating(true);
    setActionError(null);
    try {
      await api.updatePlatformBillingProfile(tenant.id, cleanPayload(billingForm));
      setMessage('Billing profile updated.');
      setBillingDialogOpen(false);
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to update billing profile');
    } finally {
      setUpdating(false);
    }
  };

  const createInvoice = async () => {
    if (!tenant || !invoiceForm.description.trim()) return;
    if (invoiceForm.dueDate < invoiceForm.issueDate) {
      setActionError('Due date cannot be before issue date.');
      return;
    }
    setInvoiceSaving(true);
    setActionError(null);
    try {
      await api.createPlatformSaaSInvoice(tenant.id, {
        issueDate: toIsoDate(invoiceForm.issueDate),
        dueDate: toIsoDate(invoiceForm.dueDate),
        notes: invoiceForm.notes,
        planId: tenant.subscription?.planId,
        subscriptionId: tenant.subscription?.id,
        lines: [
          {
            lineType: invoiceForm.lineType,
            description: invoiceForm.description.trim(),
            quantity: Number(invoiceForm.quantity),
            unitAmount: invoiceForm.unitAmount,
          },
        ],
      });
      setMessage('SchoolOS subscription invoice created.');
      setInvoiceDialogOpen(false);
      setInvoiceForm(makeDefaultInvoiceForm());
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to create invoice');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const recordPayment = async () => {
    if (!tenant || !invoiceAction) return;
    setInvoiceSaving(true);
    setActionError(null);
    try {
      await api.recordPlatformSaaSPayment(tenant.id, invoiceAction.invoice.id, {
        amount: paymentForm.amount,
        paymentDate: toIsoDate(paymentForm.paymentDate),
        method: paymentForm.method,
        reference: paymentForm.reference,
        notes: paymentForm.notes,
      });
      setMessage('SaaS payment recorded.');
      setInvoiceAction(null);
      setPaymentForm(makeDefaultPaymentForm());
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to record payment');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const cancelInvoice = async () => {
    if (!tenant || !invoiceAction || cancelReason.trim().length < 5) return;
    setInvoiceSaving(true);
    setActionError(null);
    try {
      await api.cancelPlatformSaaSInvoice(tenant.id, invoiceAction.invoice.id, {
        reason: cancelReason.trim(),
      });
      setMessage('SaaS invoice cancelled.');
      setInvoiceAction(null);
      setCancelReason('');
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to cancel invoice');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const applyTenantAuditFilters = async () => {
    if (!tenant) return;
    setLoadingInvoices(true);
    setActionError(null);
    try {
      const result = await api.listPlatformAuditLogs({
        tenantId: tenant.id,
        limit: 50,
        action: auditFilters.action || undefined,
        resource: auditFilters.resource || undefined,
        resourceId: auditFilters.resourceId || undefined,
        userId: auditFilters.userId || undefined,
        startDate: auditFilters.startDate || undefined,
        endDate: auditFilters.endDate || undefined,
      });
      setTenantAuditLogs(result.items);
      setAuditDialogOpen(false);
    } catch (error: any) {
      setActionError(error.message || 'Failed to load audit logs');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const saveOnboardingOverride = async () => {
    if (!tenant || !onboardingOverride || onboardingReason.trim().length < 5) return;
    setUpdating(true);
    setActionError(null);
    try {
      await api.setTenantOnboardingOverride(tenant.id, {
        itemKey: onboardingOverride.key,
        completed: onboardingOverride.completed,
        reason: onboardingReason.trim(),
      });
      setMessage('Onboarding checklist override saved.');
      setOnboardingOverride(null);
      setOnboardingReason('');
      await loadTenantData();
    } catch (error: any) {
      setActionError(error.message || 'Failed to save onboarding override');
    } finally {
      setUpdating(false);
    }
  };

  const createApiKey = async () => {
    if (!tenant || apiKeyForm.name.trim().length < 3) return;
    const scopes = apiKeyForm.scopes
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

    setApiKeySaving(true);
    setActionError(null);
    setMessage(null);
    try {
      const created = await api.createPlatformApiKey(tenant.id, {
        name: apiKeyForm.name.trim(),
        scopes,
        ...(apiKeyForm.expiresAt
          ? { expiresAt: toIsoDate(apiKeyForm.expiresAt) }
          : {}),
      });
      setCreatedApiKey(created);
      setApiKeyDialogOpen(false);
      setApiKeyForm(makeDefaultApiKeyForm());
      setApiKeysError(null);
      setApiKeys(await api.listPlatformApiKeys(tenant.id));
      setMessage('API key created. Copy the one-time secret now; it will not be shown again.');
    } catch (error: any) {
      setActionError(error.message || 'Failed to create API key');
    } finally {
      setApiKeySaving(false);
    }
  };

  const revokeApiKey = async () => {
    if (!tenant || !revokeApiKeyTarget || revokeApiKeyReason.trim().length < 5) return;
    setApiKeySaving(true);
    setActionError(null);
    setMessage(null);
    try {
      await api.revokePlatformApiKey(tenant.id, revokeApiKeyTarget.id, {
        reason: revokeApiKeyReason.trim(),
      });
      setRevokeApiKeyTarget(null);
      setRevokeApiKeyReason('');
      setCreatedApiKey(null);
      setApiKeys(await api.listPlatformApiKeys(tenant.id));
      setMessage('API key revoked.');
    } catch (error: any) {
      setActionError(error.message || 'Failed to revoke API key');
    } finally {
      setApiKeySaving(false);
    }
  };

  const copyCreatedApiKey = async () => {
    if (!createdApiKey?.secret) return;
    await navigator.clipboard.writeText(createdApiKey.secret);
    setMessage('API key secret copied.');
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Date not recorded';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Date not recorded';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) return (
    <div className="space-y-8 animate-pulse p-8 bg-[var(--color-mod-platform-bg)] rounded-2xl border border-[var(--color-mod-platform-border)]">
      <div className="h-4 w-24 bg-slate-200 rounded-lg" />
      <div className="flex justify-between items-center pb-8 border-b border-slate-100">
        <div className="space-y-2">
          <div className="h-10 w-64 bg-slate-200 rounded-lg" />
          <div className="h-4 w-48 bg-slate-200 rounded-lg" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-36 bg-slate-200 rounded-lg" />
          <div className="h-10 w-36 bg-slate-200 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="h-32 bg-slate-200 rounded-3xl" />
        <div className="h-32 bg-slate-200 rounded-3xl" />
        <div className="h-32 bg-slate-200 rounded-3xl" />
      </div>
      <div className="h-96 bg-slate-100 rounded-3xl" />
    </div>
  );
  
  if (!tenant) return (
    <div className="flex h-[80vh] flex-col items-center justify-center p-8 text-center">
      <AlertTriangle size={48} className="mb-4 text-rose-500" />
      <h2 className="text-xl font-bold text-slate-900">School Not Found</h2>
      <p className="mt-2 text-slate-500">The requested school does not exist or you don&apos;t have access.</p>
      <Button variant="outline" className="mt-6" onClick={() => router.push('/platform/schools')}>
        Back to Schools
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <button 
        onClick={() => router.push('/platform/schools')}
        className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors group"
      >
        <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
        Back to Schools
      </button>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{tenant.name}</h1>
            {tenant.isActive ? (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 font-bold px-3 py-1 rounded-full">
                <Shield size={14} className="mr-1.5" /> ACTIVE
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100 font-bold px-3 py-1 rounded-full">
                <ShieldOff size={14} className="mr-1.5" /> SUSPENDED
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
            <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded uppercase">{tenant.slug}</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>ID: {tenant.id}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant={tenant.isActive ? "destructive" : "default"}
            className="rounded-2xl px-6 font-bold shadow-lg"
            onClick={() => setStatusDialogOpen(true)}
          >
            {tenant.isActive ? <ShieldOff size={18} className="mr-2" /> : <Shield size={18} className="mr-2" />}
            {tenant.isActive ? 'Suspend School' : 'Restore Access'}
          </Button>
          <Button
            variant="outline"
            className="rounded-2xl px-6 font-bold border-slate-200"
            onClick={() => setSupportDialogOpen(true)}
            data-testid="support-mode-button"
          >
            <ExternalLink size={18} className="mr-2" />
            Enter Support Mode
          </Button>
        </div>
      </div>

      {(message || actionError) && (
        <div className={`rounded-2xl border p-4 text-sm font-bold ${
          actionError
            ? 'border-rose-100 bg-rose-50 text-rose-700'
            : 'border-emerald-100 bg-emerald-50 text-emerald-700'
        }`}>
          {actionError || message}
        </div>
      )}

      <ConfirmDialog
        isOpen={cancelSubscriptionDialogOpen}
        title="Cancel School Subscription"
        description="Cancel this school's subscription? This disables access to paid modules until a platform operator restores or changes the plan."
        confirmLabel="Cancel Subscription"
        destructive
        isConfirming={cancellingSubscription}
        onConfirm={() => {
          void handleCancelSubscription();
        }}
        onClose={() => setCancelSubscriptionDialogOpen(false)}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-slate-100/50 p-1 rounded-2xl border border-slate-100">
          <TabsTrigger value="overview" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            SaaS Billing
          </TabsTrigger>
          <TabsTrigger value="entitlements" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Entitlements
          </TabsTrigger>
          <TabsTrigger value="api-keys" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            API Keys
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <MetricCard label="Active Students" value={tenant.studentCount} icon={Users} color="text-indigo-600" bg="bg-indigo-50" />
            <MetricCard label="Active Staff" value={tenant.staffCount} icon={Users} color="text-sky-600" bg="bg-sky-50" />
            <MetricCard label="Storage (S3/R2)" value={formatBytes(tenant.usage.storageSizeBytes ?? 0)} icon={Database} color="text-amber-600" bg="bg-amber-50" />
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              <Card className="rounded-3xl border-slate-100 shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Package className="text-slate-400" size={22} />
                    Current Subscription
                  </CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
                     <div className="flex items-center gap-5">
                       <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-900">
                          <Shield size={32} />
                       </div>
                       <div>
                         <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{tenant.subscription?.planName ?? 'No Plan'}</h3>
                         <p className="text-sm font-medium text-slate-500 mt-1">
                           Status: <span className="font-bold text-slate-900 uppercase">{tenant.subscription?.status ?? 'UNASSIGNED'}</span>
                         </p>
                       </div>
                     </div>
                     <div className="flex gap-2">
                       <Button
                         variant="outline"
                         className="rounded-xl font-bold border-slate-200 bg-white"
                         onClick={() => router.push(`/platform/schools/${tenant.id}/change-plan`)}
                       >
                          Change Plan
                       </Button>
                       {tenant.subscription && tenant.subscription.status !== 'CANCELLED' && (
                         <Button
                           variant="outline"
                           className="rounded-xl font-bold border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 bg-white"
                           onClick={() => setCancelSubscriptionDialogOpen(true)}
                           disabled={cancellingSubscription}
                           data-testid="cancel-subscription-button"
                         >
                           {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                         </Button>
                       )}
                     </div>
                   </div>

                   <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Starts At</p>
                        <p className="text-sm font-bold text-slate-900">{formatDate(tenant.subscription?.startsAt)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Next Renewal</p>
                        <p className="text-sm font-bold text-slate-900">{formatDate(tenant.subscription?.renewsAt)}</p>
                      </div>
                   </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Activity className="text-slate-400" size={22} />
                    Current Platform Usage
                  </CardTitle>
                  <CardDescription>Backend-reported tenant usage. Plan limits are enforced server-side.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                   <UsageValue label="Students" value={tenant.studentCount.toLocaleString()} />
                   <UsageValue label="Staff" value={tenant.staffCount.toLocaleString()} />
                   <UsageValue label="Storage" value={formatBytes(tenant.usage.storageSizeBytes ?? 0)} />
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Layers className="text-slate-400" size={22} />
                    Active Entitlements
                  </CardTitle>
                  <CardDescription>Features and modules enabled for this tenant.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {!tenant.enabledFeatures || tenant.enabledFeatures.length === 0 ? (
                      <span className="text-sm font-medium text-slate-400">No active entitlements.</span>
                    ) : (
                      tenant.enabledFeatures.map(feat => (
                        <Badge key={feat} variant="success" className="rounded-lg font-bold">
                          {feat.replace('module.', '').toUpperCase()}
                        </Badge>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {tenant.usageCounters?.some(c => c.value >= (c.limit ?? 0) * 0.9) && (
                <Card className="rounded-3xl border-rose-100 bg-rose-50/50 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold text-rose-900 flex items-center gap-2">
                      <AlertTriangle className="text-rose-500 animate-bounce" size={20} />
                      Usage Limit Warnings
                    </CardTitle>
                    <CardDescription className="text-rose-700/80">
                      The following usage metrics are at or above 90% of their plan limits.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {tenant.usageCounters?.filter(c => c.value >= (c.limit ?? 0) * 0.9).map(c => (
                      <div key={c.usageKey} className="flex justify-between items-center bg-white/70 p-3 rounded-xl border border-rose-100">
                        <span className="text-sm font-bold text-slate-800 uppercase tracking-tight">{c.usageKey}</span>
                        <span className="text-sm font-black text-rose-700">{c.value} / {c.limit}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card className="rounded-3xl border-slate-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Shield className="text-slate-400" size={22} />
                    Provider Readiness Summary
                  </CardTitle>
                  <CardDescription>Core infrastructure provider configuration status.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  {!tenant.providerReadiness || tenant.providerReadiness.length === 0 ? (
                    <span className="text-sm font-medium text-slate-400 col-span-3 text-center">No providers validated yet.</span>
                  ) : (
                    tenant.providerReadiness.map(pr => (
                      <div key={pr.providerId} className="border border-slate-100 p-4 rounded-2xl bg-slate-50/50 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{pr.type}</span>
                          <Badge variant={pr.status === 'ready' ? 'success' : pr.status === 'failed' ? 'destructive' : 'warning'} className="rounded-lg">
                            {pr.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600 font-medium line-clamp-2">{pr.message}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-slate-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <History className="text-slate-400" size={22} />
                    Support Override History
                  </CardTitle>
                  <CardDescription>Audited support session logs for this school.</CardDescription>
                </CardHeader>
                <CardContent>
                   <div className="rounded-2xl border border-slate-100 overflow-hidden text-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Operator</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Reason</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Duration</th>
                            <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {!tenant.supportOverrideHistory || tenant.supportOverrideHistory.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-400 font-bold">
                                No support overrides recorded.
                              </td>
                            </tr>
                          ) : (
                            tenant.supportOverrideHistory.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/50">
                                <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">{log.platformUserEmail || log.platformUserId}</td>
                                <td className="px-6 py-4 text-xs text-slate-600 font-bold">{log.reason}</td>
                                <td className="px-6 py-4 text-[10px] text-slate-400 font-mono">{formatDate(log.startsAt)} - {formatDate(log.expiresAt)}</td>
                                <td className="px-6 py-4">
                                  <Badge variant={log.isActive ? 'success' : 'neutral'} className="rounded-lg">
                                    {log.isActive ? 'Active' : 'Expired'}
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                   </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
               <Card className="rounded-3xl border-slate-100 shadow-sm">
                 <CardHeader>
                   <CardTitle className="text-xl font-bold flex items-center gap-2">
                     <ClipboardCheck className="text-slate-400" size={22} />
                     Onboarding
                   </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900">Progress</span>
                        <span className="text-sm font-black text-indigo-600">{tenant.onboarding?.progressPercent ?? 0}%</span>
                      </div>
                      <Progress value={tenant.onboarding?.progressPercent ?? 0} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      {(tenant.onboarding?.items || []).slice(0, 8).map(item => (
                        <div key={item.key} className="flex items-center gap-3">
                          {item.completed ? (
                            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-slate-200 shrink-0" />
                          )}
                          <span className={`text-xs font-medium ${item.completed ? 'text-slate-600' : 'text-slate-400'}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full mt-6 text-xs font-bold text-slate-500 hover:text-slate-900"
                      onClick={() => setOnboardingDialogOpen(true)}
                      data-testid="onboarding-checklist-button"
                    >
                      View Checklist <ChevronRight size={14} />
                    </Button>
                 </CardContent>
               </Card>

               <Card className="rounded-2xl border-[var(--color-mod-platform-border)] shadow-sm bg-[var(--color-mod-platform-text)] text-white overflow-hidden relative">
                  <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Financial ID (PAN)</p>
                      <p className="font-mono text-sm font-bold bg-white/10 p-2.5 rounded-xl border border-white/10">{tenant.panNumber || 'NOT_PROVIDED'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">Registered At</p>
                      <p className="text-sm font-bold">{formatDate(tenant.createdAt)}</p>
                    </div>
                  </CardContent>
               </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <div className="grid gap-8 lg:grid-cols-3">
             <div className="lg:col-span-2 space-y-6">
                <Card className="rounded-3xl border-slate-100 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold">SaaS Invoices</CardTitle>
                      <CardDescription>Historical platform fee records.</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl font-bold gap-2"
                      onClick={() => setInvoiceDialogOpen(true)}
                      data-testid="new-saas-invoice-button"
                    >
                       <Plus size={16} /> New Invoice
                    </Button>
                  </CardHeader>
                  <CardContent>
                     <div className="rounded-2xl border border-slate-100 overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Invoice #</th>
                              <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Date</th>
                              <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Amount</th>
                              <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-widest text-[10px]">Status</th>
                              <th className="px-6 py-4 text-right"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {invoices.length === 0 ? (
                               <tr>
                                 <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">
                                   No invoices found for this tenant.
                                 </td>
                               </tr>
                             ) : (
                               invoices.map((inv) => (
                                 <tr key={inv.id} className="group hover:bg-slate-50/50 transition-colors">
                                   <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">{inv.invoiceNumber}</td>
                                   <td className="px-6 py-4 text-xs font-medium text-slate-500">{formatDate(inv.issueDate)}</td>
                                   <td className="px-6 py-4 font-black text-slate-900">{inv.currency} {parseFloat(inv.amount).toLocaleString()}</td>
                                   <td className="px-6 py-4">
                                     <Badge className={`rounded-lg font-bold ${
                                       inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                       inv.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                       'bg-amber-50 text-amber-700 border-amber-100'
                                     }`}>
                                       {inv.status}
                                     </Badge>
                                   </td>
                                   <td className="px-6 py-4">
                                     <div className="flex justify-end gap-2">
                                       <Button variant="ghost" size="sm" className="rounded-lg font-bold" onClick={() => setInvoiceAction({ mode: 'view', invoice: inv })}>
                                         View
                                       </Button>
                                       <Button
                                         variant="outline"
                                         size="sm"
                                         className="rounded-lg font-bold border-slate-200"
                                         disabled={inv.status === 'PAID' || inv.status === 'CANCELLED'}
                                         onClick={() => {
                                           setPaymentForm({ ...makeDefaultPaymentForm(), amount: inv.balanceAmount });
                                           setInvoiceAction({ mode: 'payment', invoice: inv });
                                         }}
                                       >
                                         Payment
                                       </Button>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         className="rounded-lg font-bold text-rose-600"
                                         disabled={inv.status === 'PAID' || inv.status === 'CANCELLED'}
                                         onClick={() => setInvoiceAction({ mode: 'cancel', invoice: inv })}
                                       >
                                         Cancel
                                       </Button>
                                     </div>
                                   </td>
                                 </tr>
                               ))
                             )}
                          </tbody>
                        </table>
                     </div>
                  </CardContent>
                </Card>
             </div>

             <div className="space-y-6">
                <Card className="rounded-3xl border-slate-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">Billing Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Email</Label>
                      <p className="text-sm font-bold text-slate-900">{tenant.billingProfile?.billingEmail ?? 'Same as school admin'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Address</Label>
                      <p className="text-sm font-bold text-slate-900 leading-relaxed">{tenant.billingProfile?.billingAddress ?? 'Not provided'}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Billing Cycle</Label>
                      <p className="text-sm font-bold text-slate-900">{tenant.billingProfile?.preferredBillingCycle ?? 'Not configured'}</p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl font-bold border-slate-200"
                      onClick={openBillingDialog}
                      data-testid="billing-profile-edit-button"
                    >
                      Update Profile
                    </Button>
                  </CardContent>
                </Card>
             </div>
           </div>
        </TabsContent>

        <TabsContent value="entitlements" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Feature Entitlements</CardTitle>
                <CardDescription>Module access and granular feature overrides for this tenant.</CardDescription>
              </div>
              <Badge variant="neutral" className="rounded-full bg-indigo-50 text-indigo-700 border-indigo-100">
                Plan: {tenant.plan}
              </Badge>
            </CardHeader>
            <CardContent>
               <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {['academics', 'finance', 'hr', 'communications', 'library', 'transport', 'canteen', 'intelligence'].map(key => {
                    const override = (tenant.overrides || []).find(o => o.featureKey === key);
                    const planFeature = (tenant.subscription?.planKey === 'free' && key !== 'academics') ? false : true; // Simplified for UI
                    const isEnabled = override ? override.enabled : planFeature;
                    const isOverridden = !!override;
                    
                    return (
                      <div key={key} className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${isEnabled ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900 capitalize">{key.replace('_', ' ')}</span>
                          {isOverridden && (
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest mt-0.5">Manual Override</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 rounded-lg font-bold text-[10px] ${isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                            onClick={() => setOverrideTarget({ key, enabled: !isEnabled })}
                          >
                            {isEnabled ? 'ENABLED' : 'DISABLED'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </CardContent>
          </Card>

          {/* Override Reason Dialog */}
          <Dialog open={!!overrideTarget} onOpenChange={(open: boolean) => !open && setOverrideTarget(null)}>
            <DialogContent className="rounded-3xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Confirm Feature Override</DialogTitle>
                <DialogDescription>
                  You are about to {overrideTarget?.enabled ? 'enable' : 'disable'} <strong>{overrideTarget?.key}</strong> for this tenant. 
                  This will override the default plan setting.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Audit Reason</Label>
                  <Textarea 
                    placeholder="Why are you overriding this feature?" 
                    className="rounded-2xl border-slate-200"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400 italic">Overrides are logged and periodically reviewed.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-xl font-bold" onClick={() => setOverrideTarget(null)}>
                  Cancel
                </Button>
                <Button 
                  className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]"
                  disabled={!overrideReason.trim() || updating}
                  onClick={handleFeatureToggle}
                >
                  {updating ? 'Processing...' : 'Confirm Override'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="rounded-3xl border-rose-100 bg-rose-50/20 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-rose-900 flex items-center gap-2">
                <Lock size={18} /> Active Overrides
              </CardTitle>
              <CardDescription className="text-rose-700/70">Historical trace of manual feature toggles.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="space-y-3">
                  {(tenant.overrides || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-rose-200 rounded-2xl bg-white/50">
                       <p className="text-sm font-bold text-rose-800">No active overrides.</p>
                    </div>
                  ) : (
                    (tenant.overrides || []).map(o => (
                      <div key={o.featureKey} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-rose-100 shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-slate-900 capitalize">{o.featureKey}</p>
                          <p className="text-xs text-slate-500 italic mt-1">&quot;{o.reason}&quot;</p>
                        </div>
                        <Badge variant="neutral" className={o.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}>
                          {o.enabled ? 'FORCED_ON' : 'FORCED_OFF'}
                        </Badge>
                      </div>
                    ))
                  )}
               </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {createdApiKey && (
            <Card className="overflow-hidden rounded-3xl border-emerald-100 bg-emerald-50 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-bold text-emerald-950">
                    <KeyRound size={20} /> One-time API key secret
                  </CardTitle>
                  <CardDescription className="text-emerald-800/80">
                    Store this secret now. SchoolOS only keeps the hashed key and will not reveal it again.
                  </CardDescription>
                </div>
                <Button variant="outline" className="rounded-xl border-emerald-200 bg-white font-bold text-emerald-700" onClick={copyCreatedApiKey}>
                  <Copy size={16} className="mr-2" /> Copy Secret
                </Button>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 font-mono text-sm font-bold text-slate-900 break-all">
                  {createdApiKey.secret}
                </div>
                <div className="mt-4 grid gap-3 text-xs font-bold text-emerald-900 sm:grid-cols-3">
                  <span>Name: {createdApiKey.name}</span>
                  <span>Preview: {createdApiKey.keyPreview}</span>
                  <span>Scopes: {createdApiKey.scopes.length ? createdApiKey.scopes.join(', ') : 'default'}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <KeyRound className="text-slate-400" size={22} />
                  Tenant API Keys
                </CardTitle>
                <CardDescription>
                  Tenant-scoped API credentials for approved integrations. Full secrets are shown only at creation time.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 font-bold"
                onClick={() => setApiKeyDialogOpen(true)}
                data-testid="create-platform-api-key-button"
              >
                <Plus size={16} className="mr-2" /> New API Key
              </Button>
            </CardHeader>
            <CardContent>
              {apiKeysError ? (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-800">
                  {apiKeysError}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Preview</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Scopes</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Last used</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {apiKeys.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                            No tenant API keys have been created.
                          </td>
                        </tr>
                      ) : (
                        apiKeys.map((key) => (
                          <tr key={key.id} className="transition-colors hover:bg-slate-50/60">
                            <td className="px-6 py-4">
                              <p className="font-black text-slate-900">{key.name}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Created {formatDate(key.createdAt)}
                              </p>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-700">{key.keyPreview}</td>
                            <td className="px-6 py-4">
                              <div className="flex max-w-xs flex-wrap gap-1.5">
                                {key.scopes.length === 0 ? (
                                  <Badge variant="neutral" className="rounded-lg">default</Badge>
                                ) : (
                                  key.scopes.map((scope) => (
                                    <Badge key={scope} variant="neutral" className="rounded-lg bg-slate-50 font-mono text-[10px]">
                                      {scope}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatDateTime(key.lastUsedAt)}</td>
                            <td className="px-6 py-4">
                              <Badge variant={key.status === 'ACTIVE' ? 'success' : 'neutral'} className="rounded-lg">
                                {key.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-lg font-bold text-rose-600"
                                disabled={key.status === 'REVOKED'}
                                onClick={() => setRevokeApiKeyTarget(key)}
                              >
                                <Trash2 size={14} className="mr-2" /> Revoke
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <Card className="rounded-3xl border-slate-100 shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <CardTitle className="text-xl font-bold">Platform Audit Trail</CardTitle>
                 <CardDescription>Complete history of operator actions on this tenant.</CardDescription>
               </div>
               <div className="flex items-center gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   className="rounded-lg font-bold border-slate-200"
                   onClick={() => setAuditDialogOpen(true)}
                   data-testid="tenant-audit-filter-button"
                 >
                    Filter
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   className="rounded-lg font-bold border-slate-200"
                   onClick={() => exportAuditCsv(tenantAuditLogs, `${tenant.slug}-audit-current-page.csv`)}
                 >
                    Export current page CSV
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-slate-50 border-t border-slate-50">
                   {tenantAuditLogs.length === 0 ? (
                     <div className="flex flex-col items-center justify-center p-20 text-center">
                        <History size={48} className="text-slate-100 mb-4" />
                        <p className="text-sm font-bold text-slate-400">No audit logs found.</p>
                     </div>
                   ) : (
                      tenantAuditLogs.map((log) => (
                       <div key={log.id} className="group flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start gap-4">
                             <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-mod-platform-bg)] text-[var(--color-mod-platform-accent)] group-hover:bg-[var(--color-mod-platform-accent)] group-hover:text-white transition-colors">
                                <History size={18} />
                             </div>
                             <div>
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</p>
                                <p className="text-xs font-medium text-slate-500 mt-1">
                                   Resource: <span className="font-bold text-slate-900">{log.resource}</span> ({log.resourceId})
                                </p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-sm font-black text-slate-900">{log.user?.email ?? 'System'}</p>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                {formatDateTime(log.createdAt)}
                             </p>
                          </div>
                       </div>
                     ))
                   )}
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Enter Support Mode</DialogTitle>
            <DialogDescription>
              Start a time-bound support override for <strong>{tenant.name}</strong>. This is audited and does not expose tenant data until the backend creates the override.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Duration</Label>
              <Select value={supportDuration} onChange={(e) => setSupportDuration(e.target.value)}>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">60 minutes</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Audit Reason</Label>
              <Textarea value={supportReason} onChange={(e) => setSupportReason(e.target.value)} className="rounded-2xl border-slate-200" placeholder="Explain the support case or operator action." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setSupportDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={supportReason.trim().length < 5 || supportSaving} onClick={handleEnterSupportMode}>
              {supportSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enter Support Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create SchoolOS Subscription Invoice</DialogTitle>
            <DialogDescription>This creates a platform SaaS invoice only. It is not a student fee invoice.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Issue Date</Label>
              <Input type="date" value={invoiceForm.issueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Line Type</Label>
              <Select value={invoiceForm.lineType} onChange={(e) => setInvoiceForm({ ...invoiceForm, lineType: e.target.value })}>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="SETUP_FEE">Setup fee</option>
                <option value="TRAINING_FEE">Training fee</option>
                <option value="SMS_BUNDLE">SMS bundle</option>
                <option value="STORAGE_ADDON">Storage add-on</option>
                <option value="CUSTOM_SUPPORT">Custom support</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit Amount</Label>
              <Input inputMode="decimal" value={invoiceForm.unitAmount} onChange={(e) => setInvoiceForm({ ...invoiceForm, unitAmount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={invoiceForm.quantity} onChange={(e) => setInvoiceForm({ ...invoiceForm, quantity: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Input value={invoiceForm.description} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea className="rounded-2xl border-slate-200" value={invoiceForm.notes} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setInvoiceDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={invoiceSaving || !invoiceForm.description.trim() || Number(invoiceForm.quantity) < 1 || !invoiceForm.unitAmount} onClick={createInvoice}>
              {invoiceSaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!invoiceAction} onOpenChange={(open: boolean) => !open && setInvoiceAction(null)}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {invoiceAction?.mode === 'payment' ? 'Record SaaS Payment' : invoiceAction?.mode === 'cancel' ? 'Cancel SaaS Invoice' : 'SaaS Invoice Detail'}
            </DialogTitle>
            <DialogDescription>{invoiceAction?.invoice.invoiceNumber}</DialogDescription>
          </DialogHeader>
          {invoiceAction?.mode === 'payment' ? (
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <InputWithLabel label="Amount" value={paymentForm.amount} onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })} />
              <InputWithLabel label="Payment Date" type="date" value={paymentForm.paymentDate} onChange={(value) => setPaymentForm({ ...paymentForm, paymentDate: value })} />
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="ESEWA">eSewa</option>
                  <option value="KHALTI">Khalti</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <InputWithLabel label="Reference" value={paymentForm.reference} onChange={(value) => setPaymentForm({ ...paymentForm, reference: value })} />
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea className="rounded-2xl border-slate-200" value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
            </div>
          ) : invoiceAction?.mode === 'cancel' ? (
            <div className="space-y-4 py-4">
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">Cancelling this SchoolOS SaaS invoice is audited and cannot be used for student fee corrections.</div>
              <Textarea className="rounded-2xl border-slate-200" placeholder="Reason for cancelling this invoice" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            </div>
          ) : invoiceAction ? (
            <InvoiceDetail invoice={invoiceAction.invoice} />
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setInvoiceAction(null)}>Close</Button>
            {invoiceAction?.mode === 'payment' && (
              <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={invoiceSaving || !paymentForm.amount} onClick={recordPayment}>Record Payment</Button>
            )}
            {invoiceAction?.mode === 'cancel' && (
              <Button variant="destructive" className="rounded-xl font-bold" disabled={invoiceSaving || cancelReason.trim().length < 5} onClick={cancelInvoice}>Cancel Invoice</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={billingDialogOpen} onOpenChange={setBillingDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Edit Billing Profile</DialogTitle>
            <DialogDescription>Platform SaaS billing contact details for {tenant.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <InputWithLabel label="Billing Contact" value={billingForm.billingContactName} onChange={(value) => setBillingForm({ ...billingForm, billingContactName: value })} />
            <InputWithLabel label="Billing Email" type="email" value={billingForm.billingEmail} onChange={(value) => setBillingForm({ ...billingForm, billingEmail: value })} />
            <InputWithLabel label="Billing Phone" value={billingForm.billingPhone} onChange={(value) => setBillingForm({ ...billingForm, billingPhone: value })} />
            <InputWithLabel label="PAN/VAT Number" value={billingForm.panVatNumber} onChange={(value) => setBillingForm({ ...billingForm, panVatNumber: value })} />
            <div className="space-y-2">
              <Label>Preferred Billing Cycle</Label>
              <Select value={billingForm.preferredBillingCycle} onChange={(e) => setBillingForm({ ...billingForm, preferredBillingCycle: e.target.value })}>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Billing Address</Label>
              <Textarea className="rounded-2xl border-slate-200" value={billingForm.billingAddress} onChange={(e) => setBillingForm({ ...billingForm, billingAddress: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea className="rounded-2xl border-slate-200" value={billingForm.notes} onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setBillingDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={updating} onClick={saveBillingProfile}>Save Billing Profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={onboardingDialogOpen} onOpenChange={setOnboardingDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Onboarding Checklist</DialogTitle>
            <DialogDescription>Required and optional platform onboarding checks for {tenant.name}.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-3 overflow-y-auto py-4">
            {(tenant.onboarding?.items ?? []).map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl border border-slate-100 p-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{item.required ? 'Required' : 'Optional'} · {item.source}</p>
                  {item.href ? <p className="mt-1 text-xs font-bold text-indigo-600">{item.href}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.completed ? 'success' : 'neutral'}>{item.completed ? 'Complete' : 'Open'}</Badge>
                  <Button size="sm" variant="outline" className="rounded-lg font-bold" onClick={() => setOnboardingOverride({ key: item.key, label: item.label, completed: !item.completed })}>
                    Override
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!onboardingOverride} onOpenChange={(open: boolean) => !open && setOnboardingOverride(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Override Checklist Item</DialogTitle>
            <DialogDescription>{onboardingOverride?.label}</DialogDescription>
          </DialogHeader>
          <Textarea className="my-4 rounded-2xl border-slate-200" placeholder="Audit reason" value={onboardingReason} onChange={(e) => setOnboardingReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setOnboardingOverride(null)}>Cancel</Button>
            <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={onboardingReason.trim().length < 5 || updating} onClick={saveOnboardingOverride}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create Tenant API Key</DialogTitle>
            <DialogDescription>
              Generate a scoped key for an approved integration. The secret is shown once after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <InputWithLabel
              label="Key Name"
              value={apiKeyForm.name}
              onChange={(value) => setApiKeyForm({ ...apiKeyForm, name: value })}
            />
            <InputWithLabel
              label="Scopes"
              value={apiKeyForm.scopes}
              onChange={(value) => setApiKeyForm({ ...apiKeyForm, scopes: value })}
            />
            <p className="-mt-2 text-xs font-semibold text-slate-400">
              Use comma-separated scopes, for example students:read, attendance:read.
            </p>
            <InputWithLabel
              label="Expires At"
              type="date"
              value={apiKeyForm.expiresAt}
              onChange={(value) => setApiKeyForm({ ...apiKeyForm, expiresAt: value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setApiKeyDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl bg-[var(--color-mod-platform-accent)] font-bold text-white hover:bg-[var(--color-mod-platform-text)]" disabled={apiKeySaving || apiKeyForm.name.trim().length < 3} onClick={createApiKey}>
              {apiKeySaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!revokeApiKeyTarget} onOpenChange={(open: boolean) => !open && setRevokeApiKeyTarget(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Revoke API Key</DialogTitle>
            <DialogDescription>
              Revoking {revokeApiKeyTarget?.name} immediately disables that integration credential.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="my-4 rounded-2xl border-slate-200"
            placeholder="Audit reason for revoking this key"
            value={revokeApiKeyReason}
            onChange={(e) => setRevokeApiKeyReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setRevokeApiKeyTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-xl font-bold" disabled={apiKeySaving || revokeApiKeyReason.trim().length < 5} onClick={revokeApiKey}>
              {apiKeySaving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Filter Tenant Audit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {(['action', 'resource', 'resourceId', 'userId'] as const).map((key) => (
              <InputWithLabel key={key} label={key} value={auditFilters[key]} onChange={(value) => setAuditFilters({ ...auditFilters, [key]: value })} />
            ))}
            <InputWithLabel label="Start Date" type="date" value={auditFilters.startDate} onChange={(value) => setAuditFilters({ ...auditFilters, startDate: value })} />
            <InputWithLabel label="End Date" type="date" value={auditFilters.endDate} onChange={(value) => setAuditFilters({ ...auditFilters, endDate: value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setAuditFilters({ action: '', resource: '', resourceId: '', userId: '', startDate: '', endDate: '' })}>Clear</Button>
            <Button className="rounded-xl font-bold bg-[var(--color-mod-platform-accent)] text-white hover:bg-[var(--color-mod-platform-text)]" disabled={loadingInvoices} onClick={applyTenantAuditFilters}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {tenant.isActive ? 'Suspend School Access' : 'Restore School Access'}
            </DialogTitle>
            <DialogDescription>
              {tenant.isActive 
                ? "Suspension will immediately block all users from logging in or performing actions. This action is logged and reversible."
                : "Restoring access will allow users to resume operations immediately."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason" className="font-bold text-slate-700">Audit Reason</Label>
              <Textarea 
                id="reason" 
                placeholder="Explain why you are changing this school's status..." 
                className="rounded-2xl border-slate-200 focus:ring-slate-900"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
              {statusError && <p className="text-xs font-bold text-rose-500">{statusError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl font-bold" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant={tenant.isActive ? "destructive" : "default"}
              className="rounded-xl font-bold"
              disabled={statusReason.trim().length < 5 || updating}
              onClick={handleStatusUpdate}
            >
              {updating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Status Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, bg }: { label: string, value: string | number, icon: any, color: string, bg: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-[var(--color-mod-platform-border)]">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${bg} ${color} transition-transform group-hover:scale-110`}>
        <Icon size={28} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-900 tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
}

function UsageValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function InputWithLabel({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function InvoiceDetail({ invoice }: { invoice: PlatformSaaSInvoiceSummary }) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <UsageValue label="Status" value={invoice.status} />
        <UsageValue label="Issued" value={new Date(invoice.issueDate).toLocaleDateString()} />
        <UsageValue label="Due" value={new Date(invoice.dueDate).toLocaleDateString()} />
      </div>
      <div className="rounded-2xl border border-slate-100">
        {invoice.lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between border-b border-slate-50 p-4 last:border-b-0">
            <div>
              <p className="text-sm font-bold text-slate-900">{line.description}</p>
              <p className="text-xs font-semibold text-slate-400">{line.lineType} · Qty {line.quantity}</p>
            </div>
            <p className="font-black text-slate-900">{invoice.currency} {Number(line.totalAmount).toLocaleString()}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <UsageValue label="Total" value={`${invoice.currency} ${Number(invoice.amount).toLocaleString()}`} />
        <UsageValue label="Paid" value={`${invoice.currency} ${Number(invoice.paidAmount).toLocaleString()}`} />
        <UsageValue label="Balance" value={`${invoice.currency} ${Number(invoice.balanceAmount).toLocaleString()}`} />
      </div>
    </div>
  );
}

function UsageLimitRow({ label, current, limit, unit }: { label: string, current: number, limit: number, unit: string }) {
  const percent = Math.min(Math.round((current / limit) * 100), 100);
  const isHigh = percent > 85;
  
  const displayCurrent = unit === 'bytes' ? formatBytes(current) : current.toLocaleString();
  const displayLimit = unit === 'bytes' ? formatBytes(limit) : limit.toLocaleString();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-slate-700">{label}</span>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isHigh ? 'text-rose-600' : 'text-slate-400'}`}>
          {displayCurrent} / {displayLimit} {unit !== 'bytes' ? unit : ''}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${isHigh ? 'bg-rose-500' : 'bg-indigo-500'}`} 
          style={{ width: `${percent}%` }} 
        />
      </div>
    </div>
  );
}

function EntitlementToggle({ label, enabled, variant = 'default' }: { label: string, enabled: boolean, variant?: 'default' | 'premium' }) {
  return (
    <div className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${enabled ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
      <div className="flex flex-col">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        {variant === 'premium' && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-0.5">Premium Feature</span>}
      </div>
      {enabled ? (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-lg">ENABLED</Badge>
      ) : (
        <Badge variant="neutral" className="rounded-lg">DISABLED</Badge>
      )}
    </div>
  );
}

function InvoicePlaceholderRow() {
  return (
    <tr className="group hover:bg-slate-50/50 transition-colors">
      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900">SO-2024-00124</td>
      <td className="px-6 py-4 text-xs font-medium text-slate-500">May 12, 2024</td>
      <td className="px-6 py-4 font-black text-slate-900">NPR 45,000.00</td>
      <td className="px-6 py-4">
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-lg font-bold">PAID</Badge>
      </td>
      <td className="px-6 py-4 text-right">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900">
           <MoreVertical size={16} />
        </Button>
      </td>
    </tr>
  );
}

function makeDefaultInvoiceForm() {
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date();
  due.setDate(due.getDate() + 15);
  return {
    issueDate: today,
    dueDate: due.toISOString().slice(0, 10),
    lineType: 'SUBSCRIPTION',
    description: 'SchoolOS subscription billing',
    quantity: '1',
    unitAmount: '',
    notes: '',
  };
}

function makeDefaultPaymentForm() {
  return {
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
  };
}

function makeDefaultBillingForm() {
  return {
    billingContactName: '',
    billingEmail: '',
    billingPhone: '',
    billingAddress: '',
    panVatNumber: '',
    preferredBillingCycle: 'MONTHLY',
    notes: '',
  };
}

function makeDefaultApiKeyForm() {
  return {
    name: '',
    scopes: 'students:read, attendance:read',
    expiresAt: '',
  };
}

function toIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function cleanPayload(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim() !== ''),
  );
}

function exportAuditCsv(logs: PlatformAuditLog[], fileName: string) {
  const headers = ['createdAt', 'action', 'resource', 'resourceId', 'tenantId', 'userId'];
  const rows = logs.map((log) =>
    headers
      .map((key) => `"${String(log[key as keyof PlatformAuditLog] ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}

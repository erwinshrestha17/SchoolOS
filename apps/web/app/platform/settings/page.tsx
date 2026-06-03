'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  Server,
  ShieldCheck,
  History,
  Lock,
  EyeOff,
  Plus,
  Trash2,
  Database,
  Mail,
  MessageSquare,
  Zap,
  Globe,
  Clock,
  ShieldAlert,
  Search,
  Webhook,
  Loader2,
} from 'lucide-react';
import { api } from '../../../lib/api';
import type {
  PlatformHealthSummary,
  PlatformPlanSummary,
  PlatformProviderConfigSummary,
  PlatformProviderReadinessDetail,
  PlatformQueueSummary,
  PlatformAuditLog,
  PlatformFailedJobSummary,
  PlatformWebhookDeliverySummary,
  PlatformWebhookEndpointSummary,
} from '@schoolos/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';

export default function PlatformSettings() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(() => getInitialSettingsTab());
  const [providers, setProviders] = useState<PlatformProviderConfigSummary[]>(
    [],
  );
  const [queues, setQueues] = useState<PlatformQueueSummary[]>([]);
  const [health, setHealth] = useState<PlatformHealthSummary | null>(null);
  const [plans, setPlans] = useState<PlatformPlanSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [failedJobs, setFailedJobs] = useState<PlatformFailedJobSummary[]>([]);
  const [webhookEndpoints, setWebhookEndpoints] = useState<
    PlatformWebhookEndpointSummary[]
  >([]);
  const [webhookDeliveries, setWebhookDeliveries] = useState<
    PlatformWebhookDeliverySummary[]
  >([]);

  const [providersReadiness, setProvidersReadiness] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Report Exports Tab State
  const [reportExports, setReportExports] = useState<any[]>([]);
  const [loadingExports, setLoadingExports] = useState(false);
  const [exportTenantFilter, setExportTenantFilter] = useState('');
  const [exportModuleFilter, setExportModuleFilter] = useState('');
  const [exportStatusFilter, setExportStatusFilter] = useState('');

  const loadReportExports = useCallback(async () => {
    setLoadingExports(true);
    try {
      const result = await api.listPlatformReportExports({
        tenantId: exportTenantFilter.trim() || undefined,
        module: exportModuleFilter.trim() || undefined,
        status: exportStatusFilter.trim() || undefined,
      });
      const items = Array.isArray(result) ? result : (result as any)?.items || [];
      setReportExports(items);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load report exports');
    } finally {
      setLoadingExports(false);
    }
  }, [exportTenantFilter, exportModuleFilter, exportStatusFilter]);

  const downloadExport = async (fileAssetId: string) => {
    try {
      const fileData = await api.getFileView(fileAssetId);
      if (fileData.url) {
        window.open(fileData.url, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download file');
    }
  };

  // Audit Filters
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    tenantId: '',
    resource: '',
    resourceId: '',
    userId: '',
    startDate: '',
    endDate: '',
  });

  // Job Inspection State
  const [inspectingQueue, setInspectingQueue] = useState<string | null>(null);

  // Provider Dialog State
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(
    null,
  );
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerResult, setProviderResult] = useState<string | null>(null);
  const [providerReadiness, setProviderReadiness] =
    useState<PlatformProviderReadinessDetail | null>(null);
  const [loadingProviderReadinessId, setLoadingProviderReadinessId] = useState<
    string | null
  >(null);
  const [editingProvider, setEditingProvider] =
    useState<PlatformProviderConfigSummary | null>(null);
  const [disableProvider, setDisableProvider] =
    useState<PlatformProviderConfigSummary | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [retryDialog, setRetryDialog] = useState<{
    queueName: string;
    jobId?: string;
  } | null>(null);
  const [retryReason, setRetryReason] = useState('');
  const [discardDialog, setDiscardDialog] =
    useState<PlatformFailedJobSummary | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState('');
  const [jobDetail, setJobDetail] = useState<PlatformFailedJobSummary | null>(
    null,
  );
  const [loadingJobDetailId, setLoadingJobDetailId] = useState<string | null>(
    null,
  );
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookSaving, setWebhookSaving] = useState(false);
  const [webhookForm, setWebhookForm] = useState(() =>
    makeDefaultWebhookForm(),
  );

  const testProvider = async (providerId: string) => {
    setTestingProviderId(providerId);
    try {
      const result = await api.testPlatformProviderConnection(providerId);
      setProviderReadiness(result);
      setProviderResult(
        result.message ?? 'Provider readiness check completed.',
      );
    } catch (err: any) {
      setProviderError(err.message ?? 'Connection test failed');
    } finally {
      setTestingProviderId(null);
    }
  };

  const showProviderReadiness = async (providerId: string) => {
    setLoadingProviderReadinessId(providerId);
    setProviderError(null);
    try {
      setProviderReadiness(await api.getPlatformProviderReadiness(providerId));
    } catch (err: any) {
      setProviderError(err.message ?? 'Failed to load provider readiness');
    } finally {
      setLoadingProviderReadinessId(null);
    }
  };

  const [providerForm, setProviderForm] = useState({
    type: 'SMS',
    name: '',
    environment: 'PRODUCTION',
    enabled: true,
    config: '{}',
  });

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [
          pResult,
          qResult,
          hResult,
          plResult,
          aResult,
          fjResult,
          prResult,
          whResult,
          whdResult,
        ] =
          await Promise.all([
            api.listPlatformProviders(),
            api.getPlatformQueueHealth(),
            api.getPlatformHealth(),
            api.listPlatformPlans(),
            api.listPlatformAuditLogs({
              limit: 20,
              action: auditFilters.action || undefined,
              tenantId: auditFilters.tenantId || undefined,
              resource: auditFilters.resource || undefined,
              resourceId: auditFilters.resourceId || undefined,
              userId: auditFilters.userId || undefined,
              startDate: auditFilters.startDate || undefined,
              endDate: auditFilters.endDate || undefined,
            }),
            api.listPlatformFailedJobs({ limit: 50 }),
            api.getPlatformProvidersReadiness().catch(() => []),
            api.listPlatformWebhookEndpoints(),
            api.listPlatformWebhookDeliveries(),
          ]);

        setProviders(asArray<PlatformProviderConfigSummary>(pResult));
        setQueues(asArray<PlatformQueueSummary>(qResult));
        setHealth(hResult);
        setPlans(asArray<PlatformPlanSummary>(plResult));
        setAuditLogs(asArray<PlatformAuditLog>(aResult));
        setFailedJobs(asArray<PlatformFailedJobSummary>(fjResult));
        setProvidersReadiness(asArray<any>(prResult));
        setWebhookEndpoints(
          asArray<PlatformWebhookEndpointSummary>(whResult),
        );
        setWebhookDeliveries(
          asArray<PlatformWebhookDeliverySummary>(whdResult),
        );
      } catch (err: any) {
        setError(err.message ?? 'Failed to load platform data');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [auditFilters],
  );

  const retryQueue = async (queueName: string) => {
    setRetryDialog({ queueName });
    setRetryReason('');
  };

  const submitRetry = async () => {
    if (!retryDialog || retryReason.trim().length < 5) return;
    setRetrying(retryDialog.queueName);
    try {
      const failedInQueue = retryDialog.jobId
        ? safeFailedJobs.filter(
            (job) =>
              job.queueName === retryDialog.queueName &&
              job.id === retryDialog.jobId,
          )
        : safeFailedJobs.filter((job) => job.queueName === retryDialog.queueName);
      if (failedInQueue.length === 0) {
        setActionMessage('No failed jobs found in this queue.');
        return;
      }

      await Promise.all(
        failedInQueue.map((job) =>
          api.retryPlatformFailedJob({
            queueName: job.queueName,
            jobId: job.id,
            reason: retryReason.trim(),
          }),
        ),
      );

      setActionMessage(
        `Retry requested for ${failedInQueue.length} failed job(s).`,
      );
      setRetryDialog(null);
      await load(true);
    } catch (err: any) {
      setError(err.message ?? 'Retry failed');
    } finally {
      setRetrying(null);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === 'exports') {
      loadReportExports();
    }
  }, [activeTab, loadReportExports]);

  useEffect(() => {
    const nextTab = getInitialSettingsTab();
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    // The page reads the URL once on navigation; tab changes update the URL below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProvider = async () => {
    setSavingProvider(true);
    setProviderError(null);
    try {
      await api.upsertPlatformProvider({
        ...providerForm,
        config: JSON.parse(providerForm.config),
      });
      setProviderResult(
        editingProvider ? 'Provider updated.' : 'Provider created.',
      );
      setProviderDialogOpen(false);
      setEditingProvider(null);
      await load(true);
    } catch (err: any) {
      setProviderError(err.message ?? 'Failed to save provider');
    } finally {
      setSavingProvider(false);
    }
  };

  const openProviderEditor = (provider: PlatformProviderConfigSummary) => {
    setEditingProvider(provider);
    setProviderForm({
      type: provider.type,
      name: provider.name,
      environment: provider.environment,
      enabled: provider.enabled,
      config: JSON.stringify(provider.config, null, 2),
    });
    setProviderDialogOpen(true);
  };

  const updateProviderStatus = async () => {
    if (!disableProvider || disableReason.trim().length < 5) return;
    setSavingProvider(true);
    setProviderError(null);
    try {
      await api.updatePlatformProviderStatus(disableProvider.id, {
        enabled: false,
        reason: disableReason.trim(),
      });
      setProviderResult('Provider disabled.');
      setDisableProvider(null);
      setDisableReason('');
      await load(true);
    } catch (err: any) {
      setProviderError(err.message ?? 'Failed to disable provider');
    } finally {
      setSavingProvider(false);
    }
  };

  const discardJob = async () => {
    if (!discardDialog || discardConfirm !== discardDialog.id) return;
    try {
      await api.removePlatformJob(discardDialog.queueName, discardDialog.id);
      setActionMessage('Failed job discarded.');
      setDiscardDialog(null);
      setDiscardConfirm('');
      await load(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to discard job');
    }
  };

  const inspectJobDetail = async (queueName: string, jobId: string) => {
    setLoadingJobDetailId(jobId);
    try {
      setJobDetail(await api.getPlatformJobDetail(queueName, jobId));
    } catch (err: any) {
      setError(err.message ?? 'Failed to load failed job detail');
    } finally {
      setLoadingJobDetailId(null);
    }
  };

  const createWebhookEndpoint = async () => {
    if (
      webhookForm.signingSecret.trim().length < 16 ||
      webhookForm.url.trim().length === 0
    ) {
      setError('Webhook URL and a signing secret of at least 16 characters are required.');
      return;
    }

    if (webhookForm.ownerType === 'TENANT' && !webhookForm.tenantId.trim()) {
      setError('Tenant-owned webhooks require a tenant ID.');
      return;
    }

    setWebhookSaving(true);
    setError(null);
    setActionMessage(null);
    try {
      await api.createPlatformWebhookEndpoint({
        ownerType: webhookForm.ownerType,
        tenantId:
          webhookForm.ownerType === 'TENANT'
            ? webhookForm.tenantId.trim()
            : undefined,
        url: webhookForm.url.trim(),
        signingSecret: webhookForm.signingSecret.trim(),
        eventTypes: splitList(webhookForm.eventTypes),
      });
      setWebhookDialogOpen(false);
      setWebhookForm(makeDefaultWebhookForm());
      setActionMessage('Webhook endpoint registered.');
      await load(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create webhook endpoint');
    } finally {
      setWebhookSaving(false);
    }
  };

  const toggleWebhookEndpoint = async (
    endpoint: PlatformWebhookEndpointSummary,
  ) => {
    setWebhookSaving(true);
    setError(null);
    setActionMessage(null);
    try {
      await api.updatePlatformWebhookEndpoint(endpoint.id, {
        status: endpoint.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
        eventTypes: endpoint.eventTypes,
      });
      setActionMessage(
        endpoint.status === 'ACTIVE'
          ? 'Webhook endpoint disabled.'
          : 'Webhook endpoint enabled.',
      );
      await load(true);
    } catch (err: any) {
      setError(err.message ?? 'Failed to update webhook endpoint');
    } finally {
      setWebhookSaving(false);
    }
  };

  const formatDate = (dateString: string | number | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const safeFailedJobs = asArray<PlatformFailedJobSummary>(failedJobs);
  const safeQueues = asArray<PlatformQueueSummary>(queues);
  const safeProviders = asArray<PlatformProviderConfigSummary>(providers);
  const safePlans = asArray<PlatformPlanSummary>(plans);
  const safeAuditLogs = asArray<PlatformAuditLog>(auditLogs);
  const safeWebhookEndpoints =
    asArray<PlatformWebhookEndpointSummary>(webhookEndpoints);
  const safeWebhookDeliveries =
    asArray<PlatformWebhookDeliverySummary>(webhookDeliveries);
  const failedJobsForInspectingQueue = safeFailedJobs.filter(
    (job) => job.queueName === inspectingQueue,
  );

  if (loading)
    return (
      <div className="space-y-8 animate-pulse p-8 bg-slate-950/5 rounded-3xl border border-slate-100">
        <div className="pb-8 border-b border-slate-100 space-y-3">
          <div className="h-4 w-24 bg-slate-200 rounded-lg" />
          <div className="h-10 w-64 bg-slate-200 rounded-lg" />
          <div className="h-4 w-96 bg-slate-200 rounded-lg" />
        </div>
        <div className="flex space-x-2 border-b border-slate-100 pb-4">
          <div className="h-9 w-28 bg-slate-200 rounded-lg" />
          <div className="h-9 w-28 bg-slate-200 rounded-lg" />
          <div className="h-9 w-28 bg-slate-200 rounded-lg" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="h-32 bg-slate-200 rounded-3xl" />
          <div className="h-32 bg-slate-200 rounded-3xl" />
          <div className="h-32 bg-slate-200 rounded-3xl" />
        </div>
        <div className="h-64 bg-slate-100 rounded-3xl" />
      </div>
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-8">
        <div>
          <Badge
            variant="neutral"
            className="bg-slate-100 text-slate-600 mb-3 uppercase tracking-widest text-[10px] font-black"
          >
            Infrastructure Root
          </Badge>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">
            Platform Settings
          </h1>
          <p className="mt-2 text-lg text-slate-500">
            Isolated management of global providers, background queues, and
            system health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="rounded-2xl h-12 px-6 font-bold border-slate-200 gap-2"
            onClick={() => {
              if (activeTab === 'exports') {
                loadReportExports();
              } else {
                load(true);
              }
            }}
            disabled={refreshing || loadingExports}
          >
            <RefreshCw size={18} className={refreshing || loadingExports ? 'animate-spin' : ''} />
            Refresh State
          </Button>
          <Button
            className="rounded-2xl h-12 px-6 font-bold bg-slate-900 shadow-xl shadow-slate-200 hover:bg-slate-800 gap-2 text-white"
            onClick={() => {
              setEditingProvider(null);
              setProviderError(null);
              setProviderForm({
                type: 'SMS',
                name: '',
                environment: 'PRODUCTION',
                enabled: true,
                config: '{}',
              });
              setProviderDialogOpen(true);
            }}
          >
            <Plus size={20} />
            New Provider
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          <ShieldAlert size={18} />
          {error}
        </div>
      )}

      {(actionMessage || providerResult || providerError) && (
        <div
          className={`rounded-2xl border p-4 text-sm font-bold ${
            providerError
              ? 'border-rose-100 bg-rose-50 text-rose-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700'
          }`}
        >
          {providerError || providerResult || actionMessage}
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          router.replace(`/platform/settings?tab=${value}`);
        }}
        className="space-y-8"
      >
        <TabsList className="bg-slate-100/50 p-1 rounded-2xl border border-slate-100 w-fit">
          <TabsTrigger
            value="health"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            System Health
          </TabsTrigger>
          <TabsTrigger
            value="providers"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Providers
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Webhooks
          </TabsTrigger>
          <TabsTrigger
            value="queues"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Queues
          </TabsTrigger>
          <TabsTrigger
            value="plans"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            SaaS Plans
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Global Audit
          </TabsTrigger>
          <TabsTrigger
            value="exports"
            className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
          >
            Report Exports
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="health"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(health?.checks ?? {}).map(
              ([key, check]: [string, any]) => (
                <Card
                  key={key}
                  className="rounded-3xl border-slate-100 shadow-sm overflow-hidden group"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                        {key === 'database' ? (
                          <Database size={24} />
                        ) : key === 'redis' ? (
                          <Zap size={24} />
                        ) : key === 'queue' ? (
                          <Clock size={24} />
                        ) : (
                          <Globe size={24} />
                        )}
                      </div>
                      {check.status === 'ok' ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">
                          HEALTHY
                        </Badge>
                      ) : (
                        <Badge variant="destructive">CRITICAL</Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-slate-900 capitalize">
                      {key}
                    </h3>
                    <p className="mt-1 text-xs font-bold text-slate-400 uppercase tracking-tighter">
                      {check.message ?? 'Operational'}
                    </p>
                  </CardContent>
                </Card>
              ),
            )}
          </div>

          <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8">
              <CardTitle className="text-2xl font-black">
                Environmental Metrics
              </CardTitle>
              <CardDescription>
                Cluster telemetry is shown only when backed by platform health
                APIs.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                <p className="text-sm font-bold text-slate-700">
                  CPU, memory, DB pool, and API latency telemetry are not
                  configured in the current backend response.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  No fake production metrics are displayed. Connect
                  observability data to the platform health API to populate this
                  section.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="providers"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2"
        >
          {providersReadiness.length > 0 && (
            <Card className="rounded-[2.5rem] border-slate-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 p-8">
                <CardTitle className="text-2xl font-black flex items-center gap-2">
                  <ShieldCheck className="text-emerald-500" size={24} />
                  Operational Dependency Readiness
                </CardTitle>
                <CardDescription className="text-base font-medium text-slate-500">
                  Real-time status check for database, SMS, email, FCM, object storage, and PDF generators.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  {providersReadiness.map((pr) => (
                    <div
                      key={pr.providerKey}
                      className="p-5 rounded-3xl bg-slate-50 border border-slate-100 flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-base font-black text-slate-900 leading-tight">{pr.displayName}</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{pr.providerKey}</p>
                      </div>
                      <div className="mt-6">
                        <Badge
                          variant={
                            pr.status === 'READY'
                              ? 'success'
                              : pr.status === 'DISABLED'
                                ? 'neutral'
                                : pr.status === 'MISSING_CONFIG'
                                  ? 'warning'
                                  : 'destructive'
                          }
                          className="rounded-lg font-bold"
                        >
                          {pr.status}
                        </Badge>
                        <p className="text-[10px] text-slate-500 font-semibold mt-3 leading-snug">
                          {pr.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {safeProviders.map((provider) => (
              <Card
                key={provider.id}
                className="rounded-3xl border-slate-100 shadow-sm transition-all hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100/50 group"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-900 text-white">
                      {provider.type === 'SMS' ? (
                        <MessageSquare size={24} />
                      ) : provider.type === 'EMAIL' ? (
                        <Mail size={24} />
                      ) : provider.type === 'OBJECT_STORAGE' ? (
                        <Database size={24} />
                      ) : (
                        <ShieldCheck size={24} />
                      )}
                    </div>
                    <Badge
                      variant={provider.enabled ? 'success' : 'neutral'}
                      className="rounded-lg"
                    >
                      {provider.enabled ? 'ACTIVE' : 'DISABLED'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-black text-slate-900">
                    {provider.name}
                  </CardTitle>
                  <CardDescription className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">
                    {provider.type} · {provider.environment}
                  </CardDescription>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge
                      variant={
                        provider.validationStatus === 'READY'
                          ? 'success'
                          : provider.validationStatus === 'FAILED'
                            ? 'destructive'
                            : (provider.validationStatus === 'DEGRADED' || provider.validationStatus === 'NOT_CONFIGURED')
                              ? 'warning'
                              : 'neutral'
                      }
                      className="rounded-lg"
                    >
                      {provider.validationStatus ?? 'NOT VALIDATED'}
                    </Badge>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {provider.lastValidatedAt
                        ? `Checked ${formatDate(provider.lastValidatedAt)}`
                        : 'No readiness check yet'}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 relative overflow-hidden">
                    <div className="absolute right-3 top-3 opacity-20">
                      <Lock size={14} />
                    </div>
                    <pre className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap">
                      {JSON.stringify(provider.config, null, 2)}
                    </pre>
                  </div>
                  <div className="mt-6 flex flex-col gap-2">
                    {['SMS', 'EMAIL'].includes(provider.type) && (
                      <p className="text-[10px] text-amber-600 font-semibold mb-2 bg-amber-50 p-2 rounded-xl border border-amber-100 leading-snug">
                        “This test uses safe readiness checks and will not send real messages unless configured test mode supports it.”
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl font-bold text-slate-600 hover:bg-slate-100 gap-2"
                      onClick={() => testProvider(provider.id)}
                      disabled={testingProviderId === provider.id}
                    >
                      {testingProviderId === provider.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={14} />
                      )}
                      Dry-run Check
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-xl font-bold text-slate-600 hover:bg-slate-100 gap-2"
                      onClick={() => showProviderReadiness(provider.id)}
                      disabled={loadingProviderReadinessId === provider.id}
                    >
                      {loadingProviderReadinessId === provider.id ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <ShieldAlert size={14} />
                      )}
                      Readiness Detail
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                        onClick={() => openProviderEditor(provider)}
                        data-testid="provider-edit-button"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                        onClick={() => setDisableProvider(provider)}
                        disabled={!provider.enabled}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="webhooks"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <Card className="rounded-3xl border-slate-100 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-2xl font-black">
                    <Webhook className="text-cyan-600" size={24} />
                    Endpoint Registry
                  </CardTitle>
                  <CardDescription className="text-base font-medium text-slate-500">
                    Signed outbound webhooks for platform or tenant integrations.
                  </CardDescription>
                </div>
                <Button
                  className="rounded-2xl bg-slate-900 font-bold text-white"
                  onClick={() => setWebhookDialogOpen(true)}
                  data-testid="platform-webhook-create-button"
                >
                  <Plus size={18} className="mr-2" /> New Endpoint
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Owner</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Endpoint</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Events</th>
                        <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                        <th className="px-5 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {safeWebhookEndpoints.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center text-sm font-bold text-slate-400">
                            No webhook endpoints registered.
                          </td>
                        </tr>
                      ) : (
                        safeWebhookEndpoints.map((endpoint) => (
                          <tr key={endpoint.id} className="transition-colors hover:bg-slate-50/60">
                            <td className="px-5 py-4">
                              <p className="font-black text-slate-900">{endpoint.ownerType}</p>
                              <p className="mt-1 font-mono text-[10px] font-bold text-slate-400">
                                {endpoint.tenantId ?? 'platform'}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <p className="max-w-[300px] truncate font-mono text-xs font-bold text-slate-700">{endpoint.url}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Updated {formatDate(endpoint.updatedAt)}
                              </p>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex max-w-xs flex-wrap gap-1.5">
                                {endpoint.eventTypes.map((event) => (
                                  <Badge key={event} variant="neutral" className="rounded-lg bg-slate-50 font-mono text-[10px]">
                                    {event}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Badge variant={endpoint.status === 'ACTIVE' ? 'success' : 'neutral'} className="rounded-lg">
                                {endpoint.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl font-bold"
                                disabled={webhookSaving}
                                onClick={() => toggleWebhookEndpoint(endpoint)}
                              >
                                {endpoint.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-black">
                  <History className="text-slate-400" size={24} />
                  Delivery History
                </CardTitle>
                <CardDescription>
                  Payloads are represented by checksums and safe response summaries only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {safeWebhookDeliveries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">
                    No delivery records yet.
                  </div>
                ) : (
                  safeWebhookDeliveries.slice(0, 12).map((delivery) => (
                    <div key={delivery.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-black text-slate-900">{delivery.eventType}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {formatDate(delivery.createdAt)} · retry {delivery.retryCount}
                          </p>
                        </div>
                        <Badge
                          variant={
                            delivery.status === 'DELIVERED'
                              ? 'success'
                              : delivery.status === 'FAILED'
                                ? 'destructive'
                                : 'warning'
                          }
                          className="rounded-lg"
                        >
                          {delivery.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-[10px] font-bold text-slate-500">
                        <span className="truncate font-mono">Endpoint: {delivery.endpointId}</span>
                        <span className="truncate font-mono">Checksum: {delivery.payloadChecksum}</span>
                        {delivery.responseMessageSummary ? (
                          <span className="text-slate-600">{delivery.responseMessageSummary}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent
          value="queues"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="grid gap-6 md:grid-cols-2">
            {safeQueues.map((queue) => (
              <Card
                key={queue.name}
                className="rounded-3xl border-slate-100 shadow-sm overflow-hidden"
              >
                <CardHeader className="bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                        <Server size={20} />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black">
                          {queue.name}
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          BullMQ Queue
                        </CardDescription>
                      </div>
                    </div>
                    <Badge
                      variant={
                        queue.workerHealth === 'healthy'
                          ? 'success'
                          : 'destructive'
                      }
                      className="rounded-full px-3"
                    >
                      {queue.workerHealth.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-lg font-black text-slate-900">
                        {queue.waiting}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Waiting
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-lg font-black text-slate-900">
                        {queue.active}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Active
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <p className="text-lg font-black text-emerald-600">
                        {queue.completed}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Done
                      </p>
                    </div>
                    <div
                      className={`p-4 rounded-2xl border transition-colors ${queue.failed > 0 ? 'bg-rose-50 border-rose-100' : 'bg-slate-50 border-slate-100'}`}
                    >
                      <p
                        className={`text-lg font-black ${queue.failed > 0 ? 'text-rose-600' : 'text-slate-900'}`}
                      >
                        {queue.failed}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Failed
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      className="w-full rounded-xl font-bold bg-slate-100 text-slate-900 hover:bg-slate-200"
                      onClick={() => setInspectingQueue(queue.name)}
                    >
                      Inspect Failed
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full rounded-xl font-bold border-slate-200 gap-2"
                      onClick={() => retryQueue(queue.name)}
                      disabled={retrying === queue.name || queue.failed === 0}
                    >
                      {retrying === queue.name ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      Retry All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Failed Jobs Dialog */}
          <Dialog
            open={!!inspectingQueue}
            onOpenChange={(open: boolean) => !open && setInspectingQueue(null)}
          >
            <DialogContent className="rounded-3xl sm:max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" />
                  Failed Jobs: {inspectingQueue}
                </DialogTitle>
                <DialogDescription>
                  Showing recently failed jobs. Sensitive data in payloads is
                  masked.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-4">
                {failedJobsForInspectingQueue.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold bg-slate-50 rounded-2xl">
                    No failed jobs currently tracked for this queue.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {failedJobsForInspectingQueue.map((job: any) => (
                        <div
                          key={job.id}
                          className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">
                              ID: {job.id}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              {formatDate(job.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-rose-700">
                            {job.failedReason || 'Unknown failure'}
                          </p>
                          <div className="rounded-xl bg-slate-900 p-4 text-[10px] font-mono text-indigo-200 overflow-x-auto">
                            <pre>{JSON.stringify(job.data, null, 2)}</pre>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-lg font-bold text-rose-500"
                              onClick={() => setDiscardDialog(job)}
                            >
                              Discard
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg font-bold border-slate-200"
                              disabled={loadingJobDetailId === job.id}
                              onClick={() =>
                                inspectJobDetail(job.queueName, job.id)
                              }
                            >
                              Detail
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-lg font-bold border-slate-200"
                              onClick={() => {
                                setRetryDialog({
                                  queueName: job.queueName,
                                  jobId: job.id,
                                });
                                setRetryReason('');
                              }}
                            >
                              Retry
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent
          value="plans"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="grid gap-8 lg:grid-cols-3">
            {safePlans.map((plan) => (
              <Card
                key={plan.id}
                className="rounded-3xl border-slate-100 shadow-sm relative overflow-hidden group"
              >
                {plan.key === 'premium' && (
                  <div className="absolute top-0 right-0 h-24 w-24 translate-x-12 -translate-y-12 rotate-45 bg-indigo-500 shadow-xl" />
                )}
                <CardHeader className="p-8">
                  <div className="flex items-center justify-between mb-4">
                    <Badge
                      variant="neutral"
                      className="bg-slate-100 text-slate-600 uppercase tracking-widest text-[10px] font-black"
                    >
                      {plan.key}
                    </Badge>
                    {plan.status === 'ACTIVE' ? (
                      <CheckCircle2 className="text-emerald-500" size={20} />
                    ) : (
                      <EyeOff className="text-slate-300" size={20} />
                    )}
                  </div>
                  <CardTitle className="text-3xl font-black text-slate-900">
                    {plan.name}
                  </CardTitle>
                  <CardDescription className="text-lg font-bold text-slate-500 mt-2">
                    NPR {parseFloat(plan.priceNpr).toLocaleString()} /{' '}
                    {plan.billingCycle.toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0">
                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      Included Modules
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {asArray(plan.features)
                        .filter((f) => {
                          const lower = f.featureKey.toLowerCase();
                          return !(
                            lower.includes('m0') ||
                            lower.includes('platform')
                          );
                        })
                        .slice(0, 6)
                        .map((f) => (
                          <div
                            key={f.featureKey}
                            className="flex items-center gap-2 text-sm font-medium text-slate-600"
                          >
                            <CheckCircle2
                              size={14}
                              className={
                                f.enabled ? 'text-indigo-500' : 'text-slate-200'
                              }
                            />
                            <span
                              className={
                                f.enabled
                                  ? 'text-slate-900'
                                  : 'text-slate-400 line-through'
                              }
                            >
                              {f.featureKey}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-8 rounded-2xl font-black h-12 border-slate-200 group-hover:bg-slate-900 group-hover:text-white group-hover:border-slate-900 transition-all"
                  >
                    Edit Plan Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent
          value="audit"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Action Filter
                </Label>
                <Input
                  placeholder="e.g. TENANT_STATUS_CHANGE"
                  className="rounded-xl border-slate-200"
                  value={auditFilters.action}
                  onChange={(e) =>
                    setAuditFilters((prev) => ({
                      ...prev,
                      action: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Tenant ID Filter
                </Label>
                <Input
                  placeholder="e.g. school-slug"
                  className="rounded-xl border-slate-200"
                  value={auditFilters.tenantId}
                  onChange={(e) =>
                    setAuditFilters((prev) => ({
                      ...prev,
                      tenantId: e.target.value,
                    }))
                  }
                />
              </div>
              <FilterInput
                label="Resource"
                value={auditFilters.resource}
                onChange={(value) =>
                  setAuditFilters((prev) => ({ ...prev, resource: value }))
                }
              />
              <FilterInput
                label="Resource ID"
                value={auditFilters.resourceId}
                onChange={(value) =>
                  setAuditFilters((prev) => ({ ...prev, resourceId: value }))
                }
              />
              <FilterInput
                label="User ID"
                value={auditFilters.userId}
                onChange={(value) =>
                  setAuditFilters((prev) => ({ ...prev, userId: value }))
                }
              />
              <FilterInput
                label="Start Date"
                type="date"
                value={auditFilters.startDate}
                onChange={(value) =>
                  setAuditFilters((prev) => ({ ...prev, startDate: value }))
                }
              />
              <FilterInput
                label="End Date"
                type="date"
                value={auditFilters.endDate}
                onChange={(value) =>
                  setAuditFilters((prev) => ({ ...prev, endDate: value }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl font-bold gap-2"
                onClick={() =>
                  setAuditFilters({
                    action: '',
                    tenantId: '',
                    resource: '',
                    resourceId: '',
                    userId: '',
                    startDate: '',
                    endDate: '',
                  })
                }
              >
                Clear
              </Button>
              <Button
                variant="outline"
                className="rounded-xl font-bold gap-2"
                onClick={() => exportSettingsAuditCsv(safeAuditLogs)}
              >
                Export current page CSV
              </Button>
              <Button
                className="rounded-xl font-bold bg-slate-900 text-white gap-2"
                onClick={() => load(true)}
              >
                <Search size={16} />
                Apply Filters
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Timestamp
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Action
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Resource
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Context
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Actor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {safeAuditLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-20 text-center text-slate-400 font-bold"
                        >
                          No audit logs match the current filters.
                        </td>
                      </tr>
                    ) : (
                      safeAuditLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="group hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-900">
                              {formatDate(log.createdAt)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className="rounded-lg font-black text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100 uppercase">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-400 uppercase">
                                {log.resource}
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-700">
                                {log.resourceId || 'N/A'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-medium text-slate-500 truncate max-w-[200px]">
                              {log.after?.reason ||
                                JSON.stringify(log.after || {})}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-xs font-bold text-slate-900">
                              {log.user?.email || 'System'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="exports"
          className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Tenant ID Filter
                </Label>
                <Input
                  placeholder="e.g. school-slug"
                  className="rounded-xl border-slate-200"
                  value={exportTenantFilter}
                  onChange={(e) => setExportTenantFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Module / Scope
                </Label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={exportModuleFilter}
                  onChange={(e) => setExportModuleFilter(e.target.value)}
                >
                  <option value="">All Modules</option>
                  <option value="tenant">Tenant</option>
                  <option value="accounting">Accounting</option>
                  <option value="fees">Fees</option>
                  <option value="payroll">Payroll</option>
                  <option value="attendance">Attendance</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Status
                </Label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none bg-white"
                  value={exportStatusFilter}
                  onChange={(e) => setExportStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>
            <div className="flex items-end gap-2 py-0.5">
              <Button
                variant="outline"
                className="rounded-xl font-bold border-slate-200"
                onClick={() => {
                  setExportTenantFilter('');
                  setExportModuleFilter('');
                  setExportStatusFilter('');
                }}
              >
                Clear
              </Button>
              <Button
                className="rounded-xl font-bold bg-slate-900 text-white"
                onClick={loadReportExports}
                disabled={loadingExports}
              >
                {loadingExports ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Apply Filters'
                )}
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Timestamp
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Tenant ID
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Module
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Report Details
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Status
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {loadingExports ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                          <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Loading exports...</p>
                        </td>
                      </tr>
                    ) : reportExports.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-20 text-center text-slate-400 font-bold"
                        >
                          No generated report exports found.
                        </td>
                      </tr>
                    ) : (
                      reportExports.map((exp) => (
                        <tr
                          key={exp.id}
                          className="group hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-900">
                              {formatDate(exp.createdAt)}
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-bold text-slate-700">
                              {exp.tenantId || 'platform'}
                            </span>
                          </td>
                           <td className="px-6 py-4">
                            <Badge className="rounded-lg font-black text-[10px] bg-slate-100 text-slate-600 border-slate-200 uppercase">
                              {exp.scope}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-800">
                                {exp.reportKey} ({exp.format})
                              </span>
                              {exp.requestedBy && (
                                <span className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  by {exp.requestedBy}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                exp.status === 'COMPLETED'
                                  ? 'success'
                                  : exp.status === 'FAILED'
                                    ? 'destructive'
                                    : 'neutral'
                              }
                              className="rounded-lg font-black text-[10px]"
                            >
                              {exp.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {exp.fileAssetId && exp.status === 'COMPLETED' ? (
                              <button
                                type="button"
                                className="text-xs font-black text-primary-500 hover:text-primary-700 uppercase tracking-widest transition-colors"
                                onClick={() => downloadExport(exp.fileAssetId)}
                              >
                                Download
                              </button>
                            ) : exp.errorSummary ? (
                              <span className="text-xs text-rose-500 font-semibold" title={exp.errorSummary}>
                                Error
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-semibold">
                                N/A
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!retryDialog}
        onOpenChange={(open: boolean) => !open && setRetryDialog(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Retry Failed Job
            </DialogTitle>
            <DialogDescription>
              {retryDialog?.jobId ? `Job ${retryDialog.jobId}` : 'Bulk retry'}{' '}
              in queue {retryDialog?.queueName}. Retry is audited and requires
              an operator reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="my-4 rounded-2xl border-slate-200"
            placeholder="Reason for retrying this failed job"
            value={retryReason}
            onChange={(e) => setRetryReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setRetryDialog(null)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl font-bold bg-slate-900 text-white"
              disabled={retryReason.trim().length < 5 || !!retrying}
              onClick={submitRetry}
            >
              Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!jobDetail}
        onOpenChange={(open: boolean) => !open && setJobDetail(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Failed Job Detail
            </DialogTitle>
            <DialogDescription>
              {jobDetail?.queueName}:{jobDetail?.id}. Payload fields matching
              secret patterns are masked.
            </DialogDescription>
          </DialogHeader>
          {jobDetail && (
            <div className="space-y-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <StatusTile
                  label="Attempts"
                  value={String(jobDetail.attemptsMade)}
                />
                <StatusTile
                  label="Processed"
                  value={
                    jobDetail.processedOn
                      ? formatDate(jobDetail.processedOn)
                      : 'N/A'
                  }
                />
                <StatusTile
                  label="Finished"
                  value={
                    jobDetail.finishedOn
                      ? formatDate(jobDetail.finishedOn)
                      : 'N/A'
                  }
                />
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {jobDetail.failedReason || 'Unknown failure'}
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Sanitized payload
                </Label>
                <pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-indigo-100">
                  {JSON.stringify(jobDetail.data, null, 2)}
                </pre>
              </div>
              <div>
                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Retry audit history
                </Label>
                <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {asArray(jobDetail.retryHistory).length === 0 ? (
                    <div className="p-4 text-sm font-semibold text-slate-400">
                      No retry attempts recorded.
                    </div>
                  ) : (
                    asArray(jobDetail.retryHistory).map((entry) => (
                      <div key={entry.id} className="p-4 text-sm">
                        <p className="font-bold text-slate-900">
                          {entry.reason ?? 'No reason recorded'}
                        </p>
                        <p className="text-xs font-semibold text-slate-500">
                          {formatDate(entry.createdAt)} ·{' '}
                          {entry.userId ?? 'System'} · attempts before retry{' '}
                          {entry.attemptsMade ?? 'N/A'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!providerReadiness}
        onOpenChange={(open: boolean) => !open && setProviderReadiness(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Provider Readiness Detail
            </DialogTitle>
            <DialogDescription>
              {providerReadiness?.provider.name} ·{' '}
              {providerReadiness?.provider.type} ·{' '}
              {providerReadiness?.provider.environment}
            </DialogDescription>
          </DialogHeader>
          {providerReadiness && (
            <div className="space-y-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <StatusTile
                  label="Status"
                  value={providerReadiness.status.toUpperCase()}
                />
                <StatusTile
                  label="Mode"
                  value={
                    providerReadiness.mode === 'dry_run'
                      ? 'DRY RUN'
                      : 'DISABLED'
                  }
                />
                <StatusTile
                  label="Checked"
                  value={formatDate(providerReadiness.checkedAt)}
                />
              </div>
              {['SMS', 'EMAIL'].includes(providerReadiness.provider.type) && (
                <p className="text-xs text-amber-600 font-semibold bg-amber-50 p-3 rounded-xl border border-amber-100 leading-snug">
                  “This test uses safe readiness checks and will not send real messages unless configured test mode supports it.”
                </p>
              )}
              <div
                className={`rounded-2xl border p-4 text-sm font-bold ${
                  providerReadiness.status === 'failed'
                    ? 'border-rose-100 bg-rose-50 text-rose-700'
                    : (providerReadiness.status === 'degraded' || providerReadiness.status === 'not_configured')
                      ? 'border-amber-100 bg-amber-50 text-amber-800'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                }`}
              >
                {providerReadiness.message}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <StatusTile
                  label="Missing keys"
                  value={
                    asArray(providerReadiness.missingKeys).length > 0
                      ? asArray(providerReadiness.missingKeys).join(', ')
                      : 'None'
                  }
                />
                <StatusTile
                  label="External call"
                  value={
                    providerReadiness.paidExternalCallSkipped
                      ? 'Skipped safely'
                      : 'Executed'
                  }
                />
              </div>
              <pre className="max-h-56 overflow-auto rounded-2xl bg-slate-900 p-4 text-xs text-indigo-100">
                {JSON.stringify(providerReadiness.provider.config, null, 2)}
              </pre>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!discardDialog}
        onOpenChange={(open: boolean) => !open && setDiscardDialog(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-rose-700">
              Discard Failed Job
            </DialogTitle>
            <DialogDescription>
              Type the job id to confirm removal. The backend audit records the
              queue and job id; sensitive payload data remains masked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label>Confirmation: {discardDialog?.id}</Label>
            <Input
              value={discardConfirm}
              onChange={(e) => setDiscardConfirm(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setDiscardDialog(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-bold"
              disabled={!discardDialog || discardConfirm !== discardDialog.id}
              onClick={discardJob}
            >
              Discard Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!disableProvider}
        onOpenChange={(open: boolean) => !open && setDisableProvider(null)}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Disable Provider
            </DialogTitle>
            <DialogDescription>
              Disable {disableProvider?.name}. This status-only action does not
              expose or rewrite provider secrets.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            className="my-4 rounded-2xl border-slate-200"
            placeholder="Reason for disabling this provider"
            value={disableReason}
            onChange={(e) => setDisableReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setDisableProvider(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-bold"
              disabled={disableReason.trim().length < 5 || savingProvider}
              onClick={updateProviderStatus}
            >
              Disable Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              Register Webhook Endpoint
            </DialogTitle>
            <DialogDescription>
              Signing secrets are hashed by the backend. Delivery history stores checksums and safe response summaries only.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-bold">Owner Type</Label>
                <Select
                  value={webhookForm.ownerType}
                  onChange={(e) =>
                    setWebhookForm({
                      ...webhookForm,
                      ownerType: e.target.value as 'PLATFORM' | 'TENANT',
                    })
                  }
                >
                  <option value="PLATFORM">Platform</option>
                  <option value="TENANT">Tenant</option>
                </Select>
              </div>
              <FilterInput
                label="Tenant ID"
                value={webhookForm.tenantId}
                onChange={(value) =>
                  setWebhookForm({ ...webhookForm, tenantId: value })
                }
              />
            </div>
            <FilterInput
              label="Endpoint URL"
              value={webhookForm.url}
              onChange={(value) =>
                setWebhookForm({ ...webhookForm, url: value })
              }
            />
            <FilterInput
              label="Signing Secret"
              value={webhookForm.signingSecret}
              onChange={(value) =>
                setWebhookForm({ ...webhookForm, signingSecret: value })
              }
            />
            <FilterInput
              label="Event Types"
              value={webhookForm.eventTypes}
              onChange={(value) =>
                setWebhookForm({ ...webhookForm, eventTypes: value })
              }
            />
            <p className="-mt-3 text-xs font-semibold text-slate-400">
              Enter comma-separated event types, for example tenant.updated, invoice.issued.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setWebhookDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-slate-900 font-bold text-white"
              disabled={webhookSaving}
              onClick={createWebhookEndpoint}
            >
              {webhookSaving ? (
                <RefreshCw size={16} className="mr-2 animate-spin" />
              ) : null}
              Register Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">
              {editingProvider ? 'Edit Provider' : 'Provider Configuration'}
            </DialogTitle>
            <DialogDescription>
              Sensitive values are masked in the UI. Replacing a secret value
              will rotate the stored encrypted secret.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold">Type</Label>
                <Select
                  value={providerForm.type}
                  disabled={!!editingProvider}
                  onChange={(e) =>
                    setProviderForm({ ...providerForm, type: e.target.value })
                  }
                >
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="FCM">FCM</option>
                  <option value="OBJECT_STORAGE">Object Storage</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">Environment</Label>
                <Select
                  value={providerForm.environment}
                  disabled={!!editingProvider}
                  onChange={(e) =>
                    setProviderForm({
                      ...providerForm,
                      environment: e.target.value,
                    })
                  }
                >
                  <option value="TEST">Test</option>
                  <option value="PRODUCTION">Production</option>
                </Select>
              </div>
            </div>
            {editingProvider && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Type, name, and environment identify the provider record. Masked
                secret values are preserved by the backend unless replaced.
              </div>
            )}
            <div className="space-y-2">
              <Label className="font-bold">Provider Name</Label>
              <Input
                placeholder="e.g. sparrow, sendgrid, r2"
                className="rounded-xl border-slate-200"
                value={providerForm.name}
                disabled={!!editingProvider}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">JSON Configuration</Label>
              <Textarea
                className="rounded-xl border-slate-200 min-h-[180px] font-mono text-xs"
                value={providerForm.config}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, config: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setProviderDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl font-bold bg-slate-900 text-white"
              onClick={saveProvider}
              disabled={savingProvider}
            >
              {savingProvider ? (
                <RefreshCw size={16} className="animate-spin mr-2" />
              ) : null}
              Save Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterInput({
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
      <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">
        {label}
      </Label>
      <Input
        type={type}
        className="rounded-xl border-slate-200"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function asArray<T>(
  value: T[] | { items?: T[] | null } | null | undefined,
): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && Array.isArray(value.items)) {
    return value.items;
  }

  return [];
}

function makeDefaultWebhookForm() {
  return {
    ownerType: 'PLATFORM' as 'PLATFORM' | 'TENANT',
    tenantId: '',
    url: '',
    signingSecret: '',
    eventTypes: 'tenant.updated, invoice.issued',
  };
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function exportSettingsAuditCsv(logs: PlatformAuditLog[]) {
  const headers = [
    'createdAt',
    'action',
    'resource',
    'resourceId',
    'tenantId',
    'userId',
  ];
  const rows = logs.map((log) =>
    headers
      .map(
        (key) =>
          `"${String(log[key as keyof PlatformAuditLog] ?? '').replace(/"/g, '""')}"`,
      )
      .join(','),
  );
  const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'platform-audit-current-page.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function getInitialSettingsTab() {
  if (typeof window === 'undefined') return 'health';
  const tab = new URLSearchParams(window.location.search).get('tab');
  return ['health', 'providers', 'webhooks', 'queues', 'plans', 'audit', 'exports'].includes(tab ?? '')
    ? tab!
    : 'health';
}

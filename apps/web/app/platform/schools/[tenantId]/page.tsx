'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { PlatformTenantDetail, PlatformAuditLog, PlatformSaaSInvoiceSummary, PlatformUsageCounterSummary } from '@schoolos/core';
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
  Database
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
import { Textarea } from '@/components/ui/textarea';
import { Progress } from "@/components/ui/progress";

export default function PlatformSchoolDetail() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const router = useRouter();
  const [tenant, setTenant] = useState<PlatformTenantDetail | null>(null);
  const [invoices, setInvoices] = useState<PlatformSaaSInvoiceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Status Change Dialog State
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  
  // Feature Override State
  const [overrideTarget, setOverrideTarget] = useState<{ key: string; enabled: boolean } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

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
      alert(error.message || 'Failed to update feature override');
    } finally {
      setUpdating(false);
    }
  };

  const loadTenantData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, invData] = await Promise.all([
        api.getPlatformTenantDetail(tenantId),
        api.listPlatformSaaSInvoices(tenantId)
      ]);
      setTenant(data);
      setInvoices(invData);
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

  const handleStatusUpdate = async () => {
    if (!tenant) return;
    if (statusReason.trim().length < 5) {
      setStatusError('Reason must be at least 5 characters.');
      return;
    }

    setUpdating(true);
    setStatusError(null);
    try {
      await api.updatePlatformTenantStatus(tenant.id, !tenant.isActive, statusReason);
      await loadTenantData();
      setStatusDialogOpen(false);
      setStatusReason('');
    } catch (error: any) {
      setStatusError(error.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
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
    <div className="flex h-[80vh] flex-col items-center justify-center space-y-4">
      <RefreshCw className="h-10 w-10 animate-spin text-slate-300" />
      <p className="text-sm font-medium text-slate-400">Loading school details...</p>
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
          <Button variant="outline" className="rounded-2xl px-6 font-bold border-slate-200">
            <ExternalLink size={18} className="mr-2" />
            Impersonate
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-slate-100/50 p-1 rounded-2xl border border-slate-100">
          <TabsTrigger value="overview" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="billing" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            SaaS Billing
          </TabsTrigger>
          <TabsTrigger value="entitlements" className="rounded-xl px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Entitlements
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
                     <Button variant="outline" className="rounded-xl font-bold border-slate-200 bg-white">
                        Change Plan
                     </Button>
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
                    Usage Limits
                  </CardTitle>
                  <CardDescription>Consumption metrics for the current billing cycle.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <UsageLimitRow label="Students" current={tenant.studentCount} limit={500} unit="students" />
                   <UsageLimitRow label="Storage" current={tenant.usage.storageSizeBytes ?? 0} limit={10 * 1024 * 1024 * 1024} unit="bytes" />
                   <UsageLimitRow label="SMS (Monthly)" current={1240} limit={5000} unit="credits" />
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
                    <Button variant="ghost" className="w-full mt-6 text-xs font-bold text-slate-500 hover:text-slate-900">
                      View Checklist <ChevronRight size={14} />
                    </Button>
                 </CardContent>
               </Card>

               <Card className="rounded-3xl border-slate-100 shadow-sm bg-slate-900 text-white overflow-hidden relative">
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
                    <Button variant="outline" className="rounded-xl font-bold gap-2">
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
                                   <td className="px-6 py-4 text-right">
                                     <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900">
                                       <MoreVertical size={16} />
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
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Terms</Label>
                      <p className="text-sm font-bold text-slate-900">Net 15 (Standard)</p>
                    </div>
                    <Button variant="outline" className="w-full rounded-xl font-bold border-slate-200">
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
                  className="rounded-xl font-bold bg-slate-900 text-white"
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

        <TabsContent value="audit" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
           <Card className="rounded-3xl border-slate-100 shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <CardTitle className="text-xl font-bold">Platform Audit Trail</CardTitle>
                 <CardDescription>Complete history of operator actions on this tenant.</CardDescription>
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="rounded-lg font-bold border-slate-200">
                    Filter
                 </Button>
                 <Button variant="outline" size="sm" className="rounded-lg font-bold border-slate-200">
                    Export
                 </Button>
               </div>
             </CardHeader>
             <CardContent className="p-0">
                <div className="divide-y divide-slate-50 border-t border-slate-50">
                   {(tenant.recentAudit ?? []).length === 0 ? (
                     <div className="flex flex-col items-center justify-center p-20 text-center">
                        <History size={48} className="text-slate-100 mb-4" />
                        <p className="text-sm font-bold text-slate-400">No audit logs found.</p>
                     </div>
                   ) : (
                      (tenant.recentAudit || []).map((log: any) => (
                       <div key={log.id} className="group flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start gap-4">
                             <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-colors">
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
              disabled={updating}
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
    <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-slate-200 hover:shadow-xl hover:shadow-slate-100">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${bg} ${color} transition-transform group-hover:scale-110`}>
        <Icon size={28} />
      </div>
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-900 tracking-tight">{value.toLocaleString()}</p>
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

function formatBytes(value: number) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

'use client';

import type { PaginatedResult, PlatformTenantSummary } from '@schoolos/core';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Eye,
  MoreVertical,
  Plus,
  Search,
  Shield,
  ShieldOff,
} from 'lucide-react';
import { ActionMenu } from '@/components/ui/action-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../../../lib/api';

const initialTenantPage: PaginatedResult<PlatformTenantSummary> = {
  items: [],
  total: 0,
  page: 1,
  limit: 10,
  hasNextPage: false,
};

export default function PlatformSchools() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingWorkflow = getBillingWorkflow(searchParams.get('workflow'));
  const [data, setData] = useState<PaginatedResult<PlatformTenantSummary>>(
    initialTenantPage,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [plan, setPlan] = useState<string>('all');
  const [statusChange, setStatusChange] = useState<{
    tenantId: string;
    isActive: boolean;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Onboard school states
  const [onboardDialogOpen, setOnboardDialogOpen] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolSlug, setNewSchoolSlug] = useState('');
  const [newSchoolPlan, setNewSchoolPlan] = useState('');
  const [newSchoolAdminEmail, setNewSchoolAdminEmail] = useState('');
  const [newSchoolAdminPassword, setNewSchoolAdminPassword] = useState('');
  const [onboardSubmitting, setOnboardSubmitting] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [dbPlans, setDbPlans] = useState<any[]>([]);

  useEffect(() => {
    api.listPlatformPlans()
      .then((res) => {
        const arr = asArray(res);
        setDbPlans(arr);
        if (arr.length > 0) {
          const defaultPlan = arr.find(p => p.key === 'premium') || arr.find(p => p.key === 'standard') || arr[0];
          setNewSchoolPlan(defaultPlan.id);
        }
      })
      .catch((err) => console.error('Failed to load platform plans', err));
  }, []);

  const handleOnboardSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim() || !newSchoolSlug.trim() || !newSchoolAdminEmail.trim() || !newSchoolAdminPassword.trim()) {
      setOnboardError('All fields are required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newSchoolSlug.trim())) {
      setOnboardError('Slug must contain only lowercase letters, numbers, and hyphens');
      return;
    }
    if (newSchoolAdminPassword.length < 8) {
      setOnboardError('Password must be at least 8 characters long');
      return;
    }

    setOnboardSubmitting(true);
    setOnboardError(null);

    try {
      const selectedPlan = dbPlans.find((p) => p.id === newSchoolPlan);
      const planKey = selectedPlan?.key || 'standard';

      // 1. Register the school tenant and admin user
      const registerRes = (await api.registerTenant({
        name: newSchoolName.trim(),
        slug: newSchoolSlug.trim(),
        plan: planKey,
        adminEmail: newSchoolAdminEmail.trim(),
        adminPassword: newSchoolAdminPassword,
      })) as any;

      const tenantId = registerRes.tenant?.id;
      if (!tenantId) {
        throw new Error('School registered but ID was not returned');
      }

      // 2. Assign the subscription plan (ACTIVE)
      await api.assignPlatformSubscription(tenantId, {
        planId: newSchoolPlan,
        status: 'ACTIVE',
        startsAt: new Date().toISOString(),
      });

      // Clear forms and close
      setNewSchoolName('');
      setNewSchoolSlug('');
      setNewSchoolAdminEmail('');
      setNewSchoolAdminPassword('');
      setOnboardDialogOpen(false);
      void fetchTenants();
    } catch (err: any) {
      setOnboardError(err.message ?? 'Failed to onboard school');
    } finally {
      setOnboardSubmitting(false);
    }
  };

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listPlatformTenantsPage({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        plan: plan === 'all' ? undefined : plan,
      });
      setData({ ...initialTenantPage, ...result, items: asArray(result.items) });
    } catch (err: any) {
      setError(err.message ?? 'Failed to load platform schools');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, plan]);

  useEffect(() => {
    void fetchTenants();
  }, [fetchTenants]);

  const handleStatusChange = async () => {
    if (!statusChange || reason.trim().length < 5) return;

    setSubmitting(true);
    try {
      await api.updatePlatformTenantStatus(
        statusChange.tenantId,
        !statusChange.isActive,
        reason,
      );
      setStatusChange(null);
      setReason('');
      void fetchTenants();
    } catch (err: any) {
      setError(err.message ?? 'Failed to update tenant status');
    } finally {
      setSubmitting(false);
    }
  };

  const tenants = asArray(data.items);
  const activeCount = tenants.filter((tenant) => tenant.isActive).length;
  const suspendedCount = tenants.filter((tenant) => !tenant.isActive).length;
  const totalStudents = tenants.reduce(
    (sum, tenant) => sum + Number(tenant.studentCount ?? 0),
    0,
  );
  const totalStaff = tenants.reduce(
    (sum, tenant) => sum + Number(tenant.staffCount ?? 0),
    0,
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="neutral">Tenant Operations</Badge>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">
            Schools
          </h1>
          <p className="mt-2 max-w-3xl text-slate-500">
            Find a school, review status and plan context, open billing or support
            workflows, and perform audited lifecycle actions.
          </p>
        </div>
        <Button
          className="h-12 gap-2 rounded-2xl bg-slate-900 px-8 font-bold shadow-sm hover:bg-slate-800"
          onClick={() => {
            setOnboardDialogOpen(true);
            setOnboardError(null);
          }}
        >
          <Plus size={20} />
          Onboard school
        </Button>
      </header>

      {billingWorkflow && (
        <div className="rounded-3xl border border-cyan-100 bg-cyan-50 p-5 text-sm text-cyan-900">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-black">{billingWorkflow.heading}</p>
              <p className="mt-1 leading-6 text-cyan-800">
                Select a school to manage SchoolOS SaaS billing for that tenant.
                This is platform subscription billing only, not M3 student fee
                collection or M9 school accounting.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Visible schools" value={data.total} helper="Matching current filters" />
        <SummaryCard label="Active on page" value={activeCount} helper="Can access SchoolOS" />
        <SummaryCard label="Suspended on page" value={suspendedCount} helper="Needs lifecycle review" warning={suspendedCount > 0} />
        <SummaryCard label="Users on page" value={totalStudents + totalStaff} helper={`${totalStudents.toLocaleString()} students, ${totalStaff.toLocaleString()} staff`} />
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-xl">
            <h2 className="text-lg font-black text-slate-900">Find a tenant</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and filter by the operational state you need to review.
            </p>
          </div>
          <div className="grid w-full gap-3 md:grid-cols-[minmax(240px,1fr)_160px_160px] xl:max-w-3xl">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <Input
                placeholder="Search school name or slug"
                className="h-12 rounded-2xl border-slate-200 bg-white pl-12"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>

            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-12 rounded-2xl border-slate-200 bg-white"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>

            <Select
              value={plan}
              onChange={(event) => {
                setPlan(event.target.value);
                setPage(1);
              }}
              className="h-12 rounded-2xl border-slate-200 bg-white"
            >
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </Select>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <div className="flex items-center gap-3 font-black">
            <AlertTriangle size={20} />
            Schools unavailable
          </div>
          <p className="mt-2 text-sm">{error}</p>
          <Button className="mt-4" variant="outline" onClick={() => void fetchTenants()}>
            Try again
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <Table>
          <TableHeader className="border-b border-slate-100 bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[34%] px-6 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                School
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Status
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Plan
              </TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Current usage
              </TableHead>
              <TableHead className="text-right px-6 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5} className="px-6 py-6">
                    <div className="h-14 w-full animate-pulse rounded-2xl bg-slate-50" />
                  </TableCell>
                </TableRow>
              ))
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-80 text-center">
                  <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50 text-slate-200">
                      <Search size={40} />
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">No schools found</p>
                      <p className="text-sm">Try a different search, status, or plan filter.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="group border-b border-slate-50 transition-colors hover:bg-slate-50/70"
                >
                  <TableCell className="px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <Link
                        href={`/platform/schools/${tenant.id}`}
                        className="text-base font-black text-slate-900 transition-colors hover:text-indigo-600"
                      >
                        {tenant.name}
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral" className="font-mono text-[10px] uppercase">
                          {tenant.slug}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-300">
                          {tenant.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{renderStatusBadge(tenant.isActive)}</TableCell>
                  <TableCell>
                    <Badge variant="neutral" className="uppercase font-black text-[10px] tracking-widest">
                      {tenant.plan || 'unassigned'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-4">
                      <Metric label="Students" value={tenant.studentCount} />
                      <Metric label="Staff" value={tenant.staffCount} />
                    </div>
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/platform/schools/${tenant.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 rounded-xl hover:bg-slate-900 hover:text-white"
                          aria-label={`View ${tenant.name}`}
                        >
                          <Eye size={18} />
                        </Button>
                      </Link>
                      <ActionMenu
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl text-slate-400"
                            aria-label={`Actions for ${tenant.name}`}
                          >
                            <MoreVertical size={18} />
                          </Button>
                        }
                        items={[
                          {
                            label: 'View details',
                            icon: <ArrowRight size={16} />,
                            onClick: () => router.push(`/platform/schools/${tenant.id}`),
                          },
                          {
                            label: 'Open SaaS billing',
                            icon: <CreditCard size={16} />,
                            onClick: () => router.push(`/platform/schools/${tenant.id}?tab=billing`),
                          },
                          {
                            label: tenant.isActive ? 'Suspend school' : 'Reactivate school',
                            icon: tenant.isActive ? <ShieldOff size={16} /> : <Shield size={16} />,
                            variant: tenant.isActive ? 'danger' : 'success',
                            onClick: () =>
                              setStatusChange({
                                tenantId: tenant.id,
                                isActive: tenant.isActive,
                                name: tenant.name,
                              }),
                          },
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <Dialog
        open={!!statusChange}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setStatusChange(null);
            setReason('');
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              {statusChange?.isActive ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <ShieldOff size={24} />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Shield size={24} />
                </div>
              )}
              {statusChange?.isActive ? 'Suspend school access' : 'Reactivate school access'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              This changes platform access for <strong>{statusChange?.name}</strong> and will be recorded in audit logs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
              Lifecycle changes can affect school users immediately. Enter a clear reason for future audit review.
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Audit reason</Label>
              <Textarea
                placeholder="Example: Subscription expired after repeated failed payment attempts."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-[110px] rounded-2xl border-slate-200"
              />
              <p className="text-xs text-slate-400">Minimum 5 characters. Stored in platform audit logs.</p>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStatusChange(null);
                setReason('');
              }}
              className="rounded-xl border-slate-200 px-6 font-bold"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={reason.trim().length < 5 || submitting}
              variant={statusChange?.isActive ? 'destructive' : 'default'}
              className="rounded-xl px-8 font-bold"
            >
              {submitting ? 'Processing...' : 'Confirm audited action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={onboardDialogOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setOnboardDialogOpen(false);
            setNewSchoolName('');
            setNewSchoolSlug('');
            setNewSchoolAdminEmail('');
            setNewSchoolAdminPassword('');
            setOnboardError(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg bg-white/95 backdrop-blur-md shadow-2xl border border-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-black text-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Plus size={24} />
              </div>
              Onboard new school
            </DialogTitle>
            <DialogDescription className="pt-2 text-slate-500 font-medium">
              Create a new school tenant, setup default roles, and assign their active platform subscription.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleOnboardSchool} className="space-y-5 py-4">
            {onboardError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                {onboardError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">School name</Label>
                <Input
                  placeholder="e.g. Antigravity Academy"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="rounded-2xl border-slate-200 h-11"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">School URL slug</Label>
                <Input
                  placeholder="e.g. antigravity-academy"
                  value={newSchoolSlug}
                  onChange={(e) => {
                    setNewSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                  }}
                  className="rounded-2xl border-slate-200 h-11 font-mono text-sm"
                  required
                />
                <p className="text-[10px] text-slate-400 font-medium">
                  Only lowercase letters, numbers, and hyphens. Used for school logins.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Admin email</Label>
                  <Input
                    type="email"
                    placeholder="admin@school.com"
                    value={newSchoolAdminEmail}
                    onChange={(e) => setNewSchoolAdminEmail(e.target.value)}
                    className="rounded-2xl border-slate-200 h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-bold text-slate-700">Admin password</Label>
                  <Input
                    type="password"
                    placeholder="Min 8 characters"
                    value={newSchoolAdminPassword}
                    onChange={(e) => setNewSchoolAdminPassword(e.target.value)}
                    className="rounded-2xl border-slate-200 h-11"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-bold text-slate-700">Active subscription plan</Label>
                <Select
                  value={newSchoolPlan}
                  onChange={(e) => setNewSchoolPlan(e.target.value)}
                  className="rounded-2xl border-slate-200 h-11 bg-white font-bold"
                  required
                >
                  {dbPlans.length === 0 ? (
                    <option value="" disabled>Loading plans...</option>
                  ) : (
                    dbPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.key.toUpperCase()})
                      </option>
                    ))
                  )}
                </Select>
                <p className="text-[10px] text-slate-400 font-medium">
                  This plan subscription will be created and activated immediately.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-3 pt-4 border-t border-slate-100 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOnboardDialogOpen(false);
                  setNewSchoolName('');
                  setNewSchoolSlug('');
                  setNewSchoolAdminEmail('');
                  setNewSchoolAdminPassword('');
                  setOnboardError(null);
                }}
                className="rounded-xl border-slate-200 px-6 font-bold"
                disabled={onboardSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={onboardSubmitting || !newSchoolPlan}
                className="rounded-xl px-8 font-bold bg-slate-900 hover:bg-slate-800 text-white"
              >
                {onboardSubmitting ? 'Onboarding...' : 'Onboard school'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  warning = false,
}: {
  label: string;
  value: number;
  helper: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{value.toLocaleString()}</p>
      <p className={warning ? 'mt-1 text-sm font-semibold text-amber-700' : 'mt-1 text-sm text-slate-500'}>
        {helper}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20">
      <span className="block text-base font-black text-slate-900">{Number(value ?? 0).toLocaleString()}</span>
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}

function renderStatusBadge(isActive: boolean) {
  if (isActive) {
    return (
      <Badge className="rounded-lg border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
        ACTIVE
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="rounded-lg border-rose-100 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-700">
      SUSPENDED
    </Badge>
  );
}

function asArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function getBillingWorkflow(workflow: string | null) {
  if (workflow === 'subscriptions') {
    return { heading: 'SchoolOS SaaS subscriptions' };
  }

  if (workflow === 'saas-invoices') {
    return { heading: 'SchoolOS SaaS invoices' };
  }

  if (workflow === 'payments') {
    return { heading: 'SchoolOS SaaS payments' };
  }

  return null;
}

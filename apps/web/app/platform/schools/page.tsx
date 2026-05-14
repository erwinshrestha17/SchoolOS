'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { PlatformTenantSummary, PaginatedResult } from '@schoolos/core';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  ExternalLink,
  Shield,
  ShieldOff,
  Activity,
  Settings,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Users,
  LayoutGrid,
  List,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ActionMenu } from '@/components/ui/action-menu';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

export default function PlatformSchools() {
  const router = useRouter();
  const [data, setData] = useState<PaginatedResult<PlatformTenantSummary>>({ 
    items: [], 
    total: 0,
    page: 1,
    limit: 10,
    hasNextPage: false
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [plan, setPlan] = useState<string>('all');

  // Status Change Dialog State
  const [statusChange, setStatusChange] = useState<{ tenantId: string; isActive: boolean; name: string } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listPlatformTenantsPage({
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        plan: plan === 'all' ? undefined : plan,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status, plan]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleStatusChange = async () => {
    if (!statusChange || !reason.trim()) return;

    setSubmitting(true);
    try {
      await api.updatePlatformTenantStatus(statusChange.tenantId, !statusChange.isActive, reason);
      setStatusChange(null);
      setReason('');
      fetchTenants();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge variant="neutral" className="bg-slate-100 text-slate-600 hover:bg-slate-200 mb-3">
            Tenant Directory
          </Badge>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Global Schools</h1>
          <p className="mt-2 text-lg text-slate-500">
            Manage and monitor <span className="font-bold text-slate-900">{data.total}</span> school instances across the platform.
          </p>
        </div>
        <Button className="rounded-2xl h-12 px-8 font-bold bg-slate-900 shadow-xl shadow-slate-200 hover:bg-slate-800 gap-2">
          <Plus size={20} />
          Onboard New School
        </Button>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search school name or slug..."
            className="pl-12 h-12 rounded-2xl border-slate-100 bg-white shadow-sm focus:ring-slate-900"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <Select 
            value={status} 
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-[140px] h-12 rounded-2xl border-slate-100 bg-white shadow-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          
          <Select 
            value={plan} 
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="w-[140px] h-12 rounded-2xl border-slate-100 bg-white shadow-sm"
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </Select>

          <div className="h-10 w-px bg-slate-100 mx-2" />
          
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg bg-white shadow-sm text-slate-900">
              <List size={18} />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg text-slate-400">
              <LayoutGrid size={18} />
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[2.5rem] border border-slate-100 bg-white overflow-hidden shadow-xl shadow-slate-100/50">
        <Table>
          <TableHeader className="bg-slate-50/50 border-b border-slate-50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[400px] px-8 py-5 font-black text-slate-400 text-[10px] uppercase tracking-[0.15em]">Identity & Origin</TableHead>
              <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.15em]">Access</TableHead>
              <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.15em]">Tier</TableHead>
              <TableHead className="font-black text-slate-400 text-[10px] uppercase tracking-[0.15em]">Metrics</TableHead>
              <TableHead className="text-right px-8 font-black text-slate-400 text-[10px] uppercase tracking-[0.15em]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="px-8 py-8">
                    <div className="h-12 animate-pulse bg-slate-50 rounded-2xl w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-96 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
                    <div className="h-20 w-20 flex items-center justify-center rounded-3xl bg-slate-50 text-slate-200">
                      <Search size={40} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-900">No results found</p>
                      <p className="text-sm">Try adjusting your filters or search terms.</p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((tenant) => (
                <TableRow key={tenant.id} className="group hover:bg-slate-50/50 transition-all border-b border-slate-50">
                  <TableCell className="px-8 py-6">
                    <div className="flex flex-col gap-1.5">
                      <Link href={`/platform/schools/${tenant.id}`} className="font-bold text-lg text-slate-900 hover:text-indigo-600 transition-colors">
                        {tenant.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="neutral" className="text-[10px] font-mono bg-slate-100 text-slate-500 uppercase px-2 py-0">
                          {tenant.slug}
                        </Badge>
                        <span className="text-[10px] font-mono text-slate-300">
                          ID: {tenant.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {tenant.isActive ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[10px] px-2.5 py-0.5 rounded-lg">
                        ACTIVE
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-100 font-bold text-[10px] px-2.5 py-0.5 rounded-lg">
                        SUSPENDED
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" className="uppercase font-black text-[10px] tracking-widest bg-slate-900 text-white border-transparent px-3 py-1 rounded-lg shadow-lg shadow-slate-900/10">
                      {tenant.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col">
                        <span className="text-base font-black text-slate-900">{tenant.studentCount.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Students</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black text-slate-900">{tenant.staffCount.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Staff</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right px-8">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/platform/schools/${tenant.id}`}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm hover:shadow-lg"
                        >
                          <Eye size={18} />
                        </Button>
                      </Link>
                      
                      <ActionMenu
                        trigger={
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-400">
                            <MoreVertical size={18} />
                          </Button>
                        }
                        items={[
                          {
                            label: 'Details',
                            icon: <ArrowRight size={16} />,
                            onClick: () => router.push(`/platform/schools/${tenant.id}`)
                          },
                          {
                            label: 'Billing',
                            icon: <Activity size={16} />, // Re-using Activity for billing in simple mode
                            onClick: () => router.push(`/platform/schools/${tenant.id}?tab=billing`)
                          },
                          {
                            label: tenant.isActive ? 'Suspend' : 'Restore',
                            icon: tenant.isActive ? <ShieldOff size={16} /> : <Shield size={16} />,
                            variant: tenant.isActive ? 'danger' : 'success',
                            onClick: () => setStatusChange({
                              tenantId: tenant.id,
                              isActive: tenant.isActive,
                              name: tenant.name
                            })
                          }
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-50">
          <TablePagination 
            page={page}
            pageSize={pageSize}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Status Change Dialog */}
      <Dialog open={!!statusChange} onOpenChange={(open: boolean) => !open && setStatusChange(null)}>
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              {statusChange?.isActive ? (
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <ShieldOff size={24} />
                </div>
              ) : (
                <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Shield size={24} />
                </div>
              )}
              {statusChange?.isActive ? 'Suspend Access' : 'Restore Access'}
            </DialogTitle>
            <DialogDescription className="pt-2">
              You are about to change the access status for <strong>{statusChange?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="font-bold text-slate-700">Audit Reason</Label>
              <Textarea 
                placeholder="Why are you taking this action?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded-2xl border-slate-200 min-h-[100px]"
              />
              <p className="text-[11px] text-slate-400 italic">This will be permanently recorded in the platform audit logs.</p>
            </div>
          </div>

          <DialogFooter className="gap-3">
            <Button 
              variant="outline" 
              onClick={() => setStatusChange(null)}
              className="rounded-xl font-bold border-slate-200 px-6"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={!reason.trim() || submitting}
              variant={statusChange?.isActive ? 'destructive' : 'default'}
              className="rounded-xl font-bold px-8 shadow-lg shadow-slate-200"
            >
              {submitting ? 'Processing...' : 'Confirm Action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

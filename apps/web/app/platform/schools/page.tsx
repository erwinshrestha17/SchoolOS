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
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ActionMenu } from '@/components/ui/action-menu';

export default function PlatformSchools() {
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

  const PLANS = ['free', 'basic', 'standard', 'premium'];

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Schools</h1>
          <p className="text-slate-500 mt-1">Global tenant directory and platform controls.</p>
        </div>
        <Button className="rounded-xl shadow-sm gap-2">
          <Plus size={18} />
          Register New School
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Search by school name or slug..."
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select 
            value={status} 
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-[140px]"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          
          <Select 
            value={plan} 
            onChange={(e) => { setPlan(e.target.value); setPage(1); }}
            className="w-[140px]"
          >
            <option value="all">All Plans</option>
            {PLANS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[300px]">School Identity</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <div className="h-16 animate-pulse bg-slate-50 rounded-lg w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Search size={40} className="text-slate-200" />
                    <p>No schools found matching your criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((tenant) => (
                <TableRow key={tenant.id} className="group hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                        {tenant.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                        {tenant.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {tenant.slug}
                  </TableCell>
                  <TableCell>
                    {tenant.isActive ? (
                      <Badge variant="success" className="gap-1 px-2">
                        <Shield size={10} />
                        ACTIVE
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 px-2">
                        <ShieldOff size={10} />
                        SUSPENDED
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral" className="uppercase font-bold text-[10px]">
                      {tenant.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span>{tenant.studentCount}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-xs text-slate-400">Students</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/platform/schools/${tenant.id}`}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="rounded-xl hover:bg-white hover:text-primary-600 hover:shadow-sm transition-all"
                        >
                          <ExternalLink size={18} />
                        </Button>
                      </Link>
                      
                      <ActionMenu
                        trigger={
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical size={18} />
                          </Button>
                        }
                        items={[
                          {
                            label: 'Usage Dashboard',
                            icon: <Activity size={16} />,
                            onClick: () => window.location.href = `/platform/schools/${tenant.id}#usage`
                          },
                          {
                            label: 'Platform Settings',
                            icon: <Settings size={16} />,
                            onClick: () => {}
                          },
                          {
                            label: tenant.isActive ? 'Suspend Access' : 'Restore Access',
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
        
        <TablePagination 
          page={page}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
        />
      </div>

      {/* Status Change Dialog */}
      <Dialog open={!!statusChange} onOpenChange={(open: boolean) => !open && setStatusChange(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className={statusChange?.isActive ? "text-rose-500" : "text-emerald-500"} />
              {statusChange?.isActive ? 'Suspend School Access' : 'Restore School Access'}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to {statusChange?.isActive ? 'suspend' : 'restore'} access for <strong>{statusChange?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Reason for change</label>
              <Textarea 
                placeholder="Provide a mandatory reason for this platform action..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none"
              />
              <p className="text-[11px] text-slate-500 italic">This reason will be recorded in the platform audit logs.</p>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setStatusChange(null)}
              className="rounded-xl"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleStatusChange}
              disabled={!reason.trim() || submitting}
              variant={statusChange?.isActive ? 'destructive' : 'default'}
              className="rounded-xl min-w-[100px]"
            >
              {submitting ? 'Processing...' : (statusChange?.isActive ? 'Suspend' : 'Restore')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

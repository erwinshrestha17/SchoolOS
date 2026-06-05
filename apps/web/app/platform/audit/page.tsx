'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../lib/api';
import { PlatformAuditLog, PaginatedResult } from '@schoolos/core';
import { 
  Search, 
  Filter,
  Calendar,
  User,
  Shield,
  FileText,
  Clock,
  ExternalLink,
  ChevronRight,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { Select } from '@/components/ui/select';


export default function PlatformAudit() {
  const [data, setData] = useState<PaginatedResult<PlatformAuditLog>>({ 
    items: [], 
    total: 0,
    page: 1,
    limit: 15,
    hasNextPage: false
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [tenantId, setTenantId] = useState('');
  const [action, setAction] = useState('all');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listPlatformAuditLogs({
        page,
        limit: pageSize,
        tenantId: tenantId.trim() || undefined,
        action: action === 'all' ? undefined : action,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, tenantId, action]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('suspend')) return 'destructive';
    if (action.includes('create') || action.includes('activate')) return 'success';
    if (action.includes('update')) return 'info';
    return 'neutral';
  };

  return (
    <div className="space-y-8 p-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Logs</h1>
        <p className="text-slate-500 mt-1">Platform-wide activity trail for security and compliance.</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            placeholder="Filter by Tenant ID..."
            className="pl-10"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setPage(1);
            }}
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select 
            value={action} 
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="w-[180px]"
          >
            <option value="all">All Actions</option>
            <option value="tenant_activated">Tenant Activated</option>
            <option value="tenant_suspended">Tenant Suspended</option>
            <option value="setting_updated">Setting Updated</option>
            <option value="user_created">User Created</option>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              <TableHead className="w-[180px]">Timestamp</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Performed By</TableHead>
              <TableHead>Request ID</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <div className="h-12 animate-pulse bg-slate-50 rounded-lg w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Database size={40} className="text-slate-200" />
                    <p>No audit logs found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="text-slate-500 text-xs font-medium">
                    <div className="flex flex-col">
                      <span>{new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getActionColor(log.action)} className="uppercase text-[10px] tracking-tight">
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-700 capitalize">{log.resource}</span>
                      <span className="text-[10px] font-mono text-slate-400">{log.resourceId || 'Resource ID not recorded'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={log.tenantId === 'platform' ? "text-[var(--color-mod-platform-accent)] font-bold text-xs" : "text-slate-600 text-xs font-mono"}>
                      {log.tenantId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <User size={14} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-slate-900">{log.user?.email || 'System'}</span>
                        <span className="text-[9px] text-slate-400 font-mono">{log.userId?.slice(0, 8) || ''}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] font-mono text-slate-400">
                      {log.requestId?.slice(0, 8) || 'Request ID not recorded'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 rounded-lg gap-1.5 text-xs text-slate-500 hover:text-[var(--color-mod-platform-accent)]">
                      View JSON
                      <ChevronRight size={14} />
                    </Button>
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
    </div>
  );
}

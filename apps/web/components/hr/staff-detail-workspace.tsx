'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Save, 
  User, 
  Briefcase, 
  CalendarDays, 
  History, 
  Calculator, 
  Landmark,
  ClipboardCheck,
  ShieldCheck,
  MapPin,
  Mail,
  Phone,
  Banknote
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

export function StaffDetailWorkspace({ staffId }: { staffId: string }) {
  const queryClient = useQueryClient();
  const staffQuery = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => api.getStaffDetail(staffId),
  });
  const staff = staffQuery.data;

  const [draft, setDraft] = useState({
    department: '',
    designation: '',
    bankName: '',
    bankAccount: '',
    email: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (staff) {
      setDraft({
        department: staff.employment?.department ?? '',
        designation: staff.employment?.designation ?? '',
        bankName: staff.bankName ?? '',
        bankAccount: staff.bankAccount ?? '',
        email: staff.email ?? '',
        phone: staff.personal?.emergencyContact?.phone ?? '',
        address: staff.personal?.address ?? '',
      });
    }
  }, [staff]);

  const updateMutation = useMutation({
    mutationFn: () => api.updateStaffDetail(staffId, draft),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-detail', staffId] });
    },
  });

  if (staffQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="h-12 w-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hydrating Staff Profile...</p>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2rem] text-center">
        <p className="text-rose-600 font-bold">Staff member not found or access denied.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Profile Card */}
      <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-blue-500/5 blur-3xl" />
        <div className="relative flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="h-24 w-24 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200 shadow-inner">
            <User size={48} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-3xl font-black text-slate-900">
                {staff.firstName} {staff.lastName}
              </h2>
              <Badge className={cn(
                "font-black uppercase tracking-widest text-[10px] px-3 py-1",
                staff.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/10" : "bg-slate-100 text-slate-500"
              )}>
                {staff.status ?? 'ACTIVE'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-slate-500 font-medium">
              <span className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-blue-500" />
                {staff.employeeId}
              </span>
              <span className="flex items-center gap-2">
                <Briefcase size={16} className="text-slate-400" />
                {staff.employment?.designation ?? 'No designation'}
              </span>
              <span className="flex items-center gap-2">
                <Landmark size={16} className="text-slate-400" />
                {staff.employment?.department ?? 'No department'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10 disabled:opacity-50"
            >
              <Save size={18} />
              {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="space-y-8">
        <TabsList className="bg-white/50 border border-slate-200 p-1 rounded-2xl">
          <TabsTrigger value="overview" className="gap-2">
            <User size={14} />
            Overview
          </TabsTrigger>
          <TabsTrigger value="employment" className="gap-2">
            <Briefcase size={14} />
            Employment
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardCheck size={14} />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2">
            <CalendarDays size={14} />
            Leave
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Calculator size={14} />
            Payroll
          </TabsTrigger>
        </TabsList>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="space-y-8">
            <TabsContent value="overview" className="m-0 outline-none">
              <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                    <User size={18} />
                  </div>
                  Personal Information
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Field 
                    label="Email Address" 
                    value={draft.email} 
                    icon={Mail}
                    onChange={(email) => setDraft((c) => ({ ...c, email }))} 
                  />
                  <Field 
                    label="Emergency Contact" 
                    value={draft.phone} 
                    icon={Phone}
                    onChange={(phone) => setDraft((c) => ({ ...c, phone }))} 
                  />
                  <div className="md:col-span-2">
                    <Field 
                      label="Residential Address" 
                      value={draft.address} 
                      icon={MapPin}
                      onChange={(address) => setDraft((c) => ({ ...c, address }))} 
                    />
                  </div>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="employment" className="m-0 outline-none">
              <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-8">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                    <Briefcase size={18} />
                  </div>
                  Employment Details
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <Field 
                    label="Department" 
                    value={draft.department} 
                    onChange={(v) => setDraft((c) => ({ ...c, department: v }))} 
                  />
                  <Field 
                    label="Designation" 
                    value={draft.designation} 
                    onChange={(v) => setDraft((c) => ({ ...c, designation: v }))} 
                  />
                  <Field 
                    label="Bank Name" 
                    value={draft.bankName} 
                    icon={Landmark}
                    onChange={(v) => setDraft((c) => ({ ...c, bankName: v }))} 
                  />
                  <Field 
                    label="Bank Account #" 
                    value={draft.bankAccount} 
                    icon={Banknote}
                    onChange={(v) => setDraft((c) => ({ ...c, bankAccount: v }))} 
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="attendance" className="m-0 outline-none">
              <HistoryTable 
                title="Recent Attendance" 
                items={staff.attendanceRecords ?? []} 
                icon={ClipboardCheck}
              />
            </TabsContent>

            <TabsContent value="leave" className="m-0 outline-none">
              <HistoryTable 
                title="Leave History" 
                items={staff.leaveRequests ?? []} 
                icon={CalendarDays}
              />
            </TabsContent>

            <TabsContent value="payroll" className="m-0 outline-none">
              <HistoryTable 
                title="Payroll History" 
                items={staff.payrollLines ?? []} 
                icon={Calculator}
              />
            </TabsContent>
          </div>

          <aside className="space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-xl">
              <h4 className="font-bold mb-4 text-slate-400 uppercase tracking-widest text-[10px]">Staff Summary</h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Joined Date</span>
                  <span className="text-xs font-bold">{staff.employment?.joiningDate ? new Date(staff.employment.joiningDate).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-xs text-slate-400 font-medium">Contract Type</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{staff.contractType ?? 'PERMANENT'}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-xs text-slate-400 font-medium">Active Salary Structure</span>
                  <span className="text-xs font-bold text-emerald-400">NPR {staff.salaryStructures?.[0]?.basicSalary?.toLocaleString() ?? 0}</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-6">
              <h4 className="font-bold mb-2 text-blue-900 text-sm">HR Note</h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Profile updates are audited and synced with user authentication records. 
                Sensitive financial changes require a separate salary structure update.
              </p>
            </div>
          </aside>
        </div>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  icon: Icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: any;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">{label}</span>
      <div className="relative">
        {Icon && <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all",
            Icon ? "pl-11 pr-4" : "px-4"
          )}
        />
      </div>
    </label>
  );
}

function HistoryTable({ title, items, icon: Icon }: { title: string; items: any[]; icon: any }) {
  return (
    <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center">
          <Icon size={18} />
        </div>
        {title}
      </h3>
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        {items.length > 0 ? (
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Date/Period</th>
                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Status/Summary</th>
                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.slice(0, 10).map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {item.attendanceDate || item.periodMonth ? `${item.periodMonth}/${item.periodYear}` : item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-widest">
                      {item.status || item.attendanceStatus || 'COMPLETED'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500 font-medium">
                    {item.netSalary ? `NPR ${item.netSalary.toLocaleString()}` : item.leaveType || 'Record Logged'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400 font-medium italic">No historical records found for this category.</p>
          </div>
        )}
      </div>
    </section>
  );
}

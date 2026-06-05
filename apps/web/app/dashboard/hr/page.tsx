'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  Users,
  CalendarDays,
  ClipboardCheck,
  Briefcase,
  AlertCircle,
  ArrowRight
} from 'lucide-react';
import { StatCard } from '../../../components/ui/stat-card';
import Link from 'next/link';
import { cn } from '../../../lib/utils';

const isDateWithinDays = (value?: string | null, days = 30) => {
  if (!value) return false;
  const target = new Date(value).getTime();
  const now = new Date().getTime();
  return target >= now && target <= now + days * 24 * 60 * 60 * 1000;
};

export default function HRDashboardPage() {
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts'],
    queryFn: () => api.listStaffContracts(),
  });
  const leaveRequestsQuery = useQuery({ queryKey: ['leave-requests'], queryFn: api.listLeaveRequests });

  const staff = staffQuery.data ?? [];
  const contracts = contractsQuery.data ?? [];
  const leaveRequests = leaveRequestsQuery.data ?? [];
  const activeStaff = staff.filter((member) => member.status === 'ACTIVE' || !member.status).length;
  const pendingLeave = leaveRequests.filter((leave) => leave.status === 'PENDING').length;
  const today = new Date().toISOString().slice(0, 10);
  const onLeaveToday = leaveRequests.filter((leave) => {
    if (leave.status !== 'APPROVED') return false;
    const start = new Date(leave.startsOn).toISOString().slice(0, 10);
    const end = new Date(leave.endsOn).toISOString().slice(0, 10);
    return start <= today && end >= today;
  }).length;
  const contractRenewalsDue = contracts.filter(
    (contract) => contract.status === 'ACTIVE' && isDateWithinDays(contract.endDate),
  ).length;

  const stats = [
    {
      title: "Total Staff",
      value: staff.length,
      icon: <Users className="h-5 w-5" />,
      loading: staffQuery.isLoading,
      href: "/dashboard/hr/staff",
      tone: 'neutral' as const,
      description: `${activeStaff} active staff`,
    },
    {
      title: "Active Contracts",
      value: contracts.filter((c) => c.status === 'ACTIVE').length,
      icon: <Briefcase className="h-5 w-5" />,
      loading: contractsQuery.isLoading,
      href: "/dashboard/hr/contracts",
      tone: 'info' as const,
      description: `${contractRenewalsDue} renewal(s) due in 30 days`,
    },
    {
      title: "Pending Leave",
      value: pendingLeave,
      icon: <AlertCircle className="h-5 w-5" />,
      loading: leaveRequestsQuery.isLoading,
      href: "/dashboard/hr/leave",
      tone: pendingLeave > 0 ? 'warning' as const : 'success' as const,
      description: `${onLeaveToday} approved leave today`,
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            loading={stat.loading}
            href={stat.href}
            tone={stat.tone}
            description={stat.description}
          />
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold">HR Quick Actions</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Add New Staff', href: '/dashboard/hr/staff', icon: Users, color: 'text-blue-500 bg-blue-50' },
              { label: 'Approve Leave', href: '/dashboard/hr/leave', icon: CalendarDays, color: 'text-emerald-500 bg-emerald-50' },
              { label: 'Staff Attendance', href: '/dashboard/hr/attendance', icon: ClipboardCheck, color: 'text-amber-500 bg-amber-50' },
              { label: 'Manage Contracts', href: '/dashboard/hr/contracts', icon: Briefcase, color: 'text-indigo-500 bg-indigo-50' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all"
              >
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", item.color)}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{item.label}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        <section className="shell-card p-8">
          <h3 className="text-xl font-bold text-slate-950 mb-4">Operational Status</h3>
          <p className="text-slate-500 text-sm mb-6">Overview from live staff, contract, and leave records.</p>
          
          <div className="space-y-4">
            {[
              {
                label: 'Active Staff',
                status: `${activeStaff}/${staff.length}`,
                statusColor: 'text-success-700',
              },
              {
                label: 'Pending Leave Requests',
                status: String(pendingLeave),
                statusColor: pendingLeave > 0 ? 'text-warning-700' : 'text-success-700',
              },
              {
                label: 'Contract Renewals Due',
                status: String(contractRenewalsDue),
                statusColor: contractRenewalsDue > 0 ? 'text-danger-700' : 'text-success-700',
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <span className="text-slate-600 font-medium">{item.label}</span>
                <span className={cn("font-bold tabular-nums", item.statusColor)}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

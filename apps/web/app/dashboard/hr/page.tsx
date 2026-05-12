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

export default function HRDashboardPage() {
  const staffQuery = useQuery({ queryKey: ['staff'], queryFn: api.listStaff });
  const contractsQuery = useQuery({
    queryKey: ['staff-contracts'],
    queryFn: () => api.listStaffContracts(),
  });
  const leaveRequestsQuery = useQuery({ queryKey: ['leave-requests'], queryFn: api.listLeaveRequests });

  const stats = [
    {
      title: "Total Staff",
      value: staffQuery.data?.length ?? 0,
      icon: <Users className="h-5 w-5" />,
      loading: staffQuery.isLoading,
      href: "/dashboard/hr/staff"
    },
    {
      title: "Active Contracts",
      value: contractsQuery.data?.filter((c) => c.status === 'ACTIVE').length ?? 0,
      icon: <Briefcase className="h-5 w-5" />,
      loading: contractsQuery.isLoading,
      href: "/dashboard/hr/contracts"
    },
    {
      title: "Pending Leave",
      value: leaveRequestsQuery.data?.filter((l) => l.status === 'PENDING').length ?? 0,
      icon: <AlertCircle className="h-5 w-5" />,
      loading: leaveRequestsQuery.isLoading,
      href: "/dashboard/hr/leave"
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

        <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />
          <h3 className="text-xl font-bold mb-4">Operational Status</h3>
          <p className="text-slate-400 text-sm mb-6">Overview of current month HR activities.</p>
          
          <div className="space-y-4">
            {[
              { label: 'Staff Attendance Logged', status: '85%', color: 'bg-emerald-500' },
              { label: 'Leave Requests Cleared', status: '12 Pending', statusColor: 'text-amber-400' },
              { label: 'Contract Renewals Due', status: '2 This Month', statusColor: 'text-rose-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-300 font-medium">{item.label}</span>
                <span className={cn("font-bold", item.statusColor || "text-white")}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

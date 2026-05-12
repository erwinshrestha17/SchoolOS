'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
  Calculator,
  History,
  Wallet,
  FileText,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import { StatCard } from '../../../components/ui/stat-card';
import { cn } from '../../../lib/utils';
import Link from 'next/link';

export default function PayrollDashboardPage() {
  const runsQuery = useQuery({ queryKey: ['payroll-runs'], queryFn: api.listPayrollRuns });
  const summaryQuery = useQuery({ queryKey: ['payroll-summary'], queryFn: api.getPayrollReportSummary });

  // In a real app, these would come from summaryQuery.data
  const stats = [
    {
      title: "Gross Pay (Current)",
      value: "NPR 1,240,500",
      icon: <TrendingUp className="h-5 w-5" />,
      loading: summaryQuery.isLoading,
    },
    {
      title: "Net Pay (Current)",
      value: "NPR 1,120,000",
      icon: <Wallet className="h-5 w-5" />,
      loading: summaryQuery.isLoading,
    },
    {
      title: "Pending Approval",
      value: runsQuery.data?.filter(r => r.status === 'PENDING').length ?? 0,
      icon: <AlertCircle className="h-5 w-5" />,
      loading: runsQuery.isLoading,
      href: "/dashboard/payroll/runs"
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
            <h3 className="text-xl font-bold">Payroll Operations</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Create Payroll Run', href: '/dashboard/payroll/runs', icon: History, color: 'text-emerald-500 bg-emerald-50' },
              { label: 'Salary Structures', href: '/dashboard/payroll/salary-structures', icon: Calculator, color: 'text-blue-500 bg-blue-50' },
              { label: 'Manage Payslips', href: '/dashboard/payroll/payslips', icon: FileText, color: 'text-indigo-500 bg-indigo-50' },
              { label: 'Payroll Reports', href: '/dashboard/payroll/reports', icon: BarChart3, color: 'text-amber-500 bg-amber-50' },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
              >
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", item.color)}>
                  <item.icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{item.label}</p>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
          <h3 className="text-xl font-bold mb-4">Posting Status</h3>
          <p className="text-slate-400 text-sm mb-6">Integration status with Accounting Ledger.</p>
          
          <div className="space-y-4">
            {[
              { label: 'Latest Run Posted', status: 'Success', statusColor: 'text-emerald-400' },
              { label: 'TDS Remittance', status: 'Pending', statusColor: 'text-amber-400' },
              { label: 'PF Contribution', status: 'Pending', statusColor: 'text-amber-400' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                <span className="text-slate-300 font-medium">{item.label}</span>
                <span className={cn("font-bold uppercase tracking-widest text-xs", item.statusColor)}>{item.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

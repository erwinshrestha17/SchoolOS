'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '../../../components/ui/badge';
import { 
  Calculator, LayoutDashboard, History, 
  BarChart3, Wallet, FileText
} from 'lucide-react';
import { useSession } from '../../../components/session-provider';
import { cn } from '../../../lib/utils';

export default function PayrollLayout({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard/payroll', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/payroll/salary-structures', label: 'Salary Structures', icon: Calculator },
    { href: '/dashboard/payroll/runs', label: 'Payroll Runs', icon: History },
    { href: '/dashboard/payroll/payslips', label: 'Payslips', icon: FileText },
    { href: '/dashboard/payroll/reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="relative overflow-hidden rounded-[2rem] bg-slate-900 px-6 py-10 text-white shadow-2xl lg:px-12">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-48 w-48 rounded-full bg-primary-500/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="phase2" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/20">
                Payroll Management
              </Badge>
              <div className="h-1 w-1 rounded-full bg-white/30" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Compensation & Benefits
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              Payroll <span className="text-emerald-400">Workspace</span>
            </h1>
            <p className="mt-4 text-lg text-slate-300 leading-relaxed">
              Generate payroll runs, manage salary structures, and track statutory deductions for <span className="font-bold text-white">{session?.tenant.name}</span>.
            </p>
          </div>

          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-xl border border-white/10 shadow-inner">
            <Wallet size={40} className="text-emerald-400" />
          </div>
        </div>

        <nav className="relative mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-6">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard/payroll' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
                  active 
                    ? "bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/20" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="pb-12">
        {children}
      </main>
    </div>
  );
}

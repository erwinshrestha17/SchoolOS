'use client';

import { 
  FileSpreadsheet, 
  Download, 
  BarChart3, 
  FileText,
  ShieldCheck,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { api } from '../../../../lib/api';
import { cn } from '../../../../lib/utils';

export default function PayrollReportsPage() {
  const reports = [
    {
      title: "Payroll Register",
      description: "Complete line-item breakdown of the latest payroll run.",
      icon: FileSpreadsheet,
      action: () => api.exportPayrollRegisterCsv(),
      color: "text-emerald-500 bg-emerald-50"
    },
    {
      title: "Statutory TDS Summary",
      description: "Summary of Tax Deducted at Source for the current period.",
      icon: ShieldCheck,
      action: () => api.exportPayrollRegisterCsv(), // Placeholder for TDS specific CSV
      color: "text-amber-500 bg-amber-50"
    },
    {
      title: "PF Contribution Report",
      description: "Employee and Employer Provident Fund contribution details.",
      icon: TrendingUp,
      action: () => api.exportPayrollRegisterCsv(), // Placeholder for PF specific CSV
      color: "text-blue-500 bg-blue-50"
    },
    {
      title: "Leave Encashment & Deductions",
      description: "Detailed report on leave-related salary adjustments.",
      icon: FileText,
      action: () => api.exportPayrollRegisterCsv(), // Placeholder
      color: "text-indigo-500 bg-indigo-50"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <div 
            key={report.title}
            className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group"
          >
            <div className="flex items-start gap-6">
              <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", report.color)}>
                <report.icon size={28} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  {report.title}
                </h3>
                <p className="mt-2 text-slate-500 leading-relaxed">
                  {report.description}
                </p>
                <button
                  onClick={report.action}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-900/10"
                >
                  <Download size={16} />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="text-2xl font-black mb-4">Accounting Reconciliation</h3>
            <p className="text-slate-400 leading-relaxed mb-8">
              All payroll journals are posted to the main ledger as accruals. 
              Disbursement journals should be verified against bank statements 
              in the Finance module.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl">
                <ShieldCheck size={20} className="text-emerald-400" />
                <span className="text-sm font-bold">M9 Compliance Active</span>
              </div>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl">
                <BarChart3 size={20} className="text-blue-400" />
                <span className="text-sm font-bold">Real-time Ledger Sync</span>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
            <h4 className="font-bold mb-4 text-slate-300 uppercase tracking-widest text-xs">Recent Ledger Postings</h4>
            <div className="space-y-3">
              {[
                { label: 'Payroll Accrual - April 2026', status: 'Posted', date: '2026-05-02' },
                { label: 'TDS Payable - April 2026', status: 'Posted', date: '2026-05-02' },
                { label: 'PF Liability - April 2026', status: 'Posted', date: '2026-05-02' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors">
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-[10px] text-slate-500">{item.date}</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
